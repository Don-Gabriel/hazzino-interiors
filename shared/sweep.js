import * as T from "three";
import { entity } from "./model.js";
import { objectGeometry, objectMatrix } from "./geometry.js";
import { faceRegion, toSolid, meshEntity } from "./solid-kernel.js";

const area = (loop) =>
  loop.reduce((sum, p, i) => {
    const q = loop[(i + 1) % loop.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);

export function connectedPath(objects) {
  if (!objects.length || objects.some((o) => o.kind !== "line"))
    throw Error("Select a connected line, arc or curve as the path");
  const paths = objects.map((o) => {
    const g = objectGeometry(o).applyMatrix4(objectMatrix(o));
    try {
      return Array.from({ length: g.attributes.position.count }, (_, i) =>
        new T.Vector3().fromBufferAttribute(g.attributes.position, i),
      );
    } finally {
      g.dispose();
    }
  });
  const result = paths.shift();
  while (paths.length) {
    const i = paths.findIndex(
      (p) =>
        p[0].distanceTo(result.at(-1)) < 0.01 ||
        p.at(-1).distanceTo(result.at(-1)) < 0.01 ||
        p[0].distanceTo(result[0]) < 0.01 ||
        p.at(-1).distanceTo(result[0]) < 0.01,
    );
    if (i < 0) throw Error("The selected path has disconnected edges");
    let next = paths.splice(i, 1)[0];
    if (next[0].distanceTo(result.at(-1)) < 0.01) result.push(...next.slice(1));
    else if (next.at(-1).distanceTo(result.at(-1)) < 0.01)
      result.push(...next.reverse().slice(1));
    else {
      if (next[0].distanceTo(result[0]) < 0.01) next.reverse();
      result.unshift(...next.slice(0, -1));
    }
  }
  const points = result.filter(
    (p, i) => !i || p.distanceTo(result[i - 1]) > 0.001,
  );
  if (points.length < 2 || points.length > 500)
    throw Error("A path needs 2–500 distinct points");
  return points;
}

export function sweepProfile(profile, paths, { align = true, triangle } = {}) {
  if (
    !profile ||
    (!profile.isFace && triangle == null) ||
    profile.locked ||
    paths.some((o) => o.locked)
  )
    throw Error("Follow Me needs an unlocked flat face and path");
  const faceTriangle =
    triangle ??
    (profile.kind === "box" && profile.isFace
      ? (profile.thinAxis ?? profile.size.indexOf(Math.min(...profile.size))) *
        4
      : 0);
  const region = faceRegion(profile, faceTriangle),
    points = connectedPath(paths);
  const closed =
    points.length > 2 && points[0].distanceTo(points.at(-1)) < 0.01;
  if (closed) points.pop();
  const segments = points.map((p, i) =>
    points[(i + 1) % points.length].clone().sub(p).normalize(),
  );
  if (!closed) segments.pop();
  const first = segments[0],
    rotation = new T.Quaternion().setFromUnitVectors(region.n, first);
  if (!align && Math.abs(region.n.dot(first)) < 0.999)
    throw Error(
      "The face must be perpendicular to the first path edge, or enable Align profile",
    );
  let u = region.u.clone(),
    v = region.v.clone();
  if (align) {
    u.applyQuaternion(rotation);
    v.applyQuaternion(rotation);
  } else if (region.n.dot(first) < 0) v.negate();
  const loops = [...region.loops]
    .sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))
    .map((loop, i) =>
      area(loop) > 0 === (i === 0) ? [...loop] : [...loop].reverse(),
    );
  const all = loops.flat(),
    min = [0, 1].map((a) => Math.min(...all.map((p) => p[a]))),
    max = [0, 1].map((a) => Math.max(...all.map((p) => p[a])));
  const center = min.map((n, a) => (n + max[a]) / 2);
  const originOffset = region.origin.clone().sub(points[0]);
  const contour = all.map((p) =>
    align
      ? [p[0] - center[0], p[1] - center[1]]
      : [p[0] + originOffset.dot(u), p[1] + originOffset.dot(v)],
  );
  const bases = [{ u: u.clone(), v: v.clone() }];
  for (let i = 1; i < segments.length; i++) {
    if (segments[i - 1].dot(segments[i]) < -0.999)
      throw Error("The path doubles back on itself");
    const q = new T.Quaternion().setFromUnitVectors(
      segments[i - 1],
      segments[i],
    );
    u.applyQuaternion(q);
    v.applyQuaternion(q);
    bases.push({ u: u.clone(), v: v.clone() });
  }
  if (closed) {
    const endU = u
      .clone()
      .applyQuaternion(
        new T.Quaternion().setFromUnitVectors(segments.at(-1), first),
      );
    const twist = Math.atan2(
      first.dot(endU.clone().cross(bases[0].u)),
      endU.dot(bases[0].u),
    );
    bases.forEach((base, i) => {
      const q = new T.Quaternion().setFromAxisAngle(
        segments[i],
        (twist * i) / segments.length,
      );
      base.u.applyQuaternion(q);
      base.v.applyQuaternion(q);
    });
  }
  const vertices = [],
    triangles = [],
    count = contour.length;
  points.forEach((point, i) => {
    const seg = Math.min(i, segments.length - 1),
      base = bases[seg],
      tangent = segments[seg];
    const previous = i ? segments[i - 1] : closed ? segments.at(-1) : tangent;
    const normal = previous.clone().add(tangent).normalize();
    const denominator = tangent.dot(normal);
    if (denominator < 0.05)
      throw Error("The path corner is too sharp for a stable miter");
    for (const p of contour) {
      const r = base.u
        .clone()
        .multiplyScalar(p[0])
        .addScaledVector(base.v, p[1]);
      r.addScaledVector(tangent, -r.dot(normal) / denominator).add(point);
      vertices.push(...r.toArray());
    }
  });
  for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
    let offset = 0;
    for (const loop of loops) {
      for (let j = 0; j < loop.length; j++) {
        const k = offset + j,
          next = offset + ((j + 1) % loop.length),
          end = (i + 1) % points.length;
        const a = i * count + k,
          b = i * count + next,
          c = end * count + next,
          d = end * count + k;
        triangles.push(a, b, c, a, c, d);
      }
      offset += loop.length;
    }
  }
  if (!closed) {
    const caps = T.ShapeUtils.triangulateShape(
      loops[0].map((p) => new T.Vector2(...p)),
      loops.slice(1).map((h) => h.map((p) => new T.Vector2(...p))),
    );
    for (const [a, b, c] of caps)
      triangles.push(
        c,
        b,
        a,
        a + (points.length - 1) * count,
        b + (points.length - 1) * count,
        c + (points.length - 1) * count,
      );
  }
  const raw = entity({
    kind: "mesh",
    name: "Follow Me",
    vertices,
    triangles,
    meshSize: [1, 1, 1],
    size: [1, 1, 1],
    position: [0, 0, 0],
  });
  const solid = toSolid(raw);
  try {
    return meshEntity(solid, profile, profile.name + " · Follow Me");
  } finally {
    solid.delete();
  }
}
