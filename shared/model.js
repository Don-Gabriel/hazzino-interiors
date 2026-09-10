import { validateViews } from "./workspace.js";
import { meshMetrics, validateMesh } from "./mesh-data.js";
import { validateFurnitureSpec } from "./furniture.js";
export const uid = () => globalThis.crypto.randomUUID();
export const clone = (v) => structuredClone(v);
export const MATERIALS = [
  {
    id: "oak",
    name: "Natural oak",
    color: "#bb9166",
    roughness: 0.7,
    grain: true,
    rate: 1800,
  },
  {
    id: "walnut",
    name: "American walnut",
    color: "#65452e",
    roughness: 0.65,
    grain: true,
    rate: 2600,
  },
  {
    id: "plywood",
    name: "Birch plywood",
    color: "#dcc299",
    roughness: 0.85,
    grain: true,
    rate: 1200,
  },
  { id: "mdf", name: "MDF", color: "#b99a70", roughness: 0.9, rate: 650 },
  {
    id: "particleboard",
    name: "Particle board",
    color: "#bba17d",
    roughness: 0.95,
    rate: 600,
  },
  {
    id: "white",
    name: "Ivory laminate",
    color: "#e9e8df",
    roughness: 0.38,
    rate: 1500,
  },
  {
    id: "black",
    name: "Graphite laminate",
    color: "#303736",
    roughness: 0.42,
    rate: 1500,
  },
  {
    id: "sage",
    name: "Sage lacquer",
    color: "#8b9a81",
    roughness: 0.3,
    rate: 2100,
  },
  {
    id: "glass",
    name: "Clear glass",
    color: "#afcfd0",
    roughness: 0.06,
    opacity: 0.3,
    rate: 1700,
  },
  {
    id: "metal",
    name: "Brushed steel",
    color: "#87979d",
    roughness: 0.28,
    metalness: 0.85,
    rate: 3200,
  },
  {
    id: "concrete",
    name: "Concrete",
    color: "#b8b7b0",
    roughness: 0.95,
    rate: 400,
  },
  {
    id: "plaster",
    name: "Warm plaster",
    color: "#e4ded2",
    roughness: 0.95,
    rate: 250,
  },
  {
    id: "marble",
    name: "Calacatta stone",
    color: "#dedbd3",
    roughness: 0.25,
    rate: 4200,
  },
];
export function materialCatalog(project) {
  return [
    ...MATERIALS,
    ...(Array.isArray(project.materials) ? project.materials : []),
  ];
}
export function materialFor(project, id) {
  const base =
    materialCatalog(project).find((m) => m.id === id) || MATERIALS[0];
  return { ...base, ...(project.materialOverrides?.[base.id] || {}) };
}
export function entity(overrides = {}) {
  return {
    id: uid(),
    name: "Board",
    kind: "box",
    position: [0, 0, 300],
    rotation: [0, 0, 0],
    size: [600, 18, 600],
    material: "oak",
    faceMaterials: {},
    layer: "Furniture",
    groupId: null,
    visible: true,
    locked: false,
    ...overrides,
  };
}
export function blankProject(name = "Untitled design") {
  return {
    schemaVersion: 1,
    id: uid(),
    name,
    objects: [],
    groups: [],
    layers: [
      { id: "Furniture", visible: true },
      { id: "Architecture", visible: true },
      { id: "Annotations", visible: true },
    ],
    settings: { unit: "mm", grid: 100, snap: 10, currency: "INR", waste: 10 },
    views: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function validateProject(p) {
  if (
    !p ||
    p.schemaVersion !== 1 ||
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 200 ||
    !Array.isArray(p.objects) ||
    p.objects.length > 10000
  )
    throw Error(
      "Invalid project: expected a Hazzino version 1 project with up to 10,000 objects.",
    );
  const ids = new Set();
  const kinds = ["box", "cylinder", "line", "profile", "dimension", "mesh"];
  for (const o of p.objects) {
    if (
      !o ||
      typeof o.id !== "string" ||
      ids.has(o.id) ||
      !kinds.includes(o.kind) ||
      typeof o.name !== "string"
    )
      throw Error("Invalid or duplicate object.");
    ids.add(o.id);
    for (const k of ["position", "rotation", "size"])
      if (
        !Array.isArray(o[k]) ||
        o[k].length !== 3 ||
        o[k].some(
          (n) =>
            typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e8,
        )
      )
        throw Error(`Invalid ${k} on ${o.name}`);
    if (o.size.some((n) => n <= 0))
      throw Error("Dimensions must be greater than zero.");
    if (o.kind === "mesh") validateMesh(o);
    if (o.machining != null) {
      const finite = (n) =>
        typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e8;
      if (
        !Array.isArray(o.machining) ||
        o.machining.length > 1000 ||
        o.machining.some(
          (m) =>
            !m ||
            !["drill", "pocket"].includes(m.type) ||
            !Number.isInteger(m.axis) ||
            m.axis < 0 ||
            m.axis > 2 ||
            ![-1, 1].includes(m.side) ||
            !finite(m.u) ||
            m.u < 0 ||
            !finite(m.v) ||
            m.v < 0 ||
            typeof m.through !== "boolean" ||
            (!m.through && (!finite(m.depth) || m.depth <= 0)) ||
            (m.type === "drill" &&
              (!finite(m.diameter) ||
                m.diameter <= 0 ||
                !Number.isInteger(m.holes) ||
                m.holes < 1 ||
                m.holes > 100)) ||
            (m.type === "pocket" &&
              (!finite(m.width) ||
                m.width <= 0 ||
                !finite(m.height) ||
                m.height <= 0)),
        )
      )
        throw Error("Invalid panel machining record");
    }
    if (o.fabrication) {
      const f = o.fabrication;
      if (
        !Number.isInteger(f.thicknessAxis) ||
        f.thicknessAxis < 0 ||
        f.thicknessAxis > 2 ||
        !Number.isInteger(f.edgeBanding) ||
        f.edgeBanding < 0 ||
        f.edgeBanding > 4 ||
        typeof f.grain !== "boolean" ||
        (f.grainAxis != null &&
          (!Number.isInteger(f.grainAxis) ||
            f.grainAxis < 0 ||
            f.grainAxis > 2 ||
            f.grainAxis === f.thicknessAxis))
      )
        throw Error("Invalid panel fabrication settings");
    }
    if (o.mechanism) {
      const m = o.mechanism,
        vector = (v) =>
          Array.isArray(v) &&
          v.length === 3 &&
          v.every(
            (n) =>
              typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e8,
          );
      if (
        !["hinge", "slide"].includes(m.kind) ||
        (m.jointId != null &&
          (typeof m.jointId !== "string" || m.jointId.length > 300)) ||
        (m.appliedFraction != null &&
          (!Number.isFinite(m.appliedFraction) ||
            m.appliedFraction < 0 ||
            m.appliedFraction > 1)) ||
        (m.type != null && !["door", "drawer"].includes(m.type)) ||
        !["pivot", "direction", "closedPosition", "closedRotation"].every((k) =>
          vector(m[k]),
        ) ||
        (m.axis != null && (!vector(m.axis) || Math.hypot(...m.axis) < 0.99)) ||
        (m.kind === "hinge" &&
          (!Number.isFinite(m.angle) || Math.abs(m.angle) > 360)) ||
        (m.kind === "slide" &&
          (!Number.isFinite(m.travel) || m.travel < 0 || m.travel > 100000))
      )
        throw Error("Invalid furniture mechanism");
    }
    if (
      o.holes != null &&
      (o.kind !== "profile" ||
        !Array.isArray(o.holes) ||
        o.holes.length > 100 ||
        o.holes.some(
          (h) =>
            !Array.isArray(h) ||
            h.length < 3 ||
            h.length > 500 ||
            h.some(
              (v) =>
                !Array.isArray(v) ||
                v.length !== 2 ||
                v.some((n) => !Number.isFinite(n)),
            ),
        ))
    )
      throw Error("Invalid profile holes");
    if (typeof o.material !== "string" || typeof o.layer !== "string")
      throw Error("Missing material or layer");
    if (o.rate != null && (!Number.isFinite(o.rate) || o.rate < 0))
      throw Error("Invalid material rate");
    if (o.openings) {
      if (
        !Array.isArray(o.openings) ||
        o.openings.length > 20 ||
        o.kind !== "box"
      )
        throw Error("Invalid wall openings");
      for (const v of o.openings) {
        if (
          ["x", "sill", "width", "height"].some(
            (k) => !Number.isFinite(v[k]),
          ) ||
          v.x < 0 ||
          v.sill < 0 ||
          v.width <= 0 ||
          v.height <= 0 ||
          v.x + v.width > o.size[0] ||
          v.sill + v.height > o.size[2]
        )
          throw Error(
            "Opening must fit inside the width and height of the solid.",
          );
      }
      if (
        o.openings.reduce((n, v) => n + v.width * v.height, 0) >=
        o.size[0] * o.size[2]
      )
        throw Error("Opening removes the entire solid");
      for (let i = 0; i < o.openings.length; i++)
        for (let j = i + 1; j < o.openings.length; j++) {
          const a = o.openings[i],
            b = o.openings[j];
          if (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.sill < b.sill + b.height &&
            a.sill + a.height > b.sill
          )
            throw Error("Openings must not overlap.");
        }
    }
    if (
      ["line", "dimension"].includes(o.kind) &&
      (!Array.isArray(o.points) ||
        o.points.length < 2 ||
        o.points.length > (o.kind === "dimension" ? 2 : 500) ||
        o.points.some(
          (v) =>
            !Array.isArray(v) ||
            v.length !== 3 ||
            v.some((n) => !Number.isFinite(n)),
        ))
    )
      throw Error("Invalid line points");
    if (
      o.kind === "profile" &&
      (!Array.isArray(o.profile) ||
        o.profile.length < 3 ||
        o.profile.length > 500 ||
        o.profile.some(
          (v) =>
            !Array.isArray(v) ||
            v.length !== 2 ||
            v.some((n) => !Number.isFinite(n)),
        ))
    )
      throw Error("Invalid profile");
  }
  if (
    p.objects.some(
      (o) => o.kind === "profile" && polygonArea(o.profile) < 0.000001,
    )
  )
    throw Error("Profile must have a non-zero area");
  if (
    !Array.isArray(p.groups) ||
    !Array.isArray(p.layers) ||
    !Array.isArray(p.views)
  )
    throw Error("Missing project structure.");
  validateViews(p.views);
  if (p.materials != null) {
    if (!Array.isArray(p.materials) || p.materials.length > 2000)
      throw Error("Invalid custom materials");
    const ids = new Set(MATERIALS.map((m) => m.id));
    for (const m of p.materials) {
      if (
        !m ||
        typeof m.id !== "string" ||
        ids.has(m.id) ||
        typeof m.name !== "string" ||
        m.name.length > 200 ||
        !/^#[0-9a-f]{6}$/i.test(m.color)
      )
        throw Error("Invalid custom material");
      ids.add(m.id);
      for (const key of ["roughness", "metalness", "opacity"])
        if (
          m[key] != null &&
          (!Number.isFinite(m[key]) || m[key] < 0 || m[key] > 1)
        )
          throw Error("Invalid material " + key);
      if (
        m.map != null &&
        (typeof m.map !== "string" ||
          m.map.length > 8000000 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(m.map))
      )
        throw Error("Invalid material texture");
    }
  }
  if (p.materialOverrides != null) {
    if (
      typeof p.materialOverrides !== "object" ||
      Array.isArray(p.materialOverrides)
    )
      throw Error("Invalid material overrides");
    for (const [id, m] of Object.entries(p.materialOverrides)) {
      if (
        !materialCatalog(p).some((v) => v.id === id) ||
        !m ||
        typeof m !== "object" ||
        Array.isArray(m)
      )
        throw Error("Invalid project material");
      for (const [key, value] of Object.entries(m)) {
        if (key === "color" && /^#[0-9a-f]{6}$/i.test(value)) continue;
        if (
          ["opacity", "roughness", "metalness"].includes(key) &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 1
        )
          continue;
        throw Error("Invalid material property: " + key);
      }
    }
  }
  const groupIds = new Set();
  for (const g of p.groups) {
    if (
      !g ||
      typeof g.id !== "string" ||
      typeof g.name !== "string" ||
      groupIds.has(g.id)
    )
      throw Error("Invalid groups");
    groupIds.add(g.id);
    if (g.furnitureSpec) validateFurnitureSpec(g.furnitureSpec);
  }
  const groupMap = new Map(p.groups.map((g) => [g.id, g]));
  for (const g of p.groups) {
    let parent = g.parentId;
    const seen = new Set([g.id]);
    while (parent && groupMap.has(parent)) {
      if (seen.has(parent)) throw Error("Groups cannot contain a cycle");
      seen.add(parent);
      parent = groupMap.get(parent).parentId;
    }
  }
  const layerIds = new Set();
  for (const l of p.layers) {
    if (
      !l ||
      typeof l.id !== "string" ||
      typeof l.visible !== "boolean" ||
      layerIds.has(l.id)
    )
      throw Error("Invalid layers");
    layerIds.add(l.id);
  }
  for (const o of p.objects)
    if (
      !layerIds.has(o.layer) ||
      (o.groupId && !groupIds.has(o.groupId)) ||
      (o.furnitureId && !groupIds.has(o.furnitureId))
    )
      throw Error("Object refers to a missing layer or group");
  if (
    !p.settings ||
    !Number.isFinite(p.settings.grid) ||
    p.settings.grid < 1 ||
    !Number.isFinite(p.settings.snap) ||
    p.settings.snap < 0.1
  )
    throw Error("Invalid grid settings");
  if (
    !["mm", "cm", "m", "in", "ft"].includes(p.settings.unit) ||
    !Number.isFinite(p.settings.waste) ||
    p.settings.waste < 0
  )
    throw Error("Invalid unit or waste allowance");
  return p;
}
export function polygonArea(points) {
  return (
    Math.abs(
      points.reduce((s, p, i) => {
        const q = points[(i + 1) % points.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2
  );
}
export function quantities(o) {
  const [x, y, z] = o.size;
  if (o.kind === "mesh") return meshMetrics(o);
  if (["line", "dimension"].includes(o.kind))
    return { area: 0, volume: 0, edge: 0 };
  if (o.kind === "cylinder") {
    const a = (Math.PI * x * y) / 4;
    return {
      area: (2 * a + ((Math.PI * (x + y)) / 2) * z) / 1e6,
      volume: (a * z) / 1e9,
      edge: 0,
    };
  }
  if (o.kind === "profile") {
    const px = o.profile.map((p) => p[0]),
      py = o.profile.map((p) => p[1]),
      sx = x / (Math.max(...px) - Math.min(...px)),
      sy = y / (Math.max(...py) - Math.min(...py)),
      scaled = o.profile.map((p) => [p[0] * sx, p[1] * sy]),
      a =
        polygonArea(scaled) -
        (o.holes || []).reduce((sum, h) => sum + polygonArea(h) * sx * sy, 0),
      per = scaled.reduce(
        (s, p, i) =>
          s +
          Math.hypot(
            p[0] - scaled[(i + 1) % scaled.length][0],
            p[1] - scaled[(i + 1) % scaled.length][1],
          ),
        0,
      );
    return {
      area:
        (2 * a +
          (per +
            (o.holes || []).reduce(
              (sum, h) =>
                sum +
                h.reduce(
                  (n, v, i) =>
                    n +
                    Math.hypot(
                      (v[0] - h[(i + 1) % h.length][0]) * sx,
                      (v[1] - h[(i + 1) % h.length][1]) * sy,
                    ),
                  0,
                ),
              0,
            )) *
            z) /
        1e6,
      volume: (a * z) / 1e9,
      edge: per / 1000,
    };
  }
  const removed = (o.openings || []).reduce(
    (n, v) => n + v.width * v.height,
    0,
  );
  const sorted = [x, y, z].sort((a, b) => b - a);
  return {
    area: (sorted[0] * sorted[1] - removed) / 1e6,
    volume: (x * y * z - removed * y) / 1e9,
    edge: (2 * (sorted[0] + sorted[1])) / 1000,
  };
}
export function bom(project) {
  return project.objects
    .filter(
      (o) =>
        !["line", "dimension"].includes(o.kind) &&
        !o.isFace &&
        !o.medicalEquipment,
    )
    .map((o) => {
      const q = quantities(o);
      const m = materialFor(project, o.material);
      return {
        ...q,
        id: o.id,
        name: o.name,
        material: m.name,
        size: o.size,
        rate: o.rate ?? m.rate,
        cost: q.area * (o.rate ?? m.rate),
        layer: o.layer,
        group:
          project.groups.find((g) => g.id === o.groupId)?.name || "Ungrouped",
      };
    });
}
export function wardrobe({
  width = 1200,
  height = 2100,
  depth = 600,
  thickness = 18,
  shelves = 3,
  doors = true,
  material = "oak",
  x = 0,
  y = 0,
} = {}) {
  if (
    width <= thickness * 4 ||
    height <= thickness * 4 ||
    depth <= thickness * 2
  )
    throw Error("Cabinet dimensions are too small for its board thickness.");
  const g = { id: uid(), name: "Wardrobe" },
    objects = [];
  const add = (name, size, position, mat = material) =>
    objects.push(
      entity({
        name,
        size,
        position: [position[0] + x, position[1] + y, position[2]],
        material: mat,
        groupId: g.id,
      }),
    );
  add(
    "Left side",
    [thickness, depth, height],
    [-width / 2 + thickness / 2, 0, height / 2],
  );
  add(
    "Right side",
    [thickness, depth, height],
    [width / 2 - thickness / 2, 0, height / 2],
  );
  add(
    "Bottom",
    [width - 2 * thickness, depth, thickness],
    [0, 0, thickness / 2],
  );
  add(
    "Top",
    [width - 2 * thickness, depth, thickness],
    [0, 0, height - thickness / 2],
  );
  add(
    "Back panel",
    [width - 2 * thickness, 6, height - 2 * thickness],
    [0, depth / 2 - 3, height / 2],
    "plywood",
  );
  add(
    "Centre divider",
    [thickness, depth - 24, height - 2 * thickness],
    [0, -6, height / 2],
  );
  const bay = (width - 3 * thickness) / 2;
  for (let i = 1; i <= shelves; i++) {
    const z = thickness + ((height - 2 * thickness) * i) / (shelves + 1);
    add(
      `Left shelf ${i}`,
      [bay, depth - 30, thickness],
      [-(width - thickness) / 4, -9, z],
    );
    add(
      `Right shelf ${i}`,
      [bay, depth - 30, thickness],
      [(width - thickness) / 4, -9, z],
    );
  }
  if (doors) {
    for (let side of [-1, 1]) {
      add(
        side < 0 ? "Left door" : "Right door",
        [width / 2 - 3, thickness, height - 4],
        [(side * width) / 4, -depth / 2 - thickness / 2 - 2, height / 2],
        "sage",
      );
      add(
        side < 0 ? "Left handle" : "Right handle",
        [12, 28, 180],
        [side * 35, -depth / 2 - thickness - 17, height * 0.53],
        "metal",
      );
    }
  }
  return { objects, groups: [g] };
}
export function room({
  width = 5000,
  depth = 4000,
  height = 2800,
  thickness = 150,
  openFront = true,
} = {}) {
  const g = { id: uid(), name: "Room envelope" };
  const add = (name, size, position, material) =>
    entity({
      name,
      size,
      position,
      material,
      groupId: g.id,
      layer: "Architecture",
    });
  const objects = [
    add(
      "Floor slab",
      [width + 2 * thickness, depth + 2 * thickness, 100],
      [0, 0, -50],
      "concrete",
    ),
    add(
      "Back wall",
      [width + 2 * thickness, thickness, height],
      [0, depth / 2 + thickness / 2, height / 2],
      "plaster",
    ),
    add(
      "Left wall",
      [thickness, depth, height],
      [-width / 2 - thickness / 2, 0, height / 2],
      "plaster",
    ),
    add(
      "Right wall",
      [thickness, depth, height],
      [width / 2 + thickness / 2, 0, height / 2],
      "plaster",
    ),
  ];
  if (!openFront)
    objects.push(
      add(
        "Front wall",
        [width + 2 * thickness, thickness, height],
        [0, -depth / 2 - thickness / 2, height / 2],
        "plaster",
      ),
    );
  return {
    objects,
    groups: [g],
    roomInfo: { width, depth, height, thickness },
  };
}
export function furniture(type, options = {}) {
  if (type === "wardrobe") return wardrobe(options);
  if (type === "room") return room(options);
  const g = {
      id: uid(),
      name:
        type === "desk"
          ? "Writing desk"
          : type === "shelf"
            ? "Open bookcase"
            : type === "sofa"
              ? "Lounge sofa"
              : "Dining chair",
    },
    objects = [];
  const add = (name, size, position, material = "oak") =>
    objects.push(entity({ name, size, position, material, groupId: g.id }));
  if (type === "desk") {
    add("Desktop", [1400, 700, 36], [0, 0, 750]);
    for (const x of [-620, 620])
      for (const y of [-270, 270])
        add("Steel leg", [40, 40, 732], [x, y, 366], "metal");
    add("Modesty panel", [1240, 18, 300], [0, 250, 570]);
  }
  if (type === "shelf") {
    return wardrobe({
      ...options,
      width: 900,
      height: 1800,
      depth: 350,
      doors: false,
      shelves: 4,
    });
  }
  if (type === "sofa") {
    add("Upholstered seat", [2100, 850, 240], [0, 0, 420], "sage");
    add("Back cushion", [2100, 180, 450], [0, 335, 710], "sage");
    for (const x of [-1020, 1020])
      add("Armrest", [160, 850, 420], [x, 0, 600], "sage");
    for (const x of [-880, 880])
      for (const y of [-300, 300]) add("Oak foot", [70, 70, 300], [x, y, 150]);
  }
  if (type === "chair") {
    add("Seat", [450, 450, 30], [0, 0, 460]);
    add("Backrest", [450, 30, 400], [0, 210, 675]);
    for (const x of [-180, 180])
      for (const y of [-180, 180]) add("Leg", [35, 35, 445], [x, y, 222.5]);
  }
  return { objects, groups: [g] };
}
export function demoProject() {
  const p = blankProject("The Oak House · Study");
  const r = room({ width: 5200, depth: 4000, height: 2800 });
  r.objects.find((o) => o.name === "Back wall").openings = [
    { id: uid(), x: 3450, sill: 900, width: 1200, height: 1400 },
  ];
  const glazing = entity({
    name: "Study window glazing",
    size: [1200, 12, 1400],
    position: [1300, 2075, 1600],
    material: "glass",
    groupId: r.groups[0].id,
    layer: "Architecture",
  });
  r.objects.push(glazing);
  const w = wardrobe({ x: -1300, y: 1650, width: 1400, depth: 600 });
  const d = furniture("desk");
  d.objects.forEach((o) => {
    o.position[0] += 1300;
    o.position[1] += 1400;
  });
  const c = furniture("chair");
  c.objects.forEach((o) => {
    o.position[0] += 1300;
    o.position[1] += 650;
  });
  p.objects = [...r.objects, ...w.objects, ...d.objects, ...c.objects];
  p.groups = [...r.groups, ...w.groups, ...d.groups, ...c.groups];
  p.roomInfo = r.roomInfo;
  return p;
}
export function csv(rows) {
  return rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            (typeof v === "string" && /^[=+\-@\t\r]/.test(v)
              ? "'" + v
              : String(v ?? "")
            ).replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
}
