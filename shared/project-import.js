import { clone, uid, validateProject } from "./model.js";
export function instantiateProject(source, target) {
  validateProject(source);
  const copy = clone(source),
    objects = new Map(copy.objects.map((o) => [o.id, uid()])),
    groups = new Map(copy.groups.map((g) => [g.id, uid()]));
  const materials = [],
    materialIds = new Map();
  for (const m of copy.materials || []) {
    const existing = target.materials?.find((v) => v.id === m.id);
    const id =
      existing && JSON.stringify(existing) !== JSON.stringify(m) ? uid() : m.id;
    materialIds.set(m.id, id);
    if (!existing || id !== m.id) materials.push({ ...m, id });
  }
  for (const o of copy.objects) {
    o.id = objects.get(o.id);
    o.groupId = groups.get(o.groupId) || null;
    if (o.furnitureId) o.furnitureId = groups.get(o.furnitureId) || null;
    if (o.hostId) o.hostId = objects.get(o.hostId);
    o.material = materialIds.get(o.material) || o.material;
    if (o.faceGroups)
      o.faceGroups.forEach(
        (g) => (g.material = materialIds.get(g.material) || g.material),
      );
    o.faceMaterials = Object.fromEntries(
      Object.entries(o.faceMaterials || {}).map(([key, id]) => [
        key,
        materialIds.get(id) || id,
      ]),
    );
    if (o.anchors)
      o.anchors = o.anchors.map((a) =>
        a ? { ...a, id: objects.get(a.id) || a.id } : a,
      );
  }
  copy.groups.forEach((g) => {
    g.id = groups.get(g.id);
    if (g.parentId) g.parentId = groups.get(g.parentId) || null;
    if (g.furnitureSpec)
      for (const key of [
        "material",
        "frontMaterial",
        "backMaterial",
        "worktopMaterial",
        "hardwareMaterial",
      ])
        g.furnitureSpec[key] =
          materialIds.get(g.furnitureSpec[key]) || g.furnitureSpec[key];
  });
  const layers = copy.layers.filter(
    (l) => !target.layers.some((t) => t.id === l.id),
  );
  return { objects: copy.objects, groups: copy.groups, materials, layers };
}
