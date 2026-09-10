import Module from "manifold-3d";
import * as T from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { entity } from "./model.js";
import { objectGeometry, objectMatrix } from "./geometry.js";

let wasm, pending;
export function initKernel(options) {
  return (pending ||= Module(options).then((module) => {
    module.setup();
    wasm = module;
    return module;
  }));
}
export function kernel() {
  if (!wasm)
    throw Error(
      "The solid modelling engine is loading. Try again in a moment.",
    );
  return wasm;
}

export function weldedGeometry(o, world = true) {
  const geometry = objectGeometry(o);
  for (const name of Object.keys(geometry.attributes))
    if (name !== "position") geometry.deleteAttribute(name);
  if (world) geometry.applyMatrix4(objectMatrix(o));
  const welded = mergeVertices(geometry, 0.00001);
  geometry.dispose();
  return welded;
}

export function toSolid(o) {
  if (!["box", "profile", "cylinder", "mesh"].includes(o.kind) || o.isFace)
    throw Error("Solid tools need closed 3D solids");
  const { Manifold, Mesh } = kernel(),
    geometry = weldedGeometry(o);
  try {
    const mesh = new Mesh({
      numProp: 3,
      vertProperties: new Float32Array(geometry.attributes.position.array),
      triVerts: new Uint32Array(geometry.index.array),
    });
    mesh.merge();
    const solid = new Manifold(mesh);
    if (solid.status() !== "NoError") {
      const status = solid.status();
      solid.delete();
      throw Error("This object is not a closed solid: " + status);
    }
    return solid;
  } finally {
    geometry.dispose();
  }
}

export function meshEntity(solid, source = {}, name = "Solid") {
  if (solid.isEmpty()) return null;
  const transform = objectMatrix({
      position: source.position || [0, 0, 0],
      rotation: source.rotation || [0, 0, 0],
    }),
    local = solid.transform(transform.clone().invert().elements);
  const data = local.getMesh(),
    vertices = [];
  const box = local.boundingBox(),
    center = box.min.map((v, i) => (v + box.max[i]) / 2),
    position = new T.Vector3(...center).applyMatrix4(transform).toArray();
  const size = box.min.map((v, i) => Math.max(0.1, box.max[i] - v));
  for (let i = 0; i < data.vertProperties.length; i += data.numProp)
    for (let a = 0; a < 3; a++)
      vertices.push(data.vertProperties[i + a] - center[a]);
  local.delete();
  const result = entity({
    kind: "mesh",
    name,
    vertices,
    triangles: Array.from(data.triVerts),
    meshSize: [...size],
    size,
    position,
    rotation: source.rotation ? [...source.rotation] : [0, 0, 0],
    material: source.material || "oak",
    layer: source.layer || "Furniture",
    groupId: source.groupId || null,
    solid: true,
  });
  for (const key of [
    "furnitureId",
    "partKey",
    "role",
    "fabrication",
    "mechanism",
    "machining",
  ])
    if (source[key] != null) result[key] = structuredClone(source[key]);
  if (result.mechanism) {
    const m = result.mechanism;
    m.closedPosition = new T.Vector3(...center)
      .applyEuler(
        new T.Euler(...m.closedRotation.map((n) => (n * Math.PI) / 180)),
      )
      .add(new T.Vector3(...m.closedPosition))
      .toArray();
  }
  return result;
}

