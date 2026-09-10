import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  entity,
  blankProject,
  validateProject,
  quantities,
  polygonArea,
} from "../shared/model.js";
import {
  booleanObjects,
  initKernel,
  offsetFace,
  pushPullRegion,
  faceRegion,
} from "../shared/solid-kernel.js";
import { objectGeometry, bounds, extrudeObject } from "../shared/geometry.js";
await initKernel();
const cube = (x = 0) =>
  entity({ name: "Cube", size: [100, 100, 100], position: [x, 0, 0] });
const near = (a, b, epsilon = 1e-5) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
test("solid union, subtraction and intersection preserve exact overlap volumes", () => {
  const a = cube(),
    b = cube(50);
  for (const [operation, volume] of [
    ["union", 0.0015],
    ["subtract", 0.0005],
    ["intersect", 0.0005],
  ]) {
    const result = booleanObjects([a, b], operation);
    assert.equal(result.length, 1);
    near(quantities(result[0]).volume, volume);
    const p = blankProject();
    p.objects = result;
    assert.doesNotThrow(() => validateProject(JSON.parse(JSON.stringify(p))));
  }
  assert.deepEqual(a.size, [100, 100, 100]);
});
test("split returns three independent solids and handles disjoint intersection", () => {
  const results = booleanObjects([cube(), cube(50)], "split");
  assert.equal(results.length, 3);
  results.forEach((o) => near(quantities(o).volume, 0.0005));
  assert.equal(booleanObjects([cube(), cube(500)], "intersect").length, 0);
  assert.throws(() =>
    booleanObjects([cube(), { ...cube(), locked: true }], "union"),
  );
});
test("mesh transform, bounds, export geometry and dimensions stay consistent", () => {
  const o = booleanObjects([cube(), cube(50)], "union")[0];
  o.size[0] *= 2;
  o.rotation = [0, 0, 90];
  near(quantities(o).volume, 0.003);
  const box = bounds(o);
  near(box.max.y - box.min.y, 300, 0.001);
  near(box.max.x - box.min.x, 100, 0.001);
  const geometry = objectGeometry(o);
  assert.ok(geometry.index.count > 0);
  geometry.dispose();
});
test("offset a face creates an inner face and an extrudable border with a hole", () => {
  const face = entity({
    kind: "profile",
    name: "Square",
    profile: [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ],
    size: [100, 100, 0.1],
    position: [0, 0, 0],
    isFace: true,
  });
  const offset = offsetFace(face, 0, -10);
  assert.equal(offset.length, 2);
  const inner = offset.find((o) => !o.holes.length),
    border = offset.find((o) => o.holes.length);
  near(inner.size[0], 80);
  near(inner.size[1], 80);
  near(polygonArea(border.profile) - polygonArea(border.holes[0]), 3600);
  const solid = extrudeObject(border, 100);
  near(quantities(solid).volume, 0.00036);
  const p = blankProject();
  p.objects = offset;
  assert.doesNotThrow(() => validateProject(p));
  assert.throws(() => offsetFace(face, 0, -60));
});
test("arbitrary rotated mesh faces push and pull with correct signed volumes", () => {
  const cubeMesh = booleanObjects([cube(), cube(50)], "union")[0];
  const region = faceRegion(cubeMesh, 0);
  assert.ok(region.loops.length > 0);
  const source = cube();
  source.rotation = [0, 0, 37];
  const expanded = pushPullRegion(source, 0, 20);
  near(quantities(expanded).volume, 0.0012, 0.0000001);
  const inset = pushPullRegion(source, 0, -20);
  near(quantities(inset).volume, 0.0008, 0.0000001);
  const p = blankProject();
  p.objects = [expanded];
  assert.doesNotThrow(() => validateProject(p));
});
test("mesh import validation rejects nonfinite vertices and out-of-range triangles", () => {
  const p = blankProject();
  p.objects = booleanObjects([cube(), cube(50)], "union");
  p.objects[0].triangles[0] = 999999;
  assert.throws(() => validateProject(p));
  p.objects = booleanObjects([cube(), cube(50)], "union");
  p.objects[0].vertices[0] = NaN;
  assert.throws(() => validateProject(p));
});

test("offset subdivisions cut recesses and through-holes into their host solid", () => {
  const host = cube();
  const inner = offsetFace(host, 0, -10).find((o) => !o.holes.length);
  assert.equal(inner.hostId, host.id);
  const recess = pushPullRegion(host, 0, -20, inner);
  near(quantities(recess).volume, 0.001 - (80 * 80 * 20) / 1e9, 1e-8);
  const hole = pushPullRegion(host, 0, -100, inner);
  near(quantities(hole).volume, 0.001 - (80 * 80 * 100) / 1e9, 1e-8);
  const raised = pushPullRegion(host, 0, 20, inner);
  near(quantities(raised).volume, 0.001 + (80 * 80 * 20) / 1e9, 1e-8);
  const nested = offsetFace(inner, 0, -5);
  assert.ok(nested.every((o) => o.hostId === host.id));
});

test("walls with existing openings remain valid operands for solid tools", () => {
  const wall = entity({
    size: [1000, 100, 1000],
    openings: [{ x: 200, width: 200, sill: 100, height: 400 }],
  });
  const distant = entity({ size: [100, 100, 100], position: [2000, 0, 0] });
  const result = booleanObjects([wall, distant], "union")[0];
  near(quantities(result).volume, 0.093, 1e-7);
});
