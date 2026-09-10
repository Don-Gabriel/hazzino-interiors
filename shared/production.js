import { materialFor } from "./model.js";
import { objectGeometry } from "./geometry.js";
import { Vector3, Euler, Matrix4, Quaternion } from "three";
import { escape } from "./reports.js";
const r = (n) => Math.round(n * 100) / 100;
export function cutList(project) {
  const rows = new Map();
  for (const o of project.objects) {
    if (
      o.role === "hardware" ||
      !["box", "profile", "mesh"].includes(o.kind) ||
      o.isFace ||
      o.layer === "Architecture" ||
      (o.kind !== "box" && !o.fabrication)
    )
      continue;
    const axis =
        o.fabrication?.thicknessAxis ?? o.size.indexOf(Math.min(...o.size)),
      grainAxis = o.fabrication?.grainAxis,
      plane =
        grainAxis != null && grainAxis !== axis
          ? [
              o.size[grainAxis],
              o.size.find((_, i) => i !== axis && i !== grainAxis),
            ]
          : o.size.filter((_, i) => i !== axis).sort((a, b) => b - a),
      length = r(plane[0]),
      width = r(plane[1]),
      thickness = r(o.size[axis]);
    const band = o.fabrication?.edgeBanding ?? 0,
      grain = o.fabrication?.grain ?? true,
      edge =
        (band >= 2 ? 2 * length : band === 1 ? length : 0) +
        (band >= 4 ? 2 * width : band === 3 ? width : 0);
    const assembly =
      project.groups.find((g) => g.id === (o.furnitureId || o.groupId))?.name ||
      "Loose parts";
    const key = JSON.stringify([
      assembly,
      o.name,
      o.material,
      length,
      width,
      thickness,
      band,
      grain,
      o.cutout || null,
      o.openings || null,
      o.kind === "mesh"
        ? o.id
        : o.kind === "profile"
          ? [o.profile, o.holes]
          : null,
    ]);
    if (rows.has(key)) {
      const row = rows.get(key);
      row.quantity++;
      row.edgeMeters += edge / 1000;
      row.ids.push(o.id);
    } else
      rows.set(key, {
        key,
        ids: [o.id],
        name: o.name,
        assembly,
        materialId: o.material,
        material: materialFor(project, o.material).name,
        length,
        width,
        thickness,
        quantity: 1,
        edgeBanding: band,
        edgeMeters: edge / 1000,
        grain,
        cutout: o.cutout,
        notes: o.machining?.length
          ? o.machining
              .map((m) =>
                m.type === "drill"
                  ? `${m.holes} × Ø${m.diameter} mm holes, ${m.through ? "through" : m.depth + " mm deep"}`
                  : `${m.width} × ${m.height} mm pocket, ${m.through ? "through" : m.depth + " mm deep"}`,
              )
              .join("; ")
          : o.cutout
            ? `${o.cutout.width} × ${o.cutout.depth} mm cutout`
            : o.openings?.length
              ? "Opening machining required"
              : o.kind !== "box"
                ? "Shaped blank: machine from model"
                : "",
      });
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.assembly.localeCompare(b.assembly) ||
      a.material.localeCompare(b.material) ||
      b.thickness - a.thickness ||
      b.length - a.length,
  );
}
const cell = (v) => {
  const s = String(v ?? "");
  return (
    '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'
  );
};
export function cutListCSV(project) {
  return (
    "\uFEFF" +
    [
      [
        "Assembly",
        "Part",
        "Material",
        "Quantity",
        "Length mm",
        "Width mm",
        "Thickness mm",
        "Edge band m total",
        "Grain along length",
        "Machining",
      ],
      ...cutList(project).map((r) => [
        r.assembly,
        r.name,
        r.material,
        r.quantity,
        r.length,
        r.width,
        r.thickness,
        r.edgeMeters.toFixed(3),
        r.grain ? "Yes" : "No",
        r.notes,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}

export function nestPanels(
  rows,
  { sheetWidth = 1220, sheetLength = 2440, kerf = 3 } = {},
) {
  if (
    ![sheetWidth, sheetLength, kerf].every(Number.isFinite) ||
    sheetWidth < 100 ||
    sheetLength < 100 ||
    sheetWidth > 20000 ||
    sheetLength > 20000 ||
    kerf < 0 ||
    kerf > 30
  )
    throw Error("Enter valid sheet dimensions and a kerf from 0–30 mm");
  const sheets = [],
    unplaced = [],
    parts = rows
      .flatMap((row) =>
        Array.from({ length: row.quantity }, (_, i) => ({
          ...row,
          quantity: 1,
          label: row.name + " " + (i + 1),
        })),
      )
      .sort((a, b) => b.length * b.width - a.length * a.width);
  if (parts.length > 10000)
    throw Error("Sheet planning supports up to 10,000 parts");
  for (const part of parts) {
    const variants = [
      [part.length, part.width, false],
      ...(!part.grain ? [[part.width, part.length, true]] : []),
    ];
    if (!variants.some(([l, w]) => l <= sheetLength && w <= sheetWidth)) {
      unplaced.push(part);
      continue;
    }
    let best;
    function search(sheet) {
      for (let i = 0; i < sheet.free.length; i++) {
        const f = sheet.free[i];
        for (const [l, w, rotated] of variants)
          if (l <= f.length + 1e-7 && w <= f.width + 1e-7) {
            const score = f.length * f.width - l * w;
            if (!best || score < best.score)
              best = { sheet, index: i, l, w, rotated, score };
          }
      }
    }
    for (const sheet of sheets)
      if (
        sheet.materialId === part.materialId &&
        sheet.thickness === part.thickness
      )
        search(sheet);
    if (!best) {
      const sheet = {
        number: sheets.length + 1,
        material: part.material,
        materialId: part.materialId,
        thickness: part.thickness,
        length: sheetLength,
        width: sheetWidth,
        parts: [],
        free: [{ x: 0, y: 0, length: sheetLength, width: sheetWidth }],
      };
      sheets.push(sheet);
      search(sheet);
    }
    const { sheet, index, l, w, rotated } = best,
      f = sheet.free.splice(index, 1)[0];
    sheet.parts.push({
      ...part,
      x: f.x,
      y: f.y,
      placedLength: l,
      placedWidth: w,
      rotated,
    });
    // Two disjoint rectangular remnants, separated by saw kerf.
    if (f.length - l - kerf > 0)
      sheet.free.push({
        x: f.x + l + kerf,
        y: f.y,
        length: f.length - l - kerf,
        width: w,
      });
    if (f.width - w - kerf > 0)
      sheet.free.push({
        x: f.x,
        y: f.y + w + kerf,
        length: f.length,
        width: f.width - w - kerf,
      });
  }
  const used = sheets
    .flatMap((s) => s.parts)
    .reduce((a, p) => a + p.length * p.width, 0);
  return {
    sheets,
    unplaced,
    sheetWidth,
    sheetLength,
    kerf,
    utilization: sheets.length
      ? used / (sheets.length * sheetWidth * sheetLength)
      : 0,
  };
}
export function nestingSVG(plan) {
  const w = 1000,
    pad = 30,
    scale = 940 / plan.sheetLength,
    block = plan.sheetWidth * scale + 95,
    h = Math.max(150, plan.sheets.length * block + 55);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#fbfcf7"/><style>text{font-family:Arial;fill:#274333}.label{font-size:10px}</style><text x="30" y="28" font-size="18">HAZZINO · sheet layout · kerf ${plan.kerf} mm</text>${plan.sheets.map((s, i) => `<g transform="translate(${pad},${55 + i * block})"><text y="16" font-size="14">Sheet ${s.number} · ${escape(s.material)} · ${s.thickness} mm · ${s.length} × ${s.width} mm</text><g transform="translate(0,30)"><rect width="${s.length * scale}" height="${s.width * scale}" fill="#e9eddc" stroke="#66795b"/>${s.parts.map((p, j) => `<g><rect x="${p.x * scale}" y="${p.y * scale}" width="${p.placedLength * scale}" height="${p.placedWidth * scale}" fill="${["#d5dfc2", "#c2d1b6", "#e4d8bd", "#cbd8cd"][j % 4]}" stroke="#536745" stroke-width=".7"><title>${escape(p.assembly + " · " + p.label)} · ${p.length} × ${p.width} mm</title></rect><text class="label" x="${(p.x + 5) * scale}" y="${(p.y + Math.min(p.placedWidth / 2, 35)) * scale}">${escape(p.label.slice(0, 28))}</text>${p.placedWidth * scale > 32 ? `<text class="label" x="${(p.x + 5) * scale}" y="${(p.y + Math.min(p.placedWidth / 2, 35)) * scale + 13}">${p.length} × ${p.width}${p.rotated ? " ↻" : ""}</text>` : ""}</g>`).join("")}</g></g>`).join("")}</svg>`;
}

export function furnitureDrawingSVG(project, groupId) {
  const group = project.groups.find((g) => g.id === groupId),
    spec = group?.furnitureSpec;
  const objects = project.objects.filter(
    (o) =>
      (groupId ? o.furnitureId === groupId || o.groupId === groupId : true) &&
      o.role !== "hardware" &&
      !["line", "dimension"].includes(o.kind),
  );
  if (!objects.length) return "";
  const parts = [];
  for (const o of objects) {
    const geo = objectGeometry(o),
      attr = geo.attributes.position,
      matrix = new Matrix4().compose(
        new Vector3(...(o.mechanism?.closedPosition || o.position)),
        new Quaternion().setFromEuler(
          new Euler(
            ...(o.mechanism?.closedRotation || o.rotation).map(
              (n) => (n * Math.PI) / 180,
            ),
          ),
        ),
        new Vector3(1, 1, 1),
      );
    const points = [];
    for (let i = 0; i < attr.count; i++) {
      const v = new Vector3().fromBufferAttribute(attr, i).applyMatrix4(matrix);
      if (spec)
        v.sub(new Vector3(spec.x, spec.y, spec.elevation)).applyAxisAngle(
          new Vector3(0, 0, 1),
          (-spec.rotation * Math.PI) / 180,
        );
      points.push(v.toArray());
    }
    geo.dispose();
    parts.push({
      name: o.name,
      points,
      color: materialFor(project, o.material).color,
    });
  }
  const all = parts.flatMap((p) => p.points),
    min = [0, 1, 2].map((a) => Math.min(...all.map((p) => p[a]))),
    max = [0, 1, 2].map((a) => Math.max(...all.map((p) => p[a])));
  const views = [
    ["Front elevation", 0, 2],
    ["Plan", 0, 1],
    ["Side elevation", 1, 2],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 510" width="1200" height="510"><rect width="100%" height="100%" fill="#fff"/><style>text{font-family:Arial;fill:#28402f;font-size:12px}</style>${views
    .map(([name, a, b], i) => {
      const w = max[a] - min[a],
        h = max[b] - min[b],
        scale = Math.min(300 / Math.max(w, 1), 350 / Math.max(h, 1)),
        x = 50 + i * 400,
        y = 65 + (350 - h * scale) / 2;
      return `<g><text x="${x}" y="30" font-size="16">${name}</text>${parts
        .map((p) => {
          const xs = p.points.map((v) => v[a]),
            ys = p.points.map((v) => v[b]),
            l = Math.min(...xs),
            r = Math.max(...xs),
            lo = Math.min(...ys),
            hi = Math.max(...ys);
          return `<rect x="${x + (l - min[a]) * scale}" y="${y + (max[b] - hi) * scale}" width="${Math.max(0.5, (r - l) * scale)}" height="${Math.max(0.5, (hi - lo) * scale)}" fill="none" stroke="#657458" stroke-width=".65"><title>${escape(p.name)}</title></rect>`;
        })
        .join(
          "",
        )}<path d="M${x},${y + h * scale + 12}v22m0,-8h${w * scale}m0,-14v22" fill="none" stroke="#315c3b"/><text x="${x + (w * scale) / 2}" y="${y + h * scale + 43}" text-anchor="middle">${r(w)} mm</text><path d="M${x + w * scale + 10},${y}h22m-8,0v${h * scale}m-14,0h22" fill="none" stroke="#315c3b"/><text transform="translate(${x + w * scale + 40},${y + (h * scale) / 2}) rotate(-90)" text-anchor="middle">${r(h)} mm</text></g>`;
    })
    .join(
      "",
    )}<text x="50" y="495">${escape(group?.name || project.name)} · orthographic part envelopes · millimetres · fronts shown closed</text></svg>`;
}
export function productionHTML(project) {
  const rows = cutList(project),
    hardware = new Map();
  for (const o of project.objects.filter((o) => o.role === "hardware")) {
    const key =
      (o.hardwareType || o.name) +
      (o.hardwareType === "Hanging rail"
        ? " · " + Math.max(...o.size) + " mm"
        : "");
    hardware.set(key, (hardware.get(key) || 0) + 1);
  }
  const assemblies = project.groups.filter(
    (g) =>
      g.furnitureSpec && project.objects.some((o) => o.furnitureId === g.id),
  );
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(project.name)} · Production</title><style>body{font:13px Arial;color:#283f2f;margin:35px auto;padding:25px;max-width:1200px}h1{font-size:30px;font-weight:400}h2{margin-top:32px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #dce3d5;text-align:left;font-size:11px}th{background:#edf2e5}small{display:block;color:#75816a}svg{width:100%;height:auto}.drawing{break-inside:avoid}.note{font-size:11px;color:#67735c;line-height:1.6}button{background:#355d40;color:white;padding:12px;border:0;border-radius:5px}@media print{button{display:none}body{margin:0;padding:0}tr{break-inside:avoid}thead{display:table-header-group}.drawing{break-before:page}}</style><header><b>HAZZINO / FURNITURE STUDIO</b><h1>${escape(project.name)}</h1><button onclick="window.print()">Print / Save as PDF</button></header><h2>Panel cut list</h2><table><thead><tr><th>Part / assembly</th><th>Material</th><th>Qty</th><th>L × W × T · mm</th><th>Edge band · m</th><th>Machining</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escape(r.name)}<small>${escape(r.assembly)}</small></td><td>${escape(r.material)}</td><td>${r.quantity}</td><td>${r.length} × ${r.width} × ${r.thickness}</td><td>${r.edgeMeters.toFixed(3)}</td><td>${escape(r.notes)}</td></tr>`).join("")}</tbody></table><p class="note">Dimensions are blank sizes, without edge-band thickness deductions. Grain follows length by default. Edge-band counts are editable assumptions on each part. Machining, hinge drilling and supplier-specific clearances require workshop detailing.</p><h2>Hardware schedule</h2><table><thead><tr><th>Fitting</th><th>Quantity</th></tr></thead><tbody>${[...hardware].map(([name, count]) => `<tr><td>${escape(name)}</td><td>${count}</td></tr>`).join("")}</tbody></table>${assemblies.map((g) => `<section class="drawing"><h2>${escape(g.name)}</h2>${furnitureDrawingSVG(project, g.id)}<p class="note">Dimensions derive from current part geometry. Drawings show projected part envelopes, including internal panels. Hardware reference shapes are omitted.</p></section>`).join("")}</html>`;
}
