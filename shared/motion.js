import { Vector3, Euler, Quaternion, Matrix3, Matrix4, Box3 } from "three";
import { OBB } from "three/addons/math/OBB.js";
import { bounds } from "./geometry.js";
import { translateAssembly } from "./assemblies.js";

const rad = (n) => (n * Math.PI) / 180;
const solid = (o) => !o.isFace && !["line", "dimension"].includes(o.kind);
// Reference hinges/runners intentionally intersect their mounting surfaces.
// Board envelopes are exact for rectangular panels and conservative for shaped meshes.
const collider = (o) =>
  solid(o) &&
  (o.role !== "hardware" ||
    /Pull handle|sliding pull|Desk leg|cabinet foot|Hanging rail/i.test(
      o.hardwareType || o.name,
    ));
export function partOBB(o, tolerance = 0.05) {
  return new OBB(
    new Vector3(...o.position),
    new Vector3(...o.size.map((n) => Math.max(0.001, n / 2 - tolerance))),
    new Matrix3().setFromMatrix4(
      new Matrix4().makeRotationFromEuler(new Euler(...o.rotation.map(rad))),
    ),
  );
}
export function overlaps(a, b) {
  return partOBB(a).intersectsOBB(partOBB(b));
}
export function jointKey(o) {
  if (!o.mechanism) return null;
  const key =
    o.mechanism.jointId ||
    o.partKey?.replace(
      /\/(front|side-?\d+|end-?\d+|bottom|handle|hinge.*|lift.*)$/,
      "",
    ) ||
    o.id;
  return (o.furnitureId || "manual") + ":" + key;
}
export function motionJoints(objects) {
  const groups = new Map();
  for (const o of objects) {
    const key = jointKey(o);
    if (!key) continue;
    if (!groups.has(key))
      groups.set(key, {
        key,
        parts: [],
        type: o.mechanism.type || "door",
        name: o.name,
      });
    const g = groups.get(key);
    g.parts.push(o);
    if (["drawer", "drawer-front"].includes(o.role)) {
      g.type = "drawer";
      g.name = "Drawer";
    }
    if (o.role === "door") g.name = o.name;
  }
  return [...groups.values()];
}
export function posePart(o, fraction) {
  const m = o.mechanism;
  if (m.kind === "slide")
    return {
      ...o,
      position: m.closedPosition.map(
        (v, i) => v + m.direction[i] * m.travel * fraction,
      ),
      rotation: [...m.closedRotation],
    };
  const turn = new Quaternion().setFromAxisAngle(
    new Vector3(...(m.axis || [0, 0, 1])).normalize(),
    rad(m.angle * fraction),
  );
  const position = new Vector3(...m.closedPosition)
    .sub(new Vector3(...m.pivot))
    .applyQuaternion(turn)
    .add(new Vector3(...m.pivot))
    .toArray();
  const q = turn.multiply(
    new Quaternion().setFromEuler(new Euler(...m.closedRotation.map(rad))),
  );
  const e = new Euler().setFromQuaternion(q);
  return {
    ...o,
    position,
    rotation: [e.x, e.y, e.z].map((n) => (n * 180) / Math.PI),
  };
}
function applyPose(parts, fraction) {
  for (const o of parts) {
    const p = posePart(o, fraction);
    o.position = p.position;
    o.rotation = p.rotation;
    o.mechanism.appliedFraction = fraction;
  }
}
export function closedIntersections(objects, limit = 30) {
  const parts = objects.filter(collider),
    boxes = parts.map((o) => partOBB(o));
  const issues = [];
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      if (boxes[i].intersectsOBB(boxes[j]))
        issues.push({
          a: parts[i].id,
          b: parts[j].id,
          message: parts[i].name + " intersects " + parts[j].name,
        });
      if (issues.length >= limit) return issues;
    }
  return issues;
}

