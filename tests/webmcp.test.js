import test from "node:test";
import assert from "node:assert/strict";
import { blankProject } from "../shared/model.js";
import { useEditor } from "../frontend/store.js";
import { registerModelTools } from "../frontend/webmcp.js";
test("model tool contract validates before changing the common editor store", async () => {
  const registry = new Map();
  globalThis.document = {
    modelContext: { registerTool: (t) => registry.set(t.name, t) },
  };
  const cleanup = registerModelTools();
  assert.deepEqual(
    [...registry.keys()],
    ["read_design", "create_boards", "save_design"],
  );
  useEditor.getState().load(blankProject());
  const create = registry.get("create_boards");
  const result = await create.execute({
    boards: [
      {
        name: "Tool-created board",
        size: [600, 18, 2100],
        position: [0, 0, 1050],
      },
    ],
  });
  assert.equal(result.count, 1);
  assert.equal(
    registry.get("read_design").execute().project.objects[0].size[1],
    18,
  );
  assert.throws(() =>
    create.execute({
      boards: [{ name: "Bad", size: [-1, 18, 2100], position: [0, 0, 0] }],
    }),
  );
  assert.equal(useEditor.getState().project.objects.length, 1);
  cleanup();
  delete globalThis.document;
});
