import { Vector3, Quaternion, Euler } from "three";
import { entity } from "./model.js";
import { objectMatrix } from "./geometry.js";
import { initKernel, toSolid, meshEntity } from "./solid-kernel.js";
export async function machinePanel(part, spec) {
  if (
    !part ||
    part.locked ||
    !["box", "profile", "mesh"].includes(part.kind) ||
    part.isFace
  )
    throw Error("Select one unlocked solid panel");
  const { type, axis, side, u, v, depth, through } = spec;
  if (
    !["drill", "pocket"].includes(type) ||
    !Number.isInteger(axis) ||
    axis < 0 ||
    axis > 2 ||
    ![-1, 1].includes(side)
  )
    throw Error("Choose a panel face and machining operation");
  const plane = [0, 1, 2].filter((i) => i !== axis),
    [a, b] = plane;
  for (const [key, value] of Object.entries(spec))
    if (
      typeof value === "number" &&
      (!Number.isFinite(value) || Math.abs(value) > 1e8)
    )
      throw Error("Invalid machining measurement: " + key);
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || v < 0)
    throw Error("Offsets must be non-negative");
  const cutDepth = through ? part.size[axis] + 0.4 : depth + 0.2;
  if (
    !through &&
    (!Number.isFinite(depth) || depth <= 0 || depth >= part.size[axis])
  )
    throw Error(
      "Blind cut depth must be positive and less than the panel thickness",
    );
  // Cut in panel coordinates to avoid losing precision when a thin board is
  // rotated or placed far from the model origin.
  const workPart = { ...part, position: [0, 0, 0], rotation: [0, 0, 0] },
    normal = new Vector3().setComponent(axis, side),
    baseRotation = new Quaternion(),
    world = objectMatrix(workPart),
    cutters = [];
  function cutter(position, size, kind = "box") {
    const q =
        kind === "cylinder"
          ? baseRotation
              .clone()
              .multiply(
                new Quaternion().setFromUnitVectors(
                  new Vector3(0, 0, 1),
                  normal,
                ),
              )
          : baseRotation.clone(),
      e = new Euler().setFromQuaternion(q);
    cutters.push(
      entity({
        kind,
        position: new Vector3(...position).applyMatrix4(world).toArray(),
        rotation: [e.x, e.y, e.z].map((n) => (n * 180) / Math.PI),
        size,
      }),
    );
  }
  const center = through ? 0 : side * (part.size[axis] / 2 - depth / 2 + 0.1);
  if (type === "drill") {
    const {
      diameter,
      countU = 1,
      countV = 1,
      spacingU = 32,
      spacingV = 32,
    } = spec;
    if (
      !Number.isFinite(diameter) ||
      diameter <= 0 ||
      !Number.isInteger(countU) ||
      !Number.isInteger(countV) ||
      countU < 1 ||
      countV < 1 ||
      countU * countV > 100
    )
      throw Error("Use a positive hole diameter and 1–100 holes");
    if (
      (countU > 1 && (!Number.isFinite(spacingU) || spacingU <= diameter)) ||
      (countV > 1 && (!Number.isFinite(spacingV) || spacingV <= diameter))
    )
      throw Error("Hole spacing must exceed the diameter");
    for (let i = 0; i < countU; i++)
      for (let j = 0; j < countV; j++) {
        const x = u + i * spacingU,
          y = v + j * spacingV,
          r = diameter / 2;
        if (
          x - r < 0 ||
          y - r < 0 ||
          x + r > part.size[a] ||
          y + r > part.size[b]
        )
          throw Error("The hole pattern must fit within the panel face");
        const p = [0, 0, 0];
        p[axis] = center;
        p[a] = x - part.size[a] / 2;
        p[b] = y - part.size[b] / 2;
        cutter(p, [diameter, diameter, cutDepth], "cylinder");
      }
  } else {
    const { width, height } = spec;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      u + width > part.size[a] ||
      v + height > part.size[b]
    )
      throw Error("The pocket must fit within the panel face");
    const p = [0, 0, 0],
      size = [0, 0, 0];
    p[axis] = center;
    p[a] = u + width / 2 - part.size[a] / 2;
    p[b] = v + height / 2 - part.size[b] / 2;
    size[axis] = cutDepth;
    size[a] = width;
    size[b] = height;
    cutter(p, size);
  }
  await initKernel();
  let result = toSolid(workPart);
  const originalVolume = result.volume();
  try {
    for (const cutter of cutters) {
      const tool = toSolid(cutter);
      try {
        const next = result.subtract(tool);
        result.delete();
        result = next;
      } finally {
        tool.delete();
      }
    }
    if (result.isEmpty()) throw Error("This cut would remove the whole panel");
    if (Math.abs(originalVolume - result.volume()) < 0.0001)
      throw Error("The cutter does not intersect remaining material");
    const object = meshEntity(result, workPart, part.name);
    object.id = part.id;
    object.position = new Vector3(...object.position)
      .applyMatrix4(objectMatrix(part))
      .toArray();
    object.rotation = [...part.rotation];
    object.fabrication = part.fabrication || {
      thicknessAxis: axis,
      edgeBanding: 0,
      grain: true,
    };
    object.machining = [
      ...(part.machining || []),
      { ...spec, holes: type === "drill" ? cutters.length : 0 },
    ];
    return object;
  } finally {
    result.delete();
  }
}
