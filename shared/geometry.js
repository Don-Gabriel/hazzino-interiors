import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export const radians = (n) => (n * Math.PI) / 180;
export function objectMatrix(o) {
  return new T.Matrix4().compose(
    new T.Vector3(...o.position),
    new T.Quaternion().setFromEuler(new T.Euler(...o.rotation.map(radians))),
    new T.Vector3(1, 1, 1),
  );
}
export function boxFeatures(o) {
  const matrix = objectMatrix(o),
    half = o.size.map((n) => n / 2),
    corners = [];
  for (let x of [-1, 1])
    for (let y of [-1, 1])
      for (let z of [-1, 1])
        corners.push(
          new T.Vector3(x * half[0], y * half[1], z * half[2]).applyMatrix4(
            matrix,
          ),
        );
  const edges = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++)
      if ([1, 2, 4].includes(i ^ j)) edges.push([corners[i], corners[j]]);
  const faces = [];
  for (let axis = 0; axis < 3; axis++)
    for (let sign of [-1, 1])
      faces.push(
        new T.Vector3()
          .setComponent(axis, sign * half[axis])
          .applyMatrix4(matrix),
      );
  return {
    corners,
    edges,
    midpoints: edges.map(([a, b]) => a.clone().add(b).multiplyScalar(0.5)),
    faces,
    center: new T.Vector3(...o.position),
  };
}
export function bounds(o) {
  return new T.Box3().setFromPoints(boxFeatures(o).corners);
}
export function openingGeometry(o) {
  const [w, d, h] = o.size,
    openings = o.openings || [];
  if (!openings.length) return new T.BoxGeometry(w, d, h);
  const xs = [
      ...new Set([0, w, ...openings.flatMap((v) => [v.x, v.x + v.width])]),
    ].sort((a, b) => a - b),
    zs = [
      ...new Set([
        0,
        h,
        ...openings.flatMap((v) => [v.sill, v.sill + v.height]),
      ]),
    ].sort((a, b) => a - b);
  const filled = (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= zs.length - 1)
      return false;
    const x = (xs[i] + xs[i + 1]) / 2,
      z = (zs[j] + zs[j + 1]) / 2;
    return !openings.some(
      (v) =>
        x > v.x && x < v.x + v.width && z > v.sill && z < v.sill + v.height,
    );
  };
  const pieces = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      if (!filled(i, j)) continue;
      const x0 = xs[i],
        x1 = xs[i + 1],
        z0 = zs[j],
        z1 = zs[j + 1];
      const g = new T.BoxGeometry(x1 - x0, d, z1 - z0);
      g.translate((x0 + x1 - w) / 2, 0, (z0 + z1 - h) / 2);
      const keep = [
        !filled(i + 1, j),
        !filled(i - 1, j),
        true,
        true,
        !filled(i, j + 1),
        !filled(i, j - 1),
      ];
      const indices = [],
        groups = [];
      for (const group of g.groups) {
        if (!keep[group.materialIndex]) continue;
        const start = indices.length;
        for (let k = group.start; k < group.start + group.count; k++)
          indices.push(g.index.getX(k));
        groups.push({
          start,
          count: indices.length - start,
          materialIndex: group.materialIndex,
        });
      }
      g.setIndex(indices);
      g.clearGroups();
      groups.forEach((v) => g.addGroup(v.start, v.count, v.materialIndex));
      pieces.push(g);
    }
  if (!pieces.length) throw Error("Opening removes the entire solid");
  const geometry = mergeGeometries(pieces, false);
  geometry.clearGroups();
  let offset = 0;
  for (const g of pieces) {
    for (const group of g.groups)
      geometry.addGroup(offset + group.start, group.count, group.materialIndex);
    offset += g.index.count;
    g.dispose();
  }
  return geometry;
}
export function alignObjects(objects, axis, mode) {
  if (objects.length < 2) return [];
  const index = "XYZ".indexOf(axis);
  if (index < 0) throw Error("Invalid axis");
  const first = bounds(objects[0]);
  const target =
    mode === "min"
      ? first.min.getComponent(index)
      : mode === "max"
        ? first.max.getComponent(index)
        : first.getCenter(new T.Vector3()).getComponent(index);
  return objects.map((o) => {
    const b = bounds(o),
      at =
        mode === "min"
          ? b.min.getComponent(index)
          : mode === "max"
            ? b.max.getComponent(index)
            : b.getCenter(new T.Vector3()).getComponent(index);
    const position = [...o.position];
    position[index] += target - at;
    return { id: o.id, position };
  });
}
export function extrudeObject(o, amount, face) {
  if (o.locked || !["box", "profile"].includes(o.kind)) return o;
  if (!Number.isFinite(amount) || amount === 0)
    throw Error("Enter a non-zero extrusion distance");
  const copy = structuredClone(o);
  let axis = o.thinAxis ?? 2,
    sign = 1;
  if (!o.isFace && face && o.kind === "box") {
    axis = Math.floor(face.index / 2);
    sign = face.index % 2 === 0 ? 1 : -1;
  }
  if (o.kind === "profile") axis = 2;
  const old = o.size[axis],
    next = o.isFace ? Math.abs(amount) : old + amount;
  if (next < 0.1) throw Error("Push/Pull cannot invert a solid");
  copy.size[axis] = next;
  const shift = new T.Vector3().setComponent(
    axis,
    ((o.isFace ? next : next - old) / 2) *
      sign *
      (o.isFace && amount < 0 ? -1 : 1),
  );
  shift.applyEuler(new T.Euler(...o.rotation.map(radians)));
  copy.position = new T.Vector3(...o.position).add(shift).toArray();
  copy.isFace = false;
  copy.name = o.name === "Rectangle" ? "Board" : o.name;
  return copy;
}
export function healthCheck(project) {
  const solids = project.objects.filter(
    (o) => ["box", "cylinder", "profile"].includes(o.kind) && !o.isFace,
  );
  const warnings = [];
  for (const o of solids) {
    if (Math.min(...o.size) < 3)
      warnings.push({
        type: "thin",
        ids: [o.id],
        message: o.name + " has a dimension below 3 mm.",
      });
    if (
      o.position[2] - bounds(o).getSize(new T.Vector3()).z / 2 < -0.5 &&
      o.layer === "Furniture"
    )
      warnings.push({
        type: "below-floor",
        ids: [o.id],
        message: o.name + " extends below the floor.",
      });
  }
  for (let i = 0; i < solids.length; i++)
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i],
        b = solids[j];
      if (a.layer === "Architecture" || b.layer === "Architecture") continue;
      const overlap = bounds(a).intersect(bounds(b));
      if (!overlap.isEmpty()) {
        const d = overlap.getSize(new T.Vector3());
        if (Math.min(d.x, d.y, d.z) > 0.5)
          warnings.push({
            type: "overlap",
            ids: [a.id, b.id],
            message: a.name + " and " + b.name + " have overlapping bounds.",
          });
      }
      if (warnings.length >= 100) return warnings;
    }
  return warnings;
}