// Sweep each rigid joint in increments of at most 2 mm at its farthest vertex.
// Stop at the first obstruction; never teleport past a door or stretch a panel.
function moveJoint(project, joint, target, from = 0) {
  const ids = new Set(joint.parts.map((o) => o.id));
  const moving = joint.parts.filter(collider);
  const obstacles = project.objects
    .filter((o) => !ids.has(o.id) && collider(o))
    .map((o) => ({ o, box: partOBB(o) }));
  const distance = Math.max(
    1,
    ...joint.parts.map((o) => {
      const m = o.mechanism;
      return m.kind === "slide"
        ? Math.abs(m.travel)
        : Math.abs(rad(m.angle)) *
            (new Vector3(...m.closedPosition).distanceTo(
              new Vector3(...m.pivot),
            ) +
              Math.hypot(...o.size) / 2);
    }),
  );
  const count = Math.max(
    1,
    Math.ceil((Math.abs(target - from) * distance) / 2),
  );
  let actual = from,
    hit;
  for (let step = 1; step <= count; step++) {
    const next = from + ((target - from) * step) / count;
    hit = undefined;
    for (const o of moving) {
      const box = partOBB(posePart(o, next));
      hit = obstacles.find((v) => box.intersectsOBB(v.box));
      if (hit) break;
    }
    if (hit) break;
    actual = next;
  }
  // An enclosed drawer is interlocked until the entire requested path clears
  // every door, including a second hinged leaf or a stacked sliding leaf.
  if (
    joint.type === "drawer" &&
    target > from &&
    hit &&
    (hit.o.role === "door" || hit.o.mechanism?.type === "door")
  )
    actual = from;
  applyPose(joint.parts, actual);
  return {
    key: joint.key,
    name: joint.name,
    requested: target,
    actual,
    blocked: Math.abs(actual - target) > 1e-6,
    ...(hit ? { obstacle: hit.o.name, obstacleId: hit.o.id } : {}),
  };
}

export function openFurnitureSafely(project, id, fraction, access = "right") {
  const objects = project.objects.filter((o) => o.furnitureId === id),
    joints = motionJoints(objects);
  if (objects.some((o) => o.mechanism && o.locked))
    throw Error("Unlock the furniture fronts before opening or closing them");
  // Old saved sliding assemblies had one permanently fixed leaf. Repair the travel
  // metadata without regenerating or discarding any edited part geometry.
  for (const j of joints) {
    const door = j.parts.find(
      (o) => o.role === "door" && /sliding[01]$/.test(o.partKey || ""),
    );
    if (!door) continue;
    const index = Number(door.partKey.slice(-1)),
      active = access === "left" ? index === 0 : index === 1;
    const q = new Quaternion().setFromEuler(
      new Euler(...door.mechanism.closedRotation.map(rad)),
    );
    const direction = new Vector3(index === 0 ? 1 : -1, 0, 0)
      .applyQuaternion(q)
      .toArray();
    for (const o of j.parts) {
      o.mechanism.travel = door.size[0] - 25;
      o.mechanism.direction = direction;
    }
    j.accessActive = active;
  }
  joints.forEach((j) => applyPose(j.parts, 0));
  const issues = [];
  const doors = joints.filter((j) => j.type !== "drawer"),
    drawers = joints.filter((j) => j.type === "drawer");
  const doorAmount = Math.min(1, fraction / 0.55),
    drawerAmount = doors.length
      ? Math.max(0, (fraction - 0.55) / 0.45)
      : fraction;
  for (const j of doors)
    issues.push(
      moveJoint(project, j, j.accessActive === false ? 0 : doorAmount),
    );
  for (const j of drawers) issues.push(moveJoint(project, j, drawerAmount));
  return { joints: issues, blocked: issues.filter((i) => i.blocked) };
}

export function unreachableSlidingDrawers(project, id) {
  const ids = new Set(
    project.objects
      .filter((o) => o.furnitureId === id && o.role === "drawer-front")
      .map((o) => o.id),
  );
  for (const access of ["left", "right"]) {
    const copy = structuredClone(project);
    openFurnitureSafely(copy, id, 1, access);
    copy.objects
      .filter((o) => ids.has(o.id) && o.mechanism.appliedFraction > 0.999)
      .forEach((o) => ids.delete(o.id));
  }
  return [...ids];
}