export function booleanObjects(objects, operation) {
  if (objects.length < 2 || objects.some((o) => o.locked))
    throw Error("Select at least two unlocked solids");
  if (
    ![
      "union",
      "subtract",
      "intersect",
      "trim",
      "split",
      "outer-shell",
    ].includes(operation)
  )
    throw Error("Unknown solid operation");
  const solids = [];
  try {
    objects.forEach((o) => solids.push(toSolid(o)));
    if (operation === "split") {
      if (solids.length !== 2) throw Error("Split needs exactly two solids");
      const pieces = [
        solids[0].subtract(solids[1]),
        solids[0].intersect(solids[1]),
        solids[1].subtract(solids[0]),
      ];
      try {
        return pieces
          .map((s, i) =>
            meshEntity(
              s,
              objects[i === 2 ? 1 : 0],
              ["First remainder", "Intersection", "Second remainder"][i],
            ),
          )
          .filter(Boolean);
      } finally {
        pieces.forEach((s) => s.delete());
      }
    }
    let result = solids[0];
    for (let i = 1; i < solids.length; i++) {
      const next = ["union", "outer-shell"].includes(operation)
        ? result.add(solids[i])
        : operation === "intersect"
          ? result.intersect(solids[i])
          : result.subtract(solids[i]);
      if (result !== solids[0]) result.delete();
      result = next;
    }
    try {
      return [
        meshEntity(
          result,
          objects[0],
          {
            union: "Union",
            subtract: "Subtract",
            intersect: "Intersection",
            trim: "Trim",
            "outer-shell": "Outer shell",
          }[operation],
        ),
      ].filter(Boolean);
    } finally {
      if (result !== solids[0]) result.delete();
    }
  } finally {
    solids.forEach((s) => s.delete());
  }
}

export function frameFromNormal(normal, origin) {
  const n = new T.Vector3(...normal).normalize();
  const u =
    Math.abs(n.z) > 0.9
      ? new T.Vector3(1, 0, 0)
      : new T.Vector3(0, 0, 1).cross(n).normalize();
  const v = n.clone().cross(u).normalize();
  const matrix = new T.Matrix4()
    .makeBasis(u, v, n)
    .setPosition(new T.Vector3(...origin));
  return { u, v, n, origin: new T.Vector3(...origin), matrix };
}

export function faceRegion(o, triangle = 0) {
  const geometry = weldedGeometry(o),
    positions = geometry.attributes.position,
    indices = geometry.index.array;
  try {
    if (triangle < 0 || triangle * 3 + 2 >= indices.length)
      throw Error("Select a planar face");
    const at = (i) => new T.Vector3().fromBufferAttribute(positions, i);
    const normalAt = (t) =>
      new T.Triangle(
        at(indices[t * 3]),
        at(indices[t * 3 + 1]),
        at(indices[t * 3 + 2]),
      ).getNormal(new T.Vector3());
    const n = normalAt(triangle),
      origin = at(indices[triangle * 3]),
      neighbors = new Map();
    for (let t = 0; t < indices.length / 3; t++)
      for (let k = 0; k < 3; k++) {
        const a = indices[t * 3 + k],
          b = indices[t * 3 + ((k + 1) % 3)],
          key = [Math.min(a, b), Math.max(a, b)].join(":");
        if (!neighbors.has(key)) neighbors.set(key, []);
        neighbors.get(key).push(t);
      }
    const selected = new Set([triangle]),
      queue = [triangle];
    while (queue.length) {
      const t = queue.pop();
      for (let k = 0; k < 3; k++) {
        const a = indices[t * 3 + k],
          b = indices[t * 3 + ((k + 1) % 3)],
          key = [Math.min(a, b), Math.max(a, b)].join(":");
        for (const candidate of neighbors.get(key))
          if (
            !selected.has(candidate) &&
            normalAt(candidate).dot(n) > 0.999999 &&
            Math.abs(
              at(indices[candidate * 3])
                .sub(origin)
                .dot(n),
            ) < 0.001
          ) {
            selected.add(candidate);
            queue.push(candidate);
          }
      }
    }
    const boundary = [];
    for (const t of selected)
      for (let k = 0; k < 3; k++) {
        const a = indices[t * 3 + k],
          b = indices[t * 3 + ((k + 1) % 3)],
          key = [Math.min(a, b), Math.max(a, b)].join(":");
        if (neighbors.get(key).filter((v) => selected.has(v)).length === 1)
          boundary.push([a, b]);
      }
    const frame = frameFromNormal(n.toArray(), origin.toArray()),
      loops = [];
    while (boundary.length) {
      const edge = boundary.shift(),
        loop = [edge[0]],
        start = edge[0];
      let end = edge[1];
      while (end !== start) {
        loop.push(end);
        const next = boundary.findIndex((v) => v[0] === end);
        if (next < 0) throw Error("This face boundary is open or non-manifold");
        end = boundary.splice(next, 1)[0][1];
      }
      loops.push(
        loop.map((i) => {
          const p = at(i).sub(origin);
          return [p.dot(frame.u), p.dot(frame.v)];
        }),
      );
    }
    return { ...frame, loops, triangles: [...selected] };
  } finally {
    geometry.dispose();
  }
}

