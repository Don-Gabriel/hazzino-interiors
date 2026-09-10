import { entity, polygonArea } from "./model.js";

export const DRAWING_TOOLS = [
  "line",
  "freehand",
  "rectangle",
  "rotated-rectangle",
  "circle",
  "regular-polygon",
  "polygon",
  "arc",
  "arc-2point",
  "arc-3point",
  "pie",
  "measure",
];
export const ARC_TOOLS = ["arc", "arc-2point", "arc-3point", "pie"];
export const THREE_POINT_TOOLS = ["rotated-rectangle", ...ARC_TOOLS];
export const PLANE_FRAMES = {
  XY: { axes: [0, 1], normal: 2, rotation: [0, 0, 0] },
  XZ: { axes: [0, 2], normal: 1, rotation: [90, 0, 0] },
  YZ: { axes: [1, 2], normal: 0, rotation: [90, 90, 0] },
};
const TAU = Math.PI * 2;
const mod = (a) => ((a % TAU) + TAU) % TAU;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const toPlane = (point, plane) =>
  PLANE_FRAMES[plane].axes.map((axis) => point[axis]);
export function fromPlane(point, plane, offset = 0) {
  const frame = PLANE_FRAMES[plane],
    result = [0, 0, 0];
  frame.axes.forEach((axis, i) => {
    result[axis] = point[i];
  });
  result[frame.normal] = offset;
  return result;
}

// Circumcircle relative to the first point keeps large world coordinates out
// of the determinant. The through point selects the correct major/minor arc.
export function throughArc(start, through, end) {
  const bx = through[0] - start[0],
    by = through[1] - start[1],
    cx = end[0] - start[0],
    cy = end[1] - start[1],
    determinant = 2 * (bx * cy - by * cx),
    scale = Math.max(bx * bx + by * by, cx * cx + cy * cy);
  if (scale < 0.000001 || Math.abs(determinant) < scale * 1e-7)
    throw Error("Choose three different points that are not on one line");
  const b2 = bx * bx + by * by,
    c2 = cx * cx + cy * cy,
    center = [
      start[0] + (cy * b2 - by * c2) / determinant,
      start[1] + (bx * c2 - cx * b2) / determinant,
    ],
    angle = Math.atan2(start[1] - center[1], start[0] - center[0]),
    via = mod(
      Math.atan2(through[1] - center[1], through[0] - center[0]) - angle,
    ),
    finish = mod(Math.atan2(end[1] - center[1], end[0] - center[0]) - angle);
  return {
    center,
    radius: distance(center, start),
    angle,
    sweep: via <= finish ? finish : finish - TAU,
  };
}

