import { blankProject, entity, room, uid, validateProject } from "./model.js";
import { bounds } from "./geometry.js";

export function hospitalPlan(raw = {}) {
  const p = {
    name: "Patient room",
    width: 6000,
    depth: 5000,
    height: 3000,
    beds: 2,
    cabinets: true,
    ivStands: true,
    corridor: 1200,
    explanation: "Beds arranged around a clear central circulation strip.",
    ...raw,
  };
  for (const [k, min, max] of [
    ["width", 3000, 30000],
    ["depth", 3000, 30000],
    ["height", 2400, 6000],
    ["beds", 1, 12],
    ["corridor", 900, 2400],
  ])
    if (!Number.isFinite(p[k]) || p[k] < min || p[k] > max)
      throw new Error(
        `${k} must be between ${min} and ${max}${k === "beds" ? "" : " mm"}.`,
      );
  if (!Number.isInteger(p.beds))
    throw new Error("Bed count must be a whole number.");
  if (typeof p.cabinets !== "boolean" || typeof p.ivStands !== "boolean")
    throw new Error("Furniture options must be true or false.");
  p.name = String(p.name).slice(0, 100);
  p.explanation = String(p.explanation).slice(0, 1200);
  return p;
}

export function generateHospital(raw) {
  const p = hospitalPlan(raw),
    project = blankProject(p.name),
    envelope = room(p);
  Object.assign(project, envelope, { hospitalIntent: p });
  const rows = Math.ceil(p.beds / 2),
    step = (p.depth - 600) / rows;
  function assembly(name, type, x, y, parts) {
    const g = { id: uid(), name, semanticType: type };
    project.groups.push(g);
    for (const [part, size, pos, material = "white"] of parts)
      project.objects.push(
        entity({
          name: `${name} · ${part}`,
          size,
          position: [x + pos[0], y + pos[1], pos[2]],
          material,
          groupId: g.id,
          semanticType: type,
          medicalEquipment: true,
        }),
      );
  }
  for (let i = 0; i < p.beds; i++) {
    const side = i % 2 === 0 ? -1 : 1,
      x = side * (p.corridor / 2 + 550),
      y = -p.depth / 2 + 300 + step * (Math.floor(i / 2) + 0.5);
    const parts = [
      ["Frame", [1000, 2100, 100], [0, 0, 450], "metal"],
      ["Mattress", [950, 2000, 180], [0, 0, 590], "sage"],
      ["Headboard", [1000, 70, 700], [0, 1020, 600]],
      ["Footboard", [1000, 60, 450], [0, -1020, 470]],
    ];
    for (const s of [-1, 1]) {
      parts.push(["Safety rail", [35, 1500, 60], [s * 500, 0, 800], "metal"]);
      for (const t of [-1, 1])
        parts.push([
          "Wheel support",
          [90, 90, 400],
          [s * 420, t * 850, 200],
          "metal",
        ]);
    }
    assembly(`Bed ${i + 1}`, "hospital-bed", x, y, parts);
    if (p.cabinets)
      assembly(`Cabinet ${i + 1}`, "bedside-cabinet", x + side * 850, y + 600, [
        ["Carcass", [450, 450, 700], [0, 0, 350]],
        ["Top", [490, 490, 30], [0, 0, 715], "sage"],
        ["Handle", [160, 30, 20], [0, -240, 580], "metal"],
      ]);
    if (p.ivStands)
      assembly(`IV stand ${i + 1}`, "iv-stand", x + side * 800, y - 650, [
        ["Base", [400, 400, 40], [0, 0, 20], "metal"],
        ["Pole", [30, 30, 1800], [0, 0, 940], "metal"],
        ["Hook bar", [300, 30, 30], [0, 0, 1825], "metal"],
      ]);
  }
  validateProject(project);
  return project;
}

export function validateHospital(project) {
  if (!project.hospitalIntent)
    return {
      issues: [],
      assemblies: 0,
      summary: "Generate a hospital room to run its planning checks.",
    };
  const p = hospitalPlan(project.hospitalIntent),
    issues = [],
    groups = [];
  for (const g of project.groups.filter((g) => g.semanticType)) {
    const parts = project.objects.filter((o) => o.groupId === g.id);
    if (!parts.length) continue;
    const b = bounds(parts[0]);
    for (const part of parts.slice(1)) b.union(bounds(part));
    groups.push({ g, b });
    if (
      b.min.x < -p.width / 2 ||
      b.max.x > p.width / 2 ||
      b.min.y < -p.depth / 2 ||
      b.max.y > p.depth / 2
    )
      issues.push(`${g.name}: extends outside the room.`);
    if (b.min.x < p.corridor / 2 && b.max.x > -p.corridor / 2)
      issues.push(
        `${g.name}: obstructs the ${p.corridor} mm central circulation strip.`,
      );
    if (b.min.z < -1 || b.min.z > 50)
      issues.push(`${g.name}: assembly is below the floor or floating.`);
    if (b.max.z > p.height) issues.push(`${g.name}: exceeds ceiling height.`);
  }
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i],
        b = groups[j];
      if (
        ["x", "y", "z"].every(
          (k) =>
            Math.min(a.b.max[k], b.b.max[k]) -
              Math.max(a.b.min[k], b.b.min[k]) >
            1,
        )
      )
        issues.push(`${a.g.name} overlaps ${b.g.name} (bounding boxes).`);
    }
  return {
    issues,
    assemblies: groups.length,
    summary: issues.length
      ? `${issues.length} planning issue${issues.length === 1 ? "" : "s"} found.`
      : "All implemented geometric checks pass.",
  };
}
