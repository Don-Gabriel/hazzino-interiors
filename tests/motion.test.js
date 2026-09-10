import test from "node:test";
import assert from "node:assert/strict";
import {
  blankProject,
  entity,
  clone,
  validateProject,
} from "../shared/model.js";
import {
  FURNITURE_TYPES,
  defaultFurnitureSpec,
  buildFurniture,
  setFurnitureOpen,
} from "../shared/furniture.js";
import {
  motionJoints,
  jointKey,
  setJointOpen,
  attachJoint,
  closedIntersections,
  overlaps,
  placeBeside,
  inspectClearance,
} from "../shared/motion.js";
import { instantiateProject } from "../shared/project-import.js";
import { bounds, extrudeObject } from "../shared/geometry.js";
import { useEditor } from "../frontend/store.js";
import * as T from "three";
import { EditorEngine } from "../frontend/engine.js";
const project = (type, changes = {}) => ({
  ...blankProject(),
  ...buildFurniture({ ...defaultFurnitureSpec(type), ...changes }),
});
const near = (a, b, t = 0.02) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);

test("the transform gizmo rejects shearing rotated boards instead of distorting their dimensions", () => {
  const o = entity({ rotation: [0, 0, 37] }),
    p = { ...blankProject(), objects: [o] };
  useEditor.getState().load(p);
  useEditor.getState().set({ selection: [o.id], tool: "scale" });
  const mesh = new T.Object3D();
  mesh.position.fromArray(o.position);
  mesh.rotation.set(0, 0, (37 * Math.PI) / 180);
  mesh.updateMatrixWorld();
  const original = {
      id: o.id,
      matrix: mesh.matrixWorld.clone(),
      object: clone(o),
    },
    pivot = new T.Object3D();
  pivot.scale.set(2, 1, 1);
  const ctx = {
    dragging: true,
    pivot,
    startPivot: new T.Matrix4(),
    startObjects: [original],
    objects: new Map([[o.id, mesh]]),
    transform: { axis: "X" },
  };
  EditorEngine.prototype.previewTransform.call(ctx);
  assert.equal(ctx.invalidTransform, true);
  EditorEngine.prototype.endTransform.call(ctx);
  assert.deepEqual(useEditor.getState().project.objects[0].size, o.size);
  assert.equal(useEditor.getState().history.length, 0);
  ctx.dragging = true;
  ctx.startObjects = [original];
  pivot.scale.set(2, 2, 2);
  EditorEngine.prototype.previewTransform.call(ctx);
  assert.equal(ctx.invalidTransform, false);
  EditorEngine.prototype.endTransform.call(ctx);
  useEditor
    .getState()
    .project.objects[0].size.forEach((n, i) => near(n, o.size[i] * 2));
});

test("thicker enclosed fronts receive spacer clearance without panel overlap", () => {
  for (const thickness of [9, 18, 25, 50]) {
    const p = project("wardrobe", {
      thickness,
      reveal: thickness > 25 ? 6 : 2,
    });
    setFurnitureOpen(p, p.groups[0].id, 1);
    assert.deepEqual(closedIntersections(p.objects), []);
    assert.equal(p.groups[0].motionReport.blocked.length, 0);
    if (thickness > 18)
      assert.ok(p.objects.some((o) => o.name === "Drawer runner spacer"));
  }
  assert.throws(
    () => project("wardrobe", { thickness: 50, reveal: 2 }),
    /Double-door swing/,
  );
});

test("every furniture preset and front style keeps rigid dimensions and collision-free poses throughout opening and closing", () => {
  for (const [type] of FURNITURE_TYPES)
    for (const frontStyle of ["hinged", "sliding", "lift-up"]) {
      const p = project(type, { frontStyle, rotation: 37, x: 1200, y: 800 }),
        original = clone(p.objects),
        id = p.groups[0].id;
      for (const fraction of [0, 0.3, 0.55, 0.8, 1, 0.4, 0]) {
        setFurnitureOpen(p, id, fraction);
        assert.deepEqual(
          closedIntersections(p.objects),
          [],
          `${type}/${frontStyle}/${fraction}`,
        );
        p.objects.forEach((o, i) => assert.deepEqual(o.size, original[i].size));
      }
      p.objects.forEach((o, i) =>
        o.position.forEach((n, a) => near(n, original[i].position[a])),
      );
      validateProject(p);
    }
});

