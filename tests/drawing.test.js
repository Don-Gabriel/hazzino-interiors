import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  drawingGeometry,
  profileFromPoints,
  fromPlane,
  throughArc,
  simplifyStroke,
  PLANE_FRAMES,
} from "../shared/drawing.js";
import { blankProject, entity, validateProject } from "../shared/model.js";
import { objectMatrix, extrudeObject } from "../shared/geometry.js";
import { EditorEngine } from "../frontend/engine.js";
import { useEditor } from "../frontend/store.js";
const near = (a, b, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
function harness(tool, plane = "XY") {
  const state = useEditor.getState();
  state.set({ engine: null });
  state.load(blankProject("Drawing test"));
  state.set({
    tool,
    plane,
    curveSegments: 48,
    arcSegments: 12,
    polygonSides: 6,
    arcClockwise: false,
  });
  const engine = Object.create(EditorEngine.prototype);
  engine.points = [];
  engine.anchors = [];
  engine.drawGroup = new T.Group();
  engine.marker = { visible: false };
  engine.workPoint = (e) => ({
    point: new T.Vector3(...e.point),
    anchor: null,
  });
  return engine;
}

test("rectangle preview shows four sides before the second click on every drawing plane", () => {
  for (const plane of ["XY", "XZ", "YZ"])
    for (const signs of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const engine = harness("rectangle", plane),
        start = fromPlane([125, 230], plane),
        end = fromPlane([125 + 600 * signs[0], 230 + 2100 * signs[1]], plane),
        axes = PLANE_FRAMES[plane].axes;
      engine.marker = new T.Object3D();
      engine.camera = new T.PerspectiveCamera();
      engine.camera.position.set(4000, -4000, 4000);
      engine.click({ point: start });
      engine.pointer({ point: end });
      const positions =
          engine.drawGroup.children[0].geometry.attributes.position,
        corners = Array.from({ length: positions.count }, (_, i) =>
          new T.Vector3().fromBufferAttribute(positions, i).toArray(),
        );
      assert.equal(corners.length, 5, "closed four-sided outline");
      assert.equal(new Set(corners.map((p) => p.join(","))).size, 4);
      assert.deepEqual(corners[0], corners[4]);
      axes.forEach((axis, i) => {
        const values = corners.map((p) => p[axis]);
        near(Math.max(...values) - Math.min(...values), [600, 2100][i]);
      });
      assert.ok(corners.every((p) => p[PLANE_FRAMES[plane].normal] === 0));
      assert.equal(
        useEditor.getState().project.objects.length,
        0,
        "preview must not create a face",
      );
      assert.equal(useEditor.getState().history.length, 0);
      engine.click({ point: end });
      const face = useEditor.getState().project.objects[0];
      axes.forEach((axis, i) => {
        near(face.size[axis], [600, 2100][i]);
        near(face.position[axis], (start[axis] + end[axis]) / 2);
      });
      assert.equal(
        engine.drawGroup.children.length,
        0,
        "commit clears the preview",
      );
      assert.equal(useEditor.getState().history.length, 1);
      engine.extrude(18);
      near(
        useEditor.getState().project.objects[0].size[
          PLANE_FRAMES[plane].normal
        ],
        18,
      );
    }
});
test("two-point and three-point arcs use the bulge/through point and preserve endpoints", () => {
  const a = [-100, 0, 0],
    b = [100, 0, 0],
    via = [0, 100, 0];
  for (const [tool, controls] of [
    ["arc-2point", [a, b, via]],
    ["arc-3point", [a, via, b]],
  ]) {
    const g = drawingGeometry(tool, controls, "XY");
    assert.equal(g.closed, false);
    g.points[0].forEach((v, i) => near(v, a[i]));
    g.points.at(-1).forEach((v, i) => near(v, b[i]));
    g.points.forEach(([x, y]) => near(Math.hypot(x, y), 100));
    near(Math.max(...g.points.map((p) => p[1])), 100);
  }
  const major = throughArc([1, 0], [-1, 0], [0, 1]);
  near(major.sweep, -Math.PI * 1.5);
  assert.throws(() => throughArc([0, 0], [1, 0], [2, 0]), /one line/);
});
test("center arcs and pie sectors respect direction and a fixed radius", () => {
  const controls = [
    [0, 0, 0],
    [100, 0, 0],
    [0, 250, 0],
  ];
  const short = drawingGeometry("arc", controls, "XY", { curveSegments: 48 });
  const long = drawingGeometry("arc", controls, "XY", {
    curveSegments: 48,
    arcClockwise: true,
  });
  assert.equal(short.points.length, 13);
  assert.equal(long.points.length, 13);
  assert.equal(
    drawingGeometry("arc", controls, "XY", { arcSegments: 24 }).points.length,
    25,
  );
  near(short.points.at(-1)[1], 100);
  assert.ok(long.points.some((p) => p[1] < -99));
  const pie = drawingGeometry("pie", controls, "XY");
  assert.equal(pie.closed, true);
  assert.deepEqual(pie.points[0], [0, 0, 0]);
  const model = blankProject();
  model.objects.push(profileFromPoints("Pie", pie.points, "XY"));
  validateProject(model);
});
test("rotated rectangles preserve perpendicular edges and world orientation on every plane", () => {
  for (const plane of Object.keys(PLANE_FRAMES)) {
    const points = [
      [20, 30],
      [50, 70],
      [20, 80],
    ].map((p) => fromPlane(p, plane, 17));
    const g = drawingGeometry("rotated-rectangle", points, plane);
    const a = new T.Vector3(...g.points[1]).sub(new T.Vector3(...g.points[0])),
      b = new T.Vector3(...g.points[2]).sub(new T.Vector3(...g.points[1]));
    near(a.dot(b), 0);
    near(a.length(), 50);
    near(b.length(), 30);
    const face = profileFromPoints("Rotated rectangle", g.points, plane),
      matrix = objectMatrix(face);
    face.profile.forEach((point, i) => {
      new T.Vector3(...point, 0)
        .applyMatrix4(matrix)
        .toArray()
        .forEach((v, axis) => near(v, g.points[i][axis]));
    });
    const solid = extrudeObject(face, 80),
      normal = new T.Vector3(0, 0, 1).transformDirection(matrix);
    const shift = new T.Vector3(...solid.position).sub(
      new T.Vector3(...face.position),
    );
    near(shift.dot(normal), 40);
    near(Math.abs(normal.getComponent(PLANE_FRAMES[plane].normal)), 1);
  }
});
test("regular polygons preserve side count, clicked radius and rotation", () => {
  const g = drawingGeometry(
    "regular-polygon",
    [
      [10, 20, 0],
      [10, 120, 0],
    ],
    "XY",
    { polygonSides: 5 },
  );
  assert.equal(g.points.length, 5);
  assert.equal(g.closed, true);
  near(g.points[0][0], 10);
  near(g.points[0][1], 120);
  g.points.forEach(([x, y]) => near(Math.hypot(x - 10, y - 20), 100));
  const face = profileFromPoints("Pentagon", g.points, "XY"),
    matrix = objectMatrix(face);
  face.profile.forEach((p, i) =>
    new T.Vector3(...p, 0)
      .applyMatrix4(matrix)
      .toArray()
      .forEach((n, j) => near(n, g.points[i][j])),
  );
});
test("arc click workflow waits for three points, recovers from collinearity, and undoes as one curve", () => {
  const engine = harness("arc-2point"),
    s = useEditor.getState();
  engine.click({ point: [-100, 0, 0] });
  engine.click({ point: [100, 0, 0] });
  assert.equal(useEditor.getState().project.objects.length, 0);
  engine.click({ point: [0, 0, 0] });
  assert.equal(engine.points.length, 2);
  assert.equal(useEditor.getState().history.length, 0);
  engine.click({ point: [0, 100, 0] });
  const project = JSON.parse(JSON.stringify(useEditor.getState().project));
  validateProject(project);
  assert.equal(project.objects.length, 1);
  assert.equal(project.objects[0].kind, "line");
  assert.ok(project.objects[0].points.length > 2);
  s.undo();
  assert.equal(useEditor.getState().project.objects.length, 0);
  s.redo();
  assert.deepEqual(useEditor.getState().project.objects[0], project.objects[0]);
});
test("pie and rotated rectangle click workflows produce extrudable faces on YZ", () => {
  for (const tool of ["pie", "rotated-rectangle"]) {
    const engine = harness(tool, "YZ");
    [
      [0, 0],
      [100, 0],
      [0, 100],
    ].forEach((p) => engine.click({ point: fromPlane(p, "YZ") }));
    const s = useEditor.getState(),
      face = s.project.objects[0];
    assert.equal(s.tool, "pushpull");
    assert.equal(face.isFace, true);
    const normal = new T.Vector3(0, 0, 1).transformDirection(
      objectMatrix(face),
    );
    near(normal.x, 1);
    near(normal.y, 0);
    near(normal.z, 0);
  }
});
test("freehand simplification retains corners/endpoints and commits a bounded undoable curve", () => {
  const points = [
    ...Array.from({ length: 51 }, (_, i) => [i, 0, 0]),
    ...Array.from({ length: 50 }, (_, i) => [50, i + 1, 0]),
  ];
  assert.deepEqual(simplifyStroke(points), [
    [0, 0, 0],
    [50, 0, 0],
    [50, 50, 0],
  ]);
  const engine = harness("freehand");
  engine.points = points.map((p) => new T.Vector3(...p));
  engine.freehandActive = true;
  engine.finishStroke();
  const s = useEditor.getState();
  assert.equal(s.project.objects.length, 1);
  assert.deepEqual(s.project.objects[0].points, [
    [0, 0, 0],
    [50, 0, 0],
    [50, 50, 0],
  ]);
  assert.equal(engine.freehandActive, false);
  s.undo();
  assert.equal(useEditor.getState().project.objects.length, 0);
  const dense = harness("freehand");
  dense.points = Array.from(
    { length: 1600 },
    (_, i) => new T.Vector3(i, i % 2 ? 20 : 0, 0),
  );
  dense.finishStroke();
  const curve = useEditor.getState().project.objects[0];
  assert.ok(curve.points.length <= 500);
  assert.deepEqual(curve.points.at(-1), [1599, 20, 0]);
  const overflow = harness("freehand");
  overflow.drawPreview = () => {};
  overflow.points = Array.from(
    { length: 2000 },
    (_, i) => new T.Vector3(i, 0, 0),
  );
  overflow.sampleStroke({ point: [5000, 20, 0] });
  assert.ok(overflow.points.length < 2000);
  assert.deepEqual(overflow.points.at(-1).toArray(), [5000, 20, 0]);
});
test("curve imports accept polylines but keep dimensions restricted to two points", () => {
  const p = blankProject(),
    curve = entity({
      kind: "line",
      points: [
        [0, 0, 0],
        [1, 1, 0],
        [2, 0, 0],
      ],
    });
  p.objects.push(curve);
  validateProject(p);
  curve.kind = "dimension";
  assert.throws(() => validateProject(p), /line points/);
  curve.kind = "line";
  curve.points = Array.from({ length: 501 }, (_, i) => [i, 0, 0]);
  assert.throws(() => validateProject(p), /line points/);
  curve.points = [
    [0, 0, 0],
    [NaN, 1, 0],
  ];
  assert.throws(() => validateProject(p), /line points/);
});
