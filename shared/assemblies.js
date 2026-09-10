import { Matrix4, Vector3, Quaternion, Euler } from "three";
import { clone } from "./model.js";
const rad = (n) => (n * Math.PI) / 180;
const matrix = (o) =>
  new Matrix4().compose(
    new Vector3(...o.position),
    new Quaternion().setFromEuler(new Euler(...o.rotation.map(rad))),
    new Vector3(1, 1, 1),
  );
const equal = (a, b) =>
  a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.002);
export function hasShear(transform) {
  const basis = [0, 1, 2].map((i) =>
    new Vector3().setFromMatrixColumn(transform, i).normalize(),
  );
  return (
    Math.abs(basis[0].dot(basis[1])) > 1e-6 ||
    Math.abs(basis[0].dot(basis[2])) > 1e-6 ||
    Math.abs(basis[1].dot(basis[2])) > 1e-6
  );
}
export function groupDescendants(project, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const g of project.groups)
      if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) {
        ids.add(g.id);
        changed = true;
      }
  }
  return ids;
}
export function groupObjects(project, id) {
  const groups = groupDescendants(project, id);
  return project.objects.filter(
    (o) => groups.has(o.groupId) || o.furnitureId === id,
  );
}
export function pruneGroups(project, available = project.groups) {
  const map = new Map(available.map((g) => [g.id, g])),
    keep = new Set(
      project.objects
        .flatMap((o) => [o.groupId, o.furnitureId])
        .filter((id) => map.has(id)),
    );
  for (const id of keep) {
    let parent = map.get(id)?.parentId;
    const seen = new Set([id]);
    while (parent && map.has(parent) && !seen.has(parent)) {
      keep.add(parent);
      seen.add(parent);
      parent = map.get(parent)?.parentId;
    }
  }
  project.groups = [...map.values()].filter((g) => keep.has(g.id));
  return project;
}
export function selectionProject(project, selection) {
  const copy = {
    ...clone(project),
    objects: clone(project.objects.filter((o) => selection.includes(o.id))),
  };
  pruneGroups(copy);
  for (const g of copy.groups.filter((g) => g.furnitureSpec))
    if (
      copy.objects.filter((o) => o.furnitureId === g.id).length !==
      project.objects.filter((o) => o.furnitureId === g.id).length
    ) {
      delete g.furnitureSpec;
      copy.objects
        .filter((o) => o.furnitureId === g.id)
        .forEach((o) => {
          delete o.furnitureId;
          delete o.mechanism;
        });
    }
  return copy;
}
export function translateAssembly(items, delta) {
  const move = (v) => v.map((n, i) => n + delta[i]);
  items.objects.forEach((o) => {
    o.position = move(o.position);
    if (o.mechanism) {
      o.mechanism.pivot = move(o.mechanism.pivot);
      o.mechanism.closedPosition = move(o.mechanism.closedPosition);
    }
  });
  items.groups?.forEach((g) => {
    if (g.furnitureSpec) {
      g.furnitureSpec.x += delta[0];
      g.furnitureSpec.y += delta[1];
      g.furnitureSpec.elevation += delta[2];
    }
  });
  return items;
}
export function reconcileFurnitureEdits(previous, next) {
  const oldObjects = new Map(previous.objects.map((o) => [o.id, o]));
  const changedConfigs = new Set(
    next.groups
      .filter(
        (g) =>
          g.furnitureSpec &&
          JSON.stringify(g.furnitureSpec) !==
            JSON.stringify(
              previous.groups.find((v) => v.id === g.id)?.furnitureSpec,
            ),
      )
      .map((g) => g.id),
  );
  for (const o of next.objects) {
    const old = oldObjects.get(o.id),
      m = o.mechanism;
    if (
      !old?.mechanism ||
      !m ||
      changedConfigs.has(o.furnitureId) ||
      JSON.stringify(old.mechanism) !== JSON.stringify(m) ||
      (equal(o.position, old.position) && equal(o.rotation, old.rotation))
    )
      continue;
    const delta = matrix(o).multiply(matrix(old).invert()),
      closed = delta
        .clone()
        .multiply(
          matrix({ position: m.closedPosition, rotation: m.closedRotation }),
        ),
      pos = new Vector3(),
      q = new Quaternion(),
      scale = new Vector3();
    closed.decompose(pos, q, scale);
    const e = new Euler().setFromQuaternion(q);
    m.closedPosition = pos.toArray();
    m.closedRotation = [e.x, e.y, e.z].map((n) => (n * 180) / Math.PI);
    m.pivot = new Vector3(...m.pivot).applyMatrix4(delta).toArray();
    m.direction = new Vector3(...m.direction)
      .transformDirection(delta)
      .toArray();
    m.axis = new Vector3(...(m.axis || [0, 0, 1]))
      .transformDirection(delta)
      .toArray();
  }
  for (const g of next.groups.filter(
    (g) => g.furnitureSpec && !changedConfigs.has(g.id),
  )) {
    const before = previous.objects.filter((o) => o.furnitureId === g.id),
      after = next.objects.filter((o) => o.furnitureId === g.id);
    if (!before.length || before.length !== after.length) continue;
    const first = after[0],
      old = oldObjects.get(first.id);
    if (!old || !equal(first.size, old.size)) continue;
    const delta = matrix(first).multiply(matrix(old).invert());
    if (
      !after.every((o) => {
        const old = oldObjects.get(o.id);
        if (!old || !equal(old.size, o.size)) return false;
        return equal(
          matrix(o).elements,
          delta.clone().multiply(matrix(old)).elements,
        );
      })
    )
      continue;
    const q = new Quaternion().setFromRotationMatrix(delta),
      e = new Euler().setFromQuaternion(q);
    if (Math.abs(e.x) > 1e-5 || Math.abs(e.y) > 1e-5) continue;
    const spec = g.furnitureSpec,
      origin = new Vector3(spec.x, spec.y, spec.elevation).applyMatrix4(delta);
    [spec.x, spec.y, spec.elevation] = origin.toArray();
    spec.rotation += (e.z * 180) / Math.PI;
  }
}