export function setJointOpen(project, key, fraction) {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw Error("Opening must be between 0 and 1");
  const joint = motionJoints(project.objects).find((j) => j.key === key);
  if (!joint) throw Error("Select a hinge or slide joint");
  if (joint.parts.some((o) => o.locked))
    throw Error("Unlock the moving parts first");
  return moveJoint(
    project,
    joint,
    fraction,
    joint.parts[0].mechanism.appliedFraction || 0,
  );
}

export function attachJoint(project, selection, input) {
  const parts = project.objects.filter((o) => selection.includes(o.id));
  if (!parts.length || parts.some((o) => o.locked || !solid(o)))
    throw Error("Select unlocked solid moving parts only");
  if (new Set(parts.map((o) => o.furnitureId || null)).size > 1)
    throw Error("Attach a joint within one assembly at a time");
  if (
    !["hinge", "slide"].includes(input.kind) ||
    !["door", "drawer"].includes(input.type)
  )
    throw Error("Choose a hinge or slide");
  for (const k of ["pivot", "axis", "direction"])
    if (
      !Array.isArray(input[k]) ||
      input[k].length !== 3 ||
      !input[k].every(Number.isFinite)
    )
      throw Error("Invalid joint axis or pivot");
  if (
    Math.hypot(...input.axis) < 0.99 ||
    Math.hypot(...input.direction) < 0.99 ||
    !Number.isFinite(input.angle) ||
    Math.abs(input.angle) > 180 ||
    !Number.isFinite(input.travel) ||
    input.travel < 0 ||
    input.travel > 5000
  )
    throw Error("Use a valid axis, angle (±180°) and travel (0–5000 mm)");
  const jointId = crypto.randomUUID();
  for (const o of parts)
    o.mechanism = {
      ...input,
      jointId,
      manual: true,
      appliedFraction: 0,
      axis: new Vector3(...input.axis).normalize().toArray(),
      direction: new Vector3(...input.direction).normalize().toArray(),
      closedPosition: [...o.position],
      closedRotation: [...o.rotation],
    };
  return jointKey(parts[0]);
}

export function placeBeside(items, existing, clearance = 150) {
  const current = existing.filter(
      (o) => solid(o) && o.visible !== false && o.layer !== "Architecture",
    ),
    incoming = items.objects.filter(solid);
  if (!current.length || !incoming.length) return items;
  const a = new Box3(),
    b = new Box3();
  current.forEach((o) => a.union(bounds(o)));
  incoming.forEach((o) => b.union(bounds(o)));
  return translateAssembly(items, [a.max.x + clearance - b.min.x, 0, 0]);
}

export async function inspectClearance(objects) {
  const candidates = closedIntersections(objects, Infinity),
    byId = new Map(objects.map((o) => [o.id, o]));
  const results = [];
  for (const issue of candidates) {
    const a = byId.get(issue.a),
      b = byId.get(issue.b);
    if (a.kind === "box" && b.kind === "box") {
      results.push({ ...issue, certainty: "confirmed" });
      continue;
    }
    let sa, sb, overlap;
    try {
      const kernel = await import("./solid-kernel.js");
      await kernel.initKernel();
      sa = kernel.toSolid(a);
      sb = kernel.toSolid(b);
      overlap = sa.intersect(sb);
      if (overlap.volume() > 0.01)
        results.push({
          ...issue,
          certainty: "confirmed",
          volume: overlap.volume(),
        });
    } catch {
      results.push({
        ...issue,
        certainty: "envelope",
        message:
          issue.message + " — mesh envelope only; closed solid unavailable",
      });
    } finally {
      overlap?.delete();
      sa?.delete();
      sb?.delete();
    }
  }
  return results;
}