test("enclosed drawers wait for both doors and obstruct closing until they retract", () => {
  const p = project("wardrobe"),
    id = p.groups[0].id;
  const doors = motionJoints(p.objects).filter((j) =>
      j.parts.some((o) => /bay1\/door[LR]$/.test(o.partKey)),
    ),
    drawer = motionJoints(p.objects).find((j) => j.type === "drawer");
  assert.equal(doors.length, 2);
  assert.equal(setJointOpen(p, drawer.key, 1).actual, 0);
  assert.equal(setJointOpen(p, doors[0].key, 1).blocked, false);
  assert.equal(setJointOpen(p, drawer.key, 1).actual, 0);
  assert.equal(setJointOpen(p, doors[1].key, 1).blocked, false);
  assert.equal(setJointOpen(p, drawer.key, 1).blocked, false);
  assert.equal(setJointOpen(p, doors[0].key, 0).blocked, true);
  assert.deepEqual(closedIntersections(p.objects), []);
  setJointOpen(p, doors[0].key, 1);
  setJointOpen(p, drawer.key, 0);
  assert.equal(setJointOpen(p, doors[0].key, 0).blocked, false);
  setFurnitureOpen(p, id, 0.5);
  assert.ok(
    p.objects
      .filter((o) => o.role === "drawer-front")
      .every((o) => o.mechanism.appliedFraction === 0),
  );
  setFurnitureOpen(p, id, 1);
  assert.equal(p.groups[0].motionReport.blocked.length, 0);
});

test("sliding leaves expose either side while impossible centre drawers remain closed", () => {
  const bad = project("wardrobe", { frontStyle: "sliding" });
  for (const access of ["left", "right"]) {
    bad.groups[0].furnitureSpec.slidingAccess = access;
    setFurnitureOpen(bad, bad.groups[0].id, 1);
    assert.ok(bad.groups[0].motionReport.blocked.length);
    assert.ok(
      bad.objects
        .filter((o) => o.role === "drawer-front")
        .every((o) => o.mechanism.appliedFraction === 0),
    );
    assert.deepEqual(closedIntersections(bad.objects), []);
  }
  const defaults = defaultFurnitureSpec("wardrobe"),
    p = project("wardrobe", {
      frontStyle: "sliding",
      bays: [defaults.bays[0], defaults.bays[1]],
    });
  setFurnitureOpen(p, p.groups[0].id, 1);
  assert.equal(p.groups[0].motionReport.blocked.length, 0);
  const before = clone(p.objects.filter((o) => o.role === "door"));
  p.groups[0].furnitureSpec.slidingAccess = "left";
  setFurnitureOpen(p, p.groups[0].id, 1);
  assert.ok(
    p.objects
      .filter((o) => o.role === "drawer-front")
      .every((o) => o.mechanism.appliedFraction === 0),
  );
  assert.ok(
    p.objects
      .filter((o) => o.role === "door")
      .some((o, i) => Math.abs(o.position[0] - before[i].position[0]) > 100),
  );
});

test("L and U kitchen corners, wall units, handles and drawers stop before neighbouring units", () => {
  for (const layout of ["L", "U"]) {
    const spec = defaultFurnitureSpec("kitchen");
    spec.layout = layout;
    for (let run = 1; run <= (layout === "L" ? 1 : 2); run++)
      spec.modules.push(
        { type: "base", width: 600, run },
        { type: "drawers", width: 600, run },
      );
    const p = { ...blankProject(), ...buildFurniture(spec) };
    for (const f of [0, 0.4, 0.75, 1, 0]) {
      setFurnitureOpen(p, p.groups[0].id, f);
      assert.deepEqual(closedIntersections(p.objects), []);
    }
  }
});