export function faceProfiles(region, contours, source, name) {
  const { CrossSection } = kernel(),
    cross = new CrossSection(contours, "EvenOdd");
  const parts = cross.decompose();
  try {
    return parts.map((part) => {
      const area = (loop) =>
        Math.abs(
          loop.reduce((sum, p, i) => {
            const q = loop[(i + 1) % loop.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        );
      const loops = part.toPolygons().sort((a, b) => area(b) - area(a)),
        all = loops.flat(),
        min = [0, 1].map((a) => Math.min(...all.map((p) => p[a]))),
        max = [0, 1].map((a) => Math.max(...all.map((p) => p[a])));
      const center = min.map((v, a) => (v + max[a]) / 2),
        position = region.origin
          .clone()
          .addScaledVector(region.u, center[0])
          .addScaledVector(region.v, center[1]);
      const rotation = new T.Euler().setFromRotationMatrix(region.matrix);
      return entity({
        kind: "profile",
        name,
        profile: loops[0].map((p) => p.map((v, a) => v - center[a])),
        holes: loops
          .slice(1)
          .map((h) => h.map((p) => p.map((v, a) => v - center[a]))),
        size: [max[0] - min[0], max[1] - min[1], 0.1],
        position: position.toArray(),
        rotation: [rotation.x, rotation.y, rotation.z].map(
          (v) => (v * 180) / Math.PI,
        ),
        material: source.material,
        layer: source.layer,
        groupId: source.groupId,
        isFace: true,
        thinAxis: 2,
        ...(source.hostId || !source.isFace
          ? { hostId: source.hostId || source.id }
          : {}),
      });
    });
  } finally {
    parts.forEach((p) => p.delete());
    cross.delete();
  }
}

export function offsetFace(o, triangle, distance) {
  if (o.locked || !Number.isFinite(distance) || Math.abs(distance) < 0.001)
    throw Error("Choose an unlocked face and a non-zero offset");
  const region = faceRegion(o, triangle),
    { CrossSection } = kernel(),
    original = new CrossSection(region.loops, "EvenOdd");
  const offset = original.offset(distance, "Miter", 10),
    ring = distance < 0 ? original.subtract(offset) : offset.subtract(original);
  try {
    if (offset.isEmpty())
      throw Error("The offset consumes this face. Use a smaller distance.");
    const inner = faceProfiles(
      region,
      distance < 0 ? offset.toPolygons() : original.toPolygons(),
      o,
      "Offset face",
    );
    const border = faceProfiles(region, ring.toPolygons(), o, "Offset border");
    return [...inner, ...border];
  } finally {
    original.delete();
    offset.delete();
    ring.delete();
  }
}

export function pushPullRegion(o, triangle, distance, faceSource = o) {
  if (!Number.isFinite(distance) || Math.abs(distance) < 0.001)
    throw Error("Enter a non-zero distance");
  if (o.locked || faceSource.locked)
    throw Error("Unlock the object before editing its faces");
  const region = faceRegion(faceSource, triangle),
    { CrossSection } = kernel(),
    cross = new CrossSection(region.loops, "EvenOdd");
  const prism = cross.extrude(Math.abs(distance)),
    local = distance < 0 ? prism.translate([0, 0, distance]) : prism;
  const world = local.transform(region.matrix.elements),
    source = toSolid(o);
  try {
    const result = distance > 0 ? source.add(world) : source.subtract(world);
    try {
      return meshEntity(result, o, o.name);
    } finally {
      result.delete();
    }
  } finally {
    source.delete();
    world.delete();
    if (local !== prism) local.delete();
    prism.delete();
    cross.delete();
  }
}