export function drawingGeometry(tool, points, plane, options = {}) {
  if (points.length < 2) return null;
  const [a, b, c] = points.map((p) => toPlane(p, plane)),
    segments = Math.max(
      12,
      Math.min(96, Math.round(options.curveSegments || 48)),
    ),
    offset = points[0][PLANE_FRAMES[plane].normal];
  let vertices,
    closed = false;
  if (tool === "rectangle") {
    vertices = [a, [b[0], a[1]], b, [a[0], b[1]]];
    closed = true;
  } else if (tool === "rotated-rectangle") {
    if (!c) return null;
    const width = distance(a, b);
    if (width < 0.001) throw Error("Choose a longer first edge");
    const normal = [-(b[1] - a[1]) / width, (b[0] - a[0]) / width],
      height = (c[0] - a[0]) * normal[0] + (c[1] - a[1]) * normal[1];
    if (Math.abs(height) < 0.001)
      throw Error("Rectangle needs a non-zero width");
    vertices = [
      a,
      b,
      [b[0] + normal[0] * height, b[1] + normal[1] * height],
      [a[0] + normal[0] * height, a[1] + normal[1] * height],
    ];
    closed = true;
  } else if (["circle", "regular-polygon"].includes(tool)) {
    const radius = distance(a, b),
      sides =
        tool === "circle"
          ? segments
          : Math.max(3, Math.min(96, Math.round(options.polygonSides || 6))),
      angle = tool === "circle" ? 0 : Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (radius < 0.001) throw Error("Choose a non-zero radius");
    vertices = Array.from({ length: sides }, (_, i) => [
      a[0] + radius * Math.cos(angle + (i * TAU) / sides),
      a[1] + radius * Math.sin(angle + (i * TAU) / sides),
    ]);
    closed = true;
  } else if (ARC_TOOLS.includes(tool)) {
    if (!c) return null;
    let arc;
    if (["arc", "pie"].includes(tool)) {
      const radius = distance(a, b),
        angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
        finish = Math.atan2(c[1] - a[1], c[0] - a[0]),
        sweep = options.arcClockwise
          ? -mod(angle - finish)
          : mod(finish - angle);
      if (radius < 0.001 || distance(a, c) < 0.001 || Math.abs(sweep) < 1e-6)
        throw Error("Choose a non-zero radius and arc angle");
      arc = { center: a, radius, angle, sweep };
    } else
      arc = tool === "arc-2point" ? throughArc(a, c, b) : throughArc(a, b, c);
    const count = Math.max(
      2,
      Math.min(96, Math.round(options.arcSegments || 12)),
    );
    vertices = Array.from({ length: count + 1 }, (_, i) => {
      const angle = arc.angle + (arc.sweep * i) / count;
      return [
        arc.center[0] + arc.radius * Math.cos(angle),
        arc.center[1] + arc.radius * Math.sin(angle),
      ];
    });
    if (tool === "pie") {
      vertices.unshift(a);
      closed = true;
    }
  } else return null;
  return { points: vertices.map((p) => fromPlane(p, plane, offset)), closed };
}

export function profileFromPoints(name, points, plane) {
  if (
    points.length < 3 ||
    points.length > 500 ||
    points.some((p) => p.length !== 3 || p.some((n) => !Number.isFinite(n)))
  )
    throw Error("A profile needs 3–500 finite points");
  const frame = PLANE_FRAMES[plane],
    offset = points[0][frame.normal];
  if (points.some((p) => Math.abs(p[frame.normal] - offset) > 0.001))
    throw Error("Profile points must share a drawing plane");
  const local = points.map((p) => toPlane(p, plane)),
    min = [0, 1].map((i) => Math.min(...local.map((p) => p[i]))),
    max = [0, 1].map((i) => Math.max(...local.map((p) => p[i]))),
    center = min.map((v, i) => (v + max[i]) / 2),
    size = min.map((v, i) => max[i] - v);
  if (size.some((n) => n < 0.001))
    throw Error("A face needs two non-zero dimensions");
  if (polygonArea(local) < 0.000001)
    throw Error("A face needs a non-zero area");
  return entity({
    name,
    kind: "profile",
    profile: local.map((p) => p.map((v, i) => v - center[i])),
    position: fromPlane(center, plane, offset),
    rotation: [...frame.rotation],
    size: [...size, 0.1],
    isFace: true,
    thinAxis: 2,
  });
}

// Douglas–Peucker preserves endpoints and corners while reducing pointer noise.
export function simplifyStroke(points, tolerance = 0.5) {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]),
    stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop(),
      a = points[start],
      b = points[end],
      d = b.map((v, i) => v - a[i]),
      length2 = d.reduce((sum, v) => sum + v * v, 0);
    let best = tolerance * tolerance,
      index = -1;
    for (let i = start + 1; i < end; i++) {
      const point = points[i],
        t = length2
          ? Math.max(
              0,
              Math.min(
                1,
                point.reduce((sum, v, j) => sum + (v - a[j]) * d[j], 0) /
                  length2,
              ),
            )
          : 0,
        distance2 = point.reduce(
          (sum, v, j) => sum + (v - a[j] - t * d[j]) ** 2,
          0,
        );
      if (distance2 > best) {
        best = distance2;
        index = i;
      }
    }
    if (index >= 0) {
      keep.add(index);
      stack.push([start, index], [index, end]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}
