import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  entity,
  blankProject,
  quantities,
  validateProject,
} from "../shared/model.js";
import { initKernel, offsetFace } from "../shared/solid-kernel.js";
import { sweepProfile, connectedPath } from "../shared/sweep.js";
import { parseDistance } from "../shared/measurements.js";
import { EditorEngine } from "../frontend/engine.js";
import { useEditor } from "../frontend/store.js";
await initKernel();
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const square = () =>
  entity({
    kind: "profile",
    name: "Profile",
    profile: [
      [-5, -5],
      [5, -5],
      [5, 5],
      [-5, 5],
    ],
    size: [10, 10, 0.1],
    position: [0, 0, 0],
    isFace: true,
  });
const path = (points) =>
  entity({ kind: "line", size: [1, 1, 1], position: [0, 0, 0], points });
test("distance inputs accept metric, inches, mixed fractions and feet with inches", () => {
  for (const [input, expected] of [
    ["250", 250],
    ["30 cm", 300],
    ["1.2m", 1200],
    ['3/8"', 9.525],
    ["2' 3 1/2\"", 698.5],
    ["-1 1/2 in", -38.1],
    ["2 ft", 609.6],
  ])
    near(parseDistance(input), expected);
  for (const value of ["", "1/0", "1e309", "abc", "1 + 2", "NaN"])
    assert.throws(() => parseDistance(value));
});
test("Follow Me creates watertight straight, mitered and closed-path solids", () => {
  for (const [points, volume] of [
    [
      [
        [0, 0, 0],
        [0, 0, 100],
      ],
      0.00001,
    ],
    [
      [
        [0, 0, 0],
        [0, 0, 100],
        [100, 0, 100],
      ],
      0.00002,
    ],
    [
      [
        [0, 0, 0],
        [100, 0, 0],
        [100, 100, 0],
        [0, 100, 0],
        [0, 0, 0],
      ],
      0.00004,
    ],
  ]) {
    const result = sweepProfile(square(), [path(points)]);
    near(quantities(result).volume, volume);
    const project = blankProject();
    project.objects = [result];
    validateProject(project);
  }
});
test("Follow Me preserves profile holes and rejects disconnected paths", () => {
  const profile = square();
  profile.holes = [
    [
      [-2, -2],
      [-2, 2],
      [2, 2],
      [2, -2],
    ],
  ];
  const result = sweepProfile(profile, [
    path([
      [0, 0, 0],
      [0, 0, 100],
    ]),
  ]);
  near(quantities(result).volume, 0.0000084);
  assert.throws(
    () =>
      connectedPath([
        path([
          [0, 0, 0],
          [10, 0, 0],
        ]),
        path([
          [20, 0, 0],
          [30, 0, 0],
        ]),
      ]),
    /disconnected/,
  );
  const connected = connectedPath([
    path([
      [10, 0, 0],
      [20, 0, 0],
    ]),
    path([
      [10, 0, 0],
      [0, 0, 0],
    ]),
  ]);
  assert.deepEqual(
    connected.map((p) => p.toArray()),
    [
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
    ],
  );
});
test("face Push/Pull commits the edited host once and undo restores its subdivisions", () => {
  const s = useEditor.getState();
  s.set({ engine: null });
  const project = blankProject(),
    host = entity({ size: [100, 100, 100], position: [0, 0, 0] });
  const subdivisions = offsetFace(host, 0, -10);
  project.objects = [host, ...subdivisions];
  s.load(project);
  const engine = Object.create(EditorEngine.prototype);
  engine.objects = new Map(
    project.objects.map((o) => [o.id, { visible: true }]),
  );
  engine.drawGroup = new T.Group();
  engine.marker = { visible: false };
  engine.mesh = () => new T.Group();
  const source = subdivisions.find((o) => !o.holes.length);
  engine.operation = {
    kind: "pushpull",
    source,
    face: { triangle: 0 },
    amount: -20,
  };
  engine.previewOperation();
  assert.ok([...engine.objects.values()].every((m) => !m.visible));
  engine.operation.amount = 0;
  engine.previewOperation();
  assert.ok([...engine.objects.values()].every((m) => m.visible));
  assert.equal(engine.drawGroup.children.length, 0);
  engine.finishOperation(-20);
  const current = useEditor.getState();
  assert.equal(current.project.objects.length, 1);
  assert.equal(current.project.objects[0].id, host.id);
  near(quantities(current.project.objects[0]).volume, 0.000872);
  current.undo();
  assert.equal(useEditor.getState().project.objects.length, 3);
});
