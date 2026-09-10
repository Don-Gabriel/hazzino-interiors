import test from "node:test";
import assert from "node:assert/strict";
import {
  entity,
  blankProject,
  validateProject,
  clone,
} from "../shared/model.js";
import { machinePanel } from "../shared/machining.js";
import { toSolid, initKernel } from "../shared/solid-kernel.js";
import { cutList } from "../shared/production.js";
import {
  buildFurniture,
  defaultFurnitureSpec,
  setFurnitureOpen,
} from "../shared/furniture.js";
import { useEditor } from "../frontend/store.js";
const near = (a, b, t = 0.02) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
await initKernel();
const volume = (o) => {
  const solid = toSolid(o);
  try {
    return solid.volume();
  } finally {
    solid.delete();
  }
};

test("project import rejects malformed machining records before they reach production reports", () => {
  const part = entity({ size: [600, 400, 18] });
  const record = {
    type: "drill",
    axis: 2,
    side: 1,
    u: 37,
    v: 64,
    diameter: 5,
    holes: 8,
    depth: 12,
    through: false,
  };
  const project = (machining) => ({
    ...blankProject(),
    objects: [{ ...part, machining }],
  });
  validateProject(project([record]));
  validateProject(project([]));
  for (const malformed of [
    "drill",
    {},
    [null],
    [{ ...record, holes: 0 }],
    [{ ...record, diameter: NaN }],
    [{ ...record, axis: 3 }],
    [{ ...record, depth: -1 }],
    [{ ...record, type: "pocket", width: 10, height: -1 }],
  ]) {
    assert.throws(
      () => validateProject(project(malformed)),
      /machining record/,
    );
  }
});
test("rotated panels accept blind 32 mm drill patterns on either face without changing their blank", async () => {
  const part = entity({
    size: [600, 18, 2000],
    position: [100, 300, 1400],
    rotation: [10, 20, 35],
  });
  for (const side of [-1, 1]) {
    const result = await machinePanel(part, {
      type: "drill",
      axis: 1,
      side,
      u: 37,
      v: 100,
      diameter: 5,
      countU: 2,
      countV: 8,
      spacingU: 400,
      spacingV: 32,
      depth: 12,
      through: false,
    });
    const circleArea = (48 * 2.5 * 2.5 * Math.sin((2 * Math.PI) / 48)) / 2;
    const local = (o) => ({ ...o, position: [0, 0, 0], rotation: [0, 0, 0] });
    near(
      volume(local(part)) - volume(local(result)),
      16 * circleArea * 12,
      0.2,
    );
    result.size.forEach((n, i) => near(n, part.size[i]));
    result.rotation.forEach((n, i) => near(n, part.rotation[i]));
    validateProject({ ...blankProject(), objects: [result] });
  }
});
test("through holes and blind dado cuts remove the correct volume, accumulate machining notes and undo", async () => {
  const part = entity({ size: [600, 400, 18], position: [0, 0, 9] });
  const drilled = await machinePanel(part, {
    type: "drill",
    axis: 2,
    side: 1,
    u: 80,
    v: 100,
    diameter: 35,
    countU: 1,
    countV: 1,
    spacingU: 32,
    spacingV: 32,
    depth: 12,
    through: true,
  });
  const pocket = await machinePanel(drilled, {
    type: "pocket",
    axis: 2,
    side: 1,
    u: 200,
    v: 0,
    width: 18,
    height: 400,
    depth: 6,
    through: false,
  });
  near(volume(drilled) - volume(pocket), 18 * 400 * 6, 2);
  assert.equal(pocket.machining.length, 2);
  const p = { ...blankProject(), objects: [part] };
  useEditor.getState().load(p);
  useEditor.getState().commit("Machine panel", (p) => (p.objects[0] = pocket));
  const list = cutList(useEditor.getState().project);
  assert.equal(list[0].length, 600);
  assert.equal(list[0].width, 400);
  assert.equal(list[0].thickness, 18);
  assert.match(list[0].notes, /Ø35/);
  useEditor.getState().undo();
  assert.equal(useEditor.getState().project.objects[0].kind, "box");
});
test("invalid or locked machining leaves the source geometry untouched", async () => {
  const p = entity({ size: [600, 400, 18] }),
    before = clone(p),
    spec = {
      type: "drill",
      axis: 2,
      side: 1,
      u: 3,
      v: 30,
      diameter: 35,
      countU: 1,
      countV: 1,
      depth: 12,
      through: false,
    };
  await assert.rejects(machinePanel(p, spec), /fit/);
  await assert.rejects(
    machinePanel({ ...p, locked: true }, { ...spec, u: 80 }),
    /unlocked/,
  );
  await assert.rejects(
    machinePanel(p, { ...spec, u: 80, depth: 30 }),
    /thickness/,
  );
  assert.deepEqual(p, before);
});
test("hinge cups preserve furniture identity and the door opening mechanism", async () => {
  const p = {
      ...blankProject(),
      ...buildFurniture({ ...defaultFurnitureSpec("wardrobe"), rotation: 30 }),
    },
    door = p.objects.find((o) => o.role === "door"),
    old = clone(door);
  const result = await machinePanel(door, {
    type: "drill",
    axis: 1,
    side: 1,
    u: 22.5,
    v: 100,
    diameter: 35,
    countU: 1,
    countV: 2,
    spacingU: 32,
    spacingV: door.size[2] - 200,
    depth: 12,
    through: false,
  });
  p.objects[p.objects.findIndex((o) => o.id === door.id)] = result;
  setFurnitureOpen(p, p.groups[0].id, 1);
  setFurnitureOpen(p, p.groups[0].id, 0);
  validateProject(p);
  result.position.forEach((n, i) => near(n, old.position[i]));
  assert.equal(result.furnitureId, old.furnitureId);
});
