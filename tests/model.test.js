import test from "node:test";
import assert from "node:assert/strict";
import {
  entity,
  blankProject,
  validateProject,
  wardrobe,
  room,
  demoProject,
  quantities,
  bom,
  csv,
} from "../shared/model.js";
import {
  extrudeObject,
  boxFeatures,
  alignObjects,
  healthCheck,
  bounds,
} from "../shared/geometry.js";
import * as T from "three";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("upright 600 × 2100 rectangle extrudes to an exact 18 mm board", () => {
  const face = entity({
    name: "Rectangle",
    size: [600, 0.1, 2100],
    position: [300, 0, 1050],
    isFace: true,
    thinAxis: 1,
  });
  const board = extrudeObject(face, 18);
  assert.deepEqual(board.size, [600, 18, 2100]);
  assert.equal(board.name, "Board");
  assert.equal(board.isFace, false);
  close(board.position[1], 9);
  close(board.position[1] - board.size[1] / 2, 0);
  assert.deepEqual(face.size, [600, 0.1, 2100]);
});
test("push/pull changes the selected side and preserves the opposite face", () => {
  const o = entity({ size: [600, 18, 2100], position: [0, 0, 1050] });
  const result = extrudeObject(o, 100, { index: 1 });
  assert.equal(result.size[0], 700);
  assert.equal(result.position[0], -50);
  close(result.position[0] + result.size[0] / 2, 300);
});
test("rotated face extrusion moves along the rotated normal", () => {
  const o = entity({
    size: [100, 100, 100],
    rotation: [0, 0, 90],
    position: [0, 0, 0],
  });
  const p = extrudeObject(o, 20, { index: 0 });
  close(p.position[0], 0);
  close(p.position[1], 10);
});
test("inverted and nonfinite extrusions are rejected", () => {
  const o = entity({ size: [100, 100, 100] });
  assert.throws(() => extrudeObject(o, -101));
  assert.throws(() => extrudeObject(o, NaN));
});
test("wardrobe fits its requested outer dimensions with independently editable parts", () => {
  const w = wardrobe({
    width: 1200,
    height: 2100,
    depth: 600,
    thickness: 18,
    shelves: 3,
  });
  assert.equal(w.objects.length, 16);
  assert.equal(new Set(w.objects.map((o) => o.id)).size, 16);
  assert.ok(w.objects.every((o) => o.groupId === w.groups[0].id));
  const left = w.objects.find((o) => o.name === "Left side"),
    right = w.objects.find((o) => o.name === "Right side");
  close(left.position[0] - left.size[0] / 2, -600);
  close(right.position[0] + right.size[0] / 2, 600);
  assert.equal(w.objects.filter((o) => o.name.includes("shelf")).length, 6);
});
test("invalid cabinet board thickness is rejected", () =>
  assert.throws(() => wardrobe({ width: 50, thickness: 18 })));
test("room walls surround 5 × 4 metres of clear floor", () => {
  const r = room({ width: 5000, depth: 4000, height: 3000 });
  const left = r.objects.find((o) => o.name === "Left wall"),
    right = r.objects.find((o) => o.name === "Right wall");
  close(
    right.position[0] -
      right.size[0] / 2 -
      (left.position[0] + left.size[0] / 2),
    5000,
  );
  close((r.roomInfo.width * r.roomInfo.depth) / 1e6, 20);
  close(((5000 + 4000) * 2) / 1000, 18);
});
test("board quantities use its largest face, accurate volume and perimeter", () => {
  const q = quantities(entity({ size: [600, 18, 2100] }));
  close(q.area, 1.26);
  close(q.volume, 0.02268);
  close(q.edge, 5.4);
});
test("profile resize changes mesh-equivalent area and volume", () => {
  const q = quantities(
    entity({
      kind: "profile",
      profile: [
        [-50, -50],
        [50, -50],
        [50, 50],
        [-50, 50],
      ],
      size: [200, 300, 18],
    }),
  );
  close(q.volume, 0.00108);
  close(q.area, 0.138);
  close(q.edge, 1);
});
test("hidden objects remain in material quantities", () => {
  const p = blankProject();
  p.objects = [entity({ visible: false, size: [1000, 1000, 18], rate: 100 })];
  assert.equal(bom(p).length, 1);
  close(bom(p)[0].cost, 100);
});
test("rotated boxes produce true corner and midpoint snaps", () => {
  const o = entity({
    size: [200, 100, 100],
    position: [0, 0, 0],
    rotation: [0, 0, 90],
  });
  const f = boxFeatures(o);
  assert.equal(f.corners.length, 8);
  assert.equal(f.midpoints.length, 12);
  assert.equal(f.faces.length, 6);
  const b = bounds(o);
  close(b.max.x, 50);
  close(b.max.y, 100);
});
test("alignment respects rotated bounding faces", () => {
  const a = entity({
      size: [200, 100, 100],
      position: [0, 0, 0],
      rotation: [0, 0, 90],
    }),
    b = entity({ size: [20, 20, 20], position: [200, 0, 0] });
  const aligned = alignObjects([a, b], "X", "min");
  close(aligned[1].position[0], -40);
});
test("bounds collision check ignores touching faces but reports penetrations", () => {
  const p = blankProject();
  p.objects = [
    entity({ size: [100, 100, 100], position: [0, 0, 50] }),
    entity({ size: [100, 100, 100], position: [100, 0, 50] }),
  ];
  assert.equal(healthCheck(p).filter((w) => w.type === "overlap").length, 0);
  p.objects[1].position[0] = 90;
  assert.equal(healthCheck(p).filter((w) => w.type === "overlap").length, 1);
});
test("demo document survives JSON roundtrip", () => {
  const p = demoProject();
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
});
test("import rejects duplicate IDs, impossible sizes and nonfinite coordinates", () => {
  const p = blankProject();
  p.objects = [entity()];
  p.objects.push({ ...p.objects[0] });
  assert.throws(() => validateProject(p));
  p.objects.pop();
  p.objects[0].size[0] = -1;
  assert.throws(() => validateProject(p));
  p.objects[0].size[0] = 100;
  p.objects[0].position[0] = Infinity;
  assert.throws(() => validateProject(p));
});
test("CSV properly escapes commas, quotes and multiline object names", () =>
  assert.equal(csv([["a,b", 'a"b', "a\nb"]]), '"a,b","a""b","a\nb"'));
