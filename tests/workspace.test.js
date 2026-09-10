import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  blankProject,
  entity,
  validateProject,
  materialFor,
} from "../shared/model.js";
import { DISPLAY_DEFAULTS } from "../shared/workspace.js";
import { useEditor } from "../frontend/store.js";
import { EditorEngine } from "../frontend/engine.js";
import { editorMenus, flattenCommands } from "../frontend/commands.js";

function reset() {
  const s = useEditor.getState();
  s.set({
    engine: null,
    ...DISPLAY_DEFAULTS,
    clipboard: null,
    selection: [],
    contextMenu: null,
  });
  s.load(blankProject("Workspace test"));
  return useEditor.getState();
}
function cameraHarness() {
  const engine = Object.create(EditorEngine.prototype);
  engine.camera = new T.OrthographicCamera(-100, 100, 100, -100, 1, 200000);
  engine.camera.position.set(1000, -2000, 3000);
  engine.camera.up.set(0, 0, 1);
  engine.camera.zoom = 2.75;
  engine.orthoSpan = 6300;
  engine.controls = { target: new T.Vector3(12, 20, 25), update() {} };
  engine.resizeView = () => {};
  engine.view = function (name) {
    this.camera =
      name === "perspective"
        ? new T.PerspectiveCamera()
        : new T.OrthographicCamera();
  };
  engine.fit = () => {};
  return engine;
}
test("scene roundtrip retains zoom, camera, display, hidden objects and tags", () => {
  let s = reset();
  const board = entity(),
    engine = cameraHarness();
  s.add([board]);
  s.set({ engine, xray: true, displayStyle: "monochrome", fogEnabled: true });
  s.commit("Hide source", (p) => {
    p.objects[0].visible = false;
    p.layers[0].visible = false;
  });
  engine.saveView("Study view");
  s = useEditor.getState();
  assert.equal(s.project.views.length, 1);
  const v = s.project.views[0];
  assert.equal(v.zoom, 2.75);
  assert.equal(v.display.xray, true);
  const portable = JSON.parse(JSON.stringify(s.project));
  validateProject(portable);
  s.load(portable);
  s.unhideAll();
  s.set({ xray: false, displayStyle: "textured" });
  s.activateScene(v.id);
  s = useEditor.getState();
  assert.equal(s.xray, true);
  assert.equal(s.displayStyle, "monochrome");
  assert.equal(s.project.objects[0].visible, false);
  assert.equal(s.project.layers[0].visible, false);
  assert.equal(engine.camera.zoom, 2.75);
  assert.deepEqual(engine.camera.position.toArray(), [1000, -2000, 3000]);
  assert.deepEqual(engine.controls.target.toArray(), [12, 20, 25]);
  assert.equal(s.activeViewId, v.id);
});
test("scene rename, reorder, update and deletion participate in undo/redo", () => {
  let s = reset();
  const engine = cameraHarness();
  s.set({ engine });
  engine.saveView("First");
  engine.saveView("Second");
  const [a, b] = useEditor.getState().project.views;
  s.renameScene(a.id, "Entrance");
  s.moveScene(b.id, -1);
  assert.equal(useEditor.getState().project.views[0].id, b.id);
  engine.camera.zoom = 3;
  s.updateScene(a.id);
  assert.equal(useEditor.getState().project.views[1].zoom, 3);
  s.removeScene(a.id);
  assert.equal(useEditor.getState().project.views.length, 1);
  s.undo();
  assert.equal(useEditor.getState().project.views[1].name, "Entrance");
  s.redo();
  assert.equal(useEditor.getState().project.views.length, 1);
});
test("invalid imported cameras, fog and materials cannot replace a project", () => {
  const s = reset(),
    engine = cameraHarness();
  s.set({ engine });
  engine.saveView();
  const good = useEditor.getState().project;
  for (const corrupt of [
    (p) => {
      p.views[0].zoom = 0;
    },
    (p) => {
      p.views[0].position = [NaN, 0, 0];
    },
    (p) => {
      p.views[0].display.fogFar = 2;
    },
    (p) => {
      p.views.push(structuredClone(p.views[0]));
    },
    (p) => {
      p.materialOverrides = { oak: { opacity: 2 } };
    },
    (p) => {
      p.materialOverrides = { oak: { color: "invalid" } };
    },
  ]) {
    const p = structuredClone(good);
    corrupt(p);
    s.load(p);
    assert.equal(useEditor.getState().project, good);
  }
});
test("legacy perspective views without projection flags remain readable", () => {
  const p = blankProject();
  p.views.push({
    id: "legacy-view",
    name: "View 1",
    position: [100, -100, 100],
    target: [0, 0, 0],
    up: [0, 0, 1],
  });
  assert.equal(validateProject(p), p);
});
test("material edits preserve face targeting, lock protection and zero opacity", () => {
  const s = reset(),
    board = entity(),
    locked = entity({ locked: true });
  s.add([board, locked]);
  s.set({ selection: [board.id, locked.id], face: { index: 2 } });
  s.applyMaterial("glass");
  let p = useEditor.getState().project;
  assert.equal(p.objects[0].faceMaterials[2], "glass");
  assert.equal(p.objects[0].material, "oak");
  assert.deepEqual(p.objects[1].faceMaterials, {});
  s.commit("Transparent glass", (p) => {
    p.materialOverrides = {
      glass: { opacity: 0, roughness: 0.2, color: "#123456" },
    };
  });
  p = useEditor.getState().project;
  assert.equal(materialFor(p, "glass").opacity, 0);
  assert.equal(materialFor(p, "glass").color, "#123456");
  s.undo();
  assert.equal(materialFor(useEditor.getState().project, "glass").opacity, 0.3);
});
test("menu selection actions filter hidden, locked and hidden-tag objects", () => {
  const s = reset(),
    normal = entity(),
    hidden = entity({ visible: false }),
    locked = entity({ locked: true }),
    hiddenTag = entity({ layer: "Architecture" });
  s.add([normal, hidden, locked, hiddenTag]);
  s.commit("Hide architecture", (p) => {
    p.layers.find((l) => l.id === "Architecture").visible = false;
  });
  const commands = () => flattenCommands(editorMenus());
  commands()
    .find((c) => c.id === "select-all")
    .run();
  assert.deepEqual(useEditor.getState().selection, [normal.id]);
  commands()
    .find((c) => c.id === "hide")
    .run();
  assert.equal(useEditor.getState().project.objects[0].visible, false);
  s.undo();
  assert.equal(useEditor.getState().project.objects[0].visible, true);
  s.set({ selection: [] });
  assert.equal(commands().find((c) => c.id === "delete").disabled, true);
  const ids = commands().map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});
test("circle drawing creates an extrudable profile on all drawing planes", () => {
  for (const plane of ["XY", "XZ", "YZ"]) {
    const s = reset(),
      engine = Object.create(EditorEngine.prototype);
    s.set({ tool: "circle", plane, curveSegments: 48 });
    engine.points = [];
    engine.anchors = [];
    const center = new T.Vector3(0, 0, 0),
      end =
        plane === "YZ" ? new T.Vector3(0, 100, 0) : new T.Vector3(100, 0, 0);
    let hit = center;
    engine.workPoint = () => ({ point: hit, anchor: null });
    engine.cancelDraw = () => {
      engine.points = [];
      engine.anchors = [];
    };
    engine.click({});
    hit = end;
    engine.click({});
    const p = useEditor.getState().project;
    validateProject(p);
    assert.equal(p.objects.length, 1);
    assert.equal(p.objects[0].profile.length, 48);
    assert.deepEqual(p.objects[0].size, [200, 200, 0.1]);
    assert.equal(p.objects[0].isFace, true);
    assert.equal(useEditor.getState().tool, "pushpull");
  }
});
