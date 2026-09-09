import { bom, MATERIALS } from "./model.js";
import { boxFeatures } from "./geometry.js";
export const escape = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
function hull(points) {
  const unique = [
    ...new Map(
      points.map((p) => [p.x + "," + p.y, { x: p.x, y: p.y }]),
    ).values(),
  ].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower = [],
    upper = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of unique.toReversed()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
export function quotationHTML(p) {
  const rows = bom(p),
    subtotal = rows.reduce((n, r) => n + r.cost, 0),
    waste = p.settings.waste / 100;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(p.name)} · Material estimate</title><style>body{font:13px Arial;color:#263c2e;max-width:1000px;margin:50px auto;padding:30px}header{display:flex;justify-content:space-between;border-bottom:2px solid #365e41;padding-bottom:25px}h1{font-size:30px;font-weight:400}small{color:#859b75}table{width:100%;border-collapse:collapse;margin:30px 0}td,th{padding:12px;text-align:left;border-bottom:1px solid #dbe5d4}th{font-size:10px;background:#f1f5eb}td{font-size:11px}.total{text-align:right;font-size:24px}.note{color:#849a75;line-height:1.8;font-size:11px}button{padding:12px;background:#365e41;color:white;border:0;cursor:pointer}@media print{button{display:none}body{margin:0;padding:10mm}tr{break-inside:avoid}thead{display:table-header-group}}</style><header><div><b>HAZZINO / STUDIO</b><h1>${escape(p.name)}</h1><small>Material estimate · ${new Date().toLocaleDateString("en-IN")}</small></div><button onclick="window.print()">Print / Save as PDF</button></header><table><thead><tr><th>PART</th><th>MATERIAL</th><th>DIMENSIONS · MM</th><th>AREA · M²</th><th>INR</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escape(r.name)}<br><small>${escape(r.group)}</small></td><td>${escape(r.material)}</td><td>${r.size.map((n) => n.toFixed(1)).join(" × ")}</td><td>${r.area.toFixed(3)}</td><td>${r.cost.toFixed(2)}</td></tr>`).join("")}</tbody></table><p class="total">INR ${(subtotal * (1 + waste)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p><p style="text-align:right">Includes ${p.settings.waste}% material allowance</p><p class="note">Planning estimate from model geometry and editable rate assumptions. Medical equipment is excluded; obtain supplier quotations. Excludes labour, hardware, taxes, delivery, sheet nesting and supplier validation. Box quantities use the largest face, with rectangular opening deductions. Mesh/profile quantities use surface area. Verify dimensions and manufacturing details before production.</p></html>`;
}
export function planSVG(p) {
  const objects = p.objects.filter(
    (o) =>
      o.visible !== false &&
      p.layers.find((l) => l.id === o.layer)?.visible !== false &&
      o.kind === "box",
  );
  const polygons = objects.map((o) => ({ o, points: boxFeatures(o).corners }));
  const all = polygons.flatMap((v) => v.points);
  if (!all.length) throw Error("Add a solid before exporting a plan");
  const minX = Math.min(...all.map((v) => v.x)) - 400,
    minY = Math.min(...all.map((v) => v.y)) - 400,
    maxX = Math.max(...all.map((v) => v.x)) + 400,
    maxY = Math.max(...all.map((v) => v.y)) + 400;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="1200" height="900"><rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#fafcf6"/><g transform="translate(0 ${minY + maxY}) scale(1 -1)">${polygons
    .map(({ o, points }) => {
      const corners = hull(points);
      return `<polygon points="${corners.map((p) => p.x + "," + p.y).join(" ")}" fill="${MATERIALS.find((m) => m.id === o.material)?.color || "#ccc"}" stroke="#4c6040" stroke-width="5"><title>${escape(o.name)} · ${o.size.join(" × ")} mm</title></polygon>`;
    })
    .join(
      "",
    )}</g><text x="${minX + 100}" y="${minY + 150}" font-family="Arial" font-size="90" fill="#435d33">${escape(p.name)} · Plan projection</text><text x="${minX + 100}" y="${maxY - 70}" font-family="Arial" font-size="55" fill="#899f79">Millimetres · visible box footprints · verify scale when printing</text></svg>`;
}
