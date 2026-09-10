import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, validateProject, clone } from "../shared/model.js";
import {
  FURNITURE_TYPES,
  defaultFurnitureSpec,
  buildFurniture,
  replaceFurniture,
  setFurnitureOpen,
} from "../shared/furniture.js";
import { bounds, objectGeometry } from "../shared/geometry.js";
import {
  cutList,
  cutListCSV,
  nestPanels,
  productionHTML,
  nestingSVG,
} from "../shared/production.js";
import { instantiateProject } from "../shared/project-import.js";
import {
  translateAssembly,
  selectionProject,
  groupObjects,
} from "../shared/assemblies.js";
import { initKernel, toSolid } from "../shared/solid-kernel.js";
import { useEditor } from "../frontend/store.js";
const near = (a, b, tol = 0.02) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
function project(type, changes = {}) {
  return {
    ...blankProject("Furniture QA"),
    ...buildFurniture({ ...defaultFurnitureSpec(type), ...changes }),
  };
}
function envelope(objects) {
  const boxes = objects.map(bounds);
  return {
    min: [0, 1, 2].map((a) =>
      Math.min(...boxes.map((b) => b.min.getComponent(a))),
    ),
    max: [0, 1, 2].map((a) =>
      Math.max(...boxes.map((b) => b.max.getComponent(a))),
    ),
  };
}
test("all eight furniture types generate valid editable parts with exact overall dimensions", () => {
  for (const [type] of FURNITURE_TYPES) {
    const spec = defaultFurnitureSpec(type),
      p = project(type);
    validateProject(p);
    assert.ok(p.objects.length > 10);
    assert.equal(new Set(p.objects.map((o) => o.id)).size, p.objects.length);
    const b = envelope(p.objects.filter((o) => o.role !== "hardware"));
    if (type !== "kitchen") {
      near(b.max[0] - b.min[0], spec.width);
      near(b.max[1] - b.min[1], spec.depth);
      near(b.min[2], spec.elevation);
      near(b.max[2], spec.elevation + spec.height);
    } else {
      near(b.max[0] - b.min[0], 3000);
      near(
        Math.max(
          ...p.objects
            .filter((o) => o.role === "worktop")
            .map((o) => bounds(o).max.z),
        ),
        900,
      );
    }
    assert.ok(p.objects.every((o) => o.furnitureId === p.groups[0].id));
  }
});
test("doors pivot with their handles, drawers slide without changing cut sizes, closing is reversible", () => {
  const p = project("wardrobe", {
      rotation: 37,
      x: 1000,
      y: -200,
      elevation: 500,
    }),
    id = p.groups[0].id,
    closed = clone(p),
    cut = cutList(p);
  setFurnitureOpen(p, id, 1);
  const door = p.objects.find((o) => o.role === "door"),
    handle = p.objects.find((o) => o.partKey === door.partKey + "/handle"),
    distance = (a, b) =>
      Math.hypot(...a.position.map((n, i) => n - b.position[i]));
  near(
    distance(door, handle),
    distance(
      closed.objects.find((o) => o.id === door.id),
      closed.objects.find((o) => o.id === handle.id),
    ),
  );
  const drawer = p.objects.find((o) => o.role === "drawer-front");
  near(
    distance(
      drawer,
      closed.objects.find((o) => o.id === drawer.id),
    ),
    drawer.mechanism.travel,
  );
  assert.deepEqual(cutList(p), cut);
  setFurnitureOpen(p, id, 0);
  p.objects.forEach((o, i) => {
    o.position.forEach((n, a) => near(n, closed.objects[i].position[a]));
    o.rotation.forEach((n, a) => near(n, closed.objects[i].rotation[a]));
  });
});
test("kitchen worktop cutouts are watertight solids with correctly reduced volume", async () => {
  await initKernel();
  const p = project("kitchen");
  for (const o of p.objects.filter((o) => o.cutout)) {
    const solid = toSolid(o);
    near(
      solid.volume(),
      (o.size[0] * o.size[1] - o.cutout.width * o.cutout.depth) * o.size[2],
      2,
    );
    solid.delete();
  }
});
test("L and U kitchen returns face inward and cabinet bodies do not overlap other modules", () => {
  for (const layout of ["L", "U"]) {
    const spec = defaultFurnitureSpec("kitchen");
    spec.layout = layout;
    for (let run = 1; run <= (layout === "L" ? 1 : 2); run++)
      spec.modules.push(
        { type: "base", width: 600, run },
        { type: "drawers", width: 900, run },
      );
    const p = { ...blankProject(), ...buildFurniture(spec) };
    validateProject(p);
    const cabinets = p.groups
      .filter((g) => g.id.includes(":module"))
      .map((g) => ({
        g,
        b: envelope(
          p.objects.filter((o) => o.groupId === g.id && o.role !== "hardware"),
        ),
      }));
    for (let i = 0; i < cabinets.length; i++)
      for (let j = i + 1; j < cabinets.length; j++) {
        const a = cabinets[i].b,
          b = cabinets[j].b;
        assert.ok(
          [0, 1, 2].some(
            (k) =>
              Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) <
              0.01,
          ),
          `${cabinets[i].g.name} overlaps ${cabinets[j].g.name}`,
        );
      }
    for (const o of p.objects.filter(
      (o) => o.role === "door" && o.partKey.startsWith("module4/"),
    ))
      near(o.rotation[2], -90);
  }
});
test("furniture copy, move, open, reconfigure and undo retain independent assemblies", () => {
  const p = project("shoe");
  useEditor.getState().load(p);
  const s = useEditor.getState(),
    id = p.groups[0].id;
  s.set({ selection: p.objects.map((o) => o.id) });
  s.copy();
  s.paste();
  let state = useEditor.getState();
  const copyId = state.project.objects.find((o) =>
    state.selection.includes(o.id),
  ).furnitureId;
  assert.notEqual(copyId, id);
  assert.equal(groupObjects(state.project, copyId).length, p.objects.length);
  state.nudge(0, 1200);
  state = useEditor.getState();
  const spec = state.project.groups.find((g) => g.id === copyId).furnitureSpec;
  near(spec.x, 1300);
  const before = clone(
    state.project.objects.filter((o) => o.furnitureId === copyId),
  );
  state.commit("Open", (p) => setFurnitureOpen(p, copyId, 1));
  state.commit("Close", (p) => setFurnitureOpen(p, copyId, 0));
  useEditor
    .getState()
    .project.objects.filter((o) => o.furnitureId === copyId)
    .forEach((o, i) =>
      o.position.forEach((n, a) => near(n, before[i].position[a])),
    );
  state = useEditor.getState();
  state.commit("Reconfigure", (p) =>
    replaceFurniture(p, copyId, { ...spec, width: 1500 }),
  );
  let newer = useEditor.getState().project;
  near(newer.groups.find((g) => g.id === copyId).furnitureSpec.width, 1500);
  near(newer.groups.find((g) => g.id === id).furnitureSpec.width, 1000);
  state.undo();
  near(
    useEditor.getState().project.groups.find((g) => g.id === copyId)
      .furnitureSpec.width,
    1000,
  );
});
test("partial furniture copies become independent parts and invalid regeneration is atomic", () => {
  const p = project("desk"),
    part = p.objects.find((o) => o.role === "drawer-front"),
    partial = selectionProject(p, [part.id]);
  assert.ok(!partial.objects[0].furnitureId);
  assert.ok(!partial.groups.some((g) => g.furnitureSpec));
  useEditor.getState().load(p);
  const state = useEditor.getState(),
    before = state.project;
  assert.equal(
    state.commit("Invalid", (p) =>
      replaceFurniture(p, p.groups[0].id, {
        ...p.groups[0].furnitureSpec,
        width: 100,
      }),
    ),
    false,
  );
  assert.equal(useEditor.getState().project, before);
  const target = blankProject(),
    copy = translateAssembly(instantiateProject(p, target), [500, 300, 100]);
  validateProject({
    ...target,
    ...copy,
    layers: [...target.layers, ...copy.layers],
  });
});
test("cut lists follow actual resized panels and sheet placement respects grain, kerf and material", () => {
  const p = project("wardrobe"),
    panel = p.objects.find((o) => o.role === "shelf");
  panel.size[0] = 777;
  assert.ok(
    cutList(p).some((row) => row.ids.includes(panel.id) && row.length === 777),
  );
  const rows = cutList(p),
    plan = nestPanels(rows),
    placed = plan.sheets.flatMap((s) => s.parts);
  assert.equal(
    placed.length + plan.unplaced.length,
    rows.reduce((n, r) => n + r.quantity, 0),
  );
  for (const sheet of plan.sheets) {
    for (const part of sheet.parts) {
      assert.equal(part.materialId, sheet.materialId);
      assert.equal(part.thickness, sheet.thickness);
      assert.ok(!part.rotated);
      assert.ok(
        part.x >= 0 &&
          part.y >= 0 &&
          part.x + part.placedLength <= sheet.length + 0.01 &&
          part.y + part.placedWidth <= sheet.width + 0.01,
      );
    }
    for (let i = 0; i < sheet.parts.length; i++)
      for (let j = i + 1; j < sheet.parts.length; j++) {
        const a = sheet.parts[i],
          b = sheet.parts[j];
        assert.ok(
          a.x + a.placedLength + plan.kerf <= b.x + 0.01 ||
            b.x + b.placedLength + plan.kerf <= a.x + 0.01 ||
            a.y + a.placedWidth + plan.kerf <= b.y + 0.01 ||
            b.y + b.placedWidth + plan.kerf <= a.y + 0.01,
        );
      }
  }
  assert.ok(plan.utilization > 0 && plan.utilization <= 1);
  assert.match(nestingSVG(plan), /<svg/);
  p.name = "<script>bad</script>";
  p.objects[0].name = "=SUM(A1)";
  assert.ok(cutListCSV(p).includes("'=SUM(A1)"));
  assert.ok(!productionHTML(p).includes("<script>bad"));
});
test("impossible compartments, drawers, oversized thickness and overlapping wall units reject", () => {
  assert.throws(
    () => buildFurniture({ ...defaultFurnitureSpec("wardrobe"), width: 250 }),
    /compartment/i,
  );
  assert.throws(
    () => buildFurniture({ ...defaultFurnitureSpec("desk"), height: 200 }),
    /drawer/i,
  );
  assert.throws(
    () =>
      buildFurniture({
        ...defaultFurnitureSpec("kitchen"),
        wallElevation: 950,
      }),
    /200 mm/,
  );
});
test("sliding doors stack on separate tracks and lift-up loft doors rotate outward about their top", () => {
  for (const frontStyle of ["sliding", "lift-up"]) {
    const p = project("loft", { frontStyle, rotation: 25 }),
      id = p.groups[0].id,
      closed = clone(p.objects.filter((o) => o.role === "door"));
    setFurnitureOpen(p, id, 1);
    const doors = p.objects.filter((o) => o.role === "door");
    if (frontStyle === "sliding") {
      assert.equal(doors.length, 2);
      near(doors[0].position[2], closed[0].position[2]);
      near(
        Math.hypot(
          ...doors[0].position.map((n, i) => n - doors[1].position[i]),
        ),
        20,
      );
    } else
      doors.forEach((o, i) => assert.ok(o.position[2] > closed[i].position[2]));
    setFurnitureOpen(p, id, 0);
    doors.forEach((o, i) =>
      o.position.forEach((n, a) => near(n, closed[i].position[a])),
    );
    validateProject(p);
  }
});
test("default wardrobe backs fit standard sheets and mixed storage has distinct lower drawers and upper shelves", () => {
  const p = project("wardrobe"),
    backs = p.objects.filter((o) => o.role === "back");
  assert.ok(backs.length >= 3);
  backs.forEach((o) => assert.ok(o.size[0] <= 1220));
  const mixed = p.objects.filter((o) => o.partKey.startsWith("carcass/bay1/")),
    drawers = mixed.filter((o) => o.role === "drawer-front"),
    shelves = mixed.filter((o) => o.role === "shelf");
  assert.equal(drawers.length, 2);
  assert.ok(shelves.length >= 3);
  assert.ok(
    Math.max(...drawers.map((o) => bounds(o).max.z)) <
      Math.min(...shelves.map((o) => bounds(o).min.z)) + 0.01,
  );
});
