import test from "node:test";
import assert from "node:assert/strict";
import { useEditor } from "../frontend/store.js";
import { handleShortcut } from "../frontend/shortcuts.js";
import { blankProject, entity, wardrobe } from "../shared/model.js";
function key(key, props = {}) {
  let prevented = false;
  handleShortcut({
    key,
    code: "",
    target: { tagName: "BODY" },
    preventDefault() {
      prevented = true;
    },
    ...props,
  });
  return prevented;
}
function reset() {
  useEditor.getState().load(blankProject("Keyboard test"));
  useEditor.setState({ modal: null, clipboard: null, engine: null });
}
test("Ctrl C/V preserves copied assemblies and Ctrl X/V moves without losing objects", () => {
  reset();
  const s = useEditor.getState(),
    w = wardrobe();
  s.add(w);
  key("c", { ctrlKey: true });
  key("v", { ctrlKey: true });
  assert.equal(useEditor.getState().project.objects.length, 32);
  assert.equal(useEditor.getState().project.groups.length, 2);
  key("x", { ctrlKey: true });
  assert.equal(useEditor.getState().project.objects.length, 16);
  key("v", { ctrlKey: true });
  assert.equal(useEditor.getState().project.objects.length, 32);
  key("z", { ctrlKey: true });
  assert.equal(useEditor.getState().project.objects.length, 16);
  key("y", { ctrlKey: true });
  assert.equal(useEditor.getState().project.objects.length, 32);
});
test("text editing and modal keys never delete model geometry", () => {
  reset();
  const s = useEditor.getState();
  s.add([entity()]);
  assert.equal(
    key("x", { ctrlKey: true, target: { tagName: "INPUT" } }),
    false,
  );
  assert.equal(key("Delete", { target: { tagName: "INPUT" } }), false);
  s.set({ modal: "help" });
  assert.equal(key("Delete"), false);
  assert.equal(useEditor.getState().project.objects.length, 1);
  key("Escape");
  assert.equal(useEditor.getState().modal, null);
});
test("menu navigation never invokes modelling shortcuts", () => {
  reset();
  const s = useEditor.getState();
  s.add([entity()]);
  const before = structuredClone(
    useEditor.getState().project.objects[0].position,
  );
  const target = { tagName: "BUTTON", closest: () => ({ role: "menu" }) };
  assert.equal(key("ArrowRight", { target }), false);
  assert.equal(key("Delete", { target }), false);
  assert.deepEqual(useEditor.getState().project.objects[0].position, before);
  assert.equal(useEditor.getState().project.objects.length, 1);
});
test("numpad and function-key routes invoke real camera commands", () => {
  reset();
  const calls = [];
  useEditor.setState({
    engine: {
      view: (v) => calls.push(v),
      fit: (selection) => calls.push(selection ? "selection" : "fit"),
      zoomStep: (f) => calls.push(f),
      orbitStep: (a, b) => calls.push([a, b]),
      toggleProjection: () => calls.push("projection"),
    },
  });
  key("1", { code: "Numpad1" });
  key("End", { code: "Numpad1", ctrlKey: true });
  key("Decimal", { code: "NumpadDecimal" });
  key("+", { code: "NumpadAdd" });
  key("5", { code: "Numpad5" });
  key("F3");
  assert.deepEqual(calls, [
    "front",
    "back",
    "selection",
    0.8,
    "projection",
    "fit",
  ]);
  const before = useEditor.getState().gridVisible;
  key("F7");
  assert.equal(useEditor.getState().gridVisible, !before);
  key("F1");
  assert.equal(useEditor.getState().modal, "help");
  useEditor.setState({ engine: null });
});
test("arrow modifiers nudge correct axes and locked parts stay fixed", () => {
  reset();
  const s = useEditor.getState(),
    o = entity({ position: [0, 0, 100] }),
    locked = entity({ locked: true, position: [0, 0, 100] });
  s.add([o, locked]);
  key("ArrowRight");
  key("PageUp", { shiftKey: true });
  key("ArrowDown", { altKey: true });
  const p = useEditor.getState().project;
  assert.deepEqual(p.objects[0].position, [10, -1, 200]);
  assert.deepEqual(p.objects[1].position, [0, 0, 100]);
});
test("paste in place and cross-project layer recovery remain valid", () => {
  reset();
  const s = useEditor.getState(),
    p = blankProject();
  p.layers.push({ id: "Custom", visible: true });
  p.objects = [entity({ layer: "Custom", position: [25, 50, 100] })];
  s.load(p);
  s.set({ selection: [p.objects[0].id] });
  key("c", { ctrlKey: true });
  s.newProject("Destination");
  key("v", { ctrlKey: true, shiftKey: true });
  const r = useEditor.getState().project;
  assert.deepEqual(r.objects[0].position, [25, 50, 100]);
  assert.ok(r.layers.some((l) => l.id === "Custom"));
});