test("manual boards and extrusions support the same rigid hinge and drawer interlocks, copy and undo", () => {
  const p = blankProject("Hand built cabinet"),
    left = entity({
      name: "Left door",
      size: [299, 18, 700],
      position: [-150.5, -300, 350],
    }),
    right = entity({
      name: "Right door",
      size: [299, 18, 700],
      position: [150.5, -300, 350],
    }),
    drawer = extrudeObject(
      entity({
        name: "Drawer front",
        size: [550, 0.1, 150],
        isFace: true,
        thinAxis: 1,
        position: [0, -240, 150],
      }),
      18,
    );
  p.objects = [left, right, drawer];
  const spec = {
    kind: "hinge",
    type: "door",
    axis: [0, 0, 1],
    direction: [0, -1, 0],
    travel: 400,
  };
  const l = attachJoint(p, [left.id], {
      ...spec,
      pivot: [-300, -309, 0],
      angle: -90,
    }),
    r = attachJoint(p, [right.id], {
      ...spec,
      pivot: [300, -309, 0],
      angle: 90,
    });
  const d = attachJoint(p, [drawer.id], {
    ...spec,
    kind: "slide",
    type: "drawer",
    pivot: [0, 0, 0],
    angle: 0,
    travel: 350,
  });
  assert.equal(setJointOpen(p, d, 1).actual, 0);
  setJointOpen(p, l, 1);
  assert.equal(setJointOpen(p, d, 1).actual, 0);
  setJointOpen(p, r, 1);
  assert.equal(setJointOpen(p, d, 1).blocked, false);
  validateProject(p);
  const copied = instantiateProject(p, blankProject());
  assert.notEqual(jointKey(copied.objects[0]), jointKey(left));
  useEditor.getState().load(p);
  useEditor
    .getState()
    .commit("Close handmade drawer", (p) => setJointOpen(p, d, 0));
  useEditor.getState().undo();
  near(useEditor.getState().project.objects[2].mechanism.appliedFraction, 1);
});

test("new library or generated assemblies are placed with clearance and retain mechanism pivots", () => {
  const p = project("wardrobe"),
    incoming = buildFurniture(defaultFurnitureSpec("cabinet")),
    source = clone(incoming.objects);
  placeBeside(incoming, p.objects);
  const oldMax = Math.max(...p.objects.map((o) => bounds(o).max.x)),
    newMin = Math.min(...incoming.objects.map((o) => bounds(o).min.x));
  near(newMin - oldMax, 150);
  assert.ok(
    !incoming.objects.some((a) => p.objects.some((b) => overlaps(a, b))),
  );
  incoming.objects.forEach((o, i) => {
    assert.deepEqual(o.size, source[i].size);
    if (o.mechanism)
      near(
        o.position[0] - source[i].position[0],
        o.mechanism.pivot[0] - source[i].mechanism.pivot[0],
      );
  });
});

test("clearance audit checks actual holes and reports rotated solid penetration", async () => {
  const panel = entity({
      kind: "profile",
      profile: [
        [-100, -100],
        [100, -100],
        [100, 100],
        [-100, 100],
      ],
      holes: [
        [
          [-30, -30],
          [-30, 30],
          [30, 30],
          [30, -30],
        ],
      ],
      size: [200, 200, 18],
      position: [0, 0, 0],
    }),
    peg = entity({ size: [20, 20, 30], position: [0, 0, 0] });
  assert.equal(overlaps(panel, peg), true);
  assert.deepEqual(await inspectClearance([panel, peg]), []);
  peg.position[0] = 70;
  assert.equal(
    (await inspectClearance([panel, peg]))[0].certainty,
    "confirmed",
  );
});
