import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, entity } from "../shared/model.js";
import "fake-indexeddb/auto";
import { latestRecovery } from "../frontend/recovery.js";
globalThis.localStorage = {
  values: new Map(),
  getItem(k) {
    return this.values.get(k) || null;
  },
  setItem(k, v) {
    this.values.set(k, v);
  },
  removeItem(k) {
    this.values.delete(k);
  },
};
const { useEditor } = await import("../frontend/store.js");
test("create → resize → duplicate → group → undo → redo preserves source data", async () => {
  const s = useEditor.getState();
  s.load(blankProject("Integration test"));
  const o = entity({ size: [600, 18, 2100] });
  s.add([o], "Create board");
  s.update(o.id, { size: [800, 18, 2100] });
  s.duplicate([1200, 0, 0]);
  let state = useEditor.getState();
  assert.equal(state.project.objects.length, 2);
  assert.equal(state.project.objects[1].position[0], 1200);
  state.set({ selection: state.project.objects.map((o) => o.id) });
  state.group();
  state = useEditor.getState();
  assert.equal(state.project.groups.length, 1);
  state.undo();
  assert.equal(useEditor.getState().project.groups.length, 0);
  state.redo();
  assert.equal(useEditor.getState().project.groups.length, 1);
  await useEditor.getState().recover();
  assert.equal((await latestRecovery()).objects.length, 2);
});
test("invalid edit is atomic and does not pollute undo history", () => {
  const s = useEditor.getState(),
    before = s.project,
    history = s.history.length;
  s.update(before.objects[0].id, { size: [-1, 18, 2100] });
  assert.equal(useEditor.getState().project, before);
  assert.equal(useEditor.getState().history.length, history);
  assert.match(useEditor.getState().status, /greater than zero/);
});
test("locked components survive delete", () => {
  const s = useEditor.getState();
  s.load(blankProject());
  const o = entity({ locked: true });
  s.add([o]);
  s.remove();
  assert.equal(useEditor.getState().project.objects.length, 1);
});
