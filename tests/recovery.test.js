import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { blankProject, entity } from "../shared/model.js";
import {
  writeRecovery,
  localProject,
  localProjects,
  latestRecovery,
} from "../frontend/recovery.js";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => {
    if (v.length > 5000000) throw Error("Quota exceeded");
    values.set(k, v);
  },
  removeItem: (k) => values.delete(k),
};
test("large textured projects recover through IndexedDB without duplicating data in localStorage", async () => {
  const p = blankProject("Large textured furniture");
  p.materials = [
    {
      id: "texture",
      name: "Texture",
      color: "#ffffff",
      map: "data:image/png;base64," + "A".repeat(6000000),
    },
  ];
  p.objects = [entity({ material: "texture" })];
  await writeRecovery(p);
  assert.deepEqual(await localProject(p.id), p);
  assert.deepEqual(await latestRecovery(), p);
  assert.ok([...values.values()].every((v) => v.length < 1000));
  assert.ok((await localProjects()).some((v) => v.id === p.id));
});
test("legacy recovery migrates only after a successful indexed database save", async () => {
  const p = blankProject("Legacy project");
  values.set("hazzino-project-" + p.id, JSON.stringify(p));
  values.set(
    "hazzino-project-index",
    JSON.stringify([{ id: p.id, name: p.name }]),
  );
  assert.deepEqual(await localProject(p.id), p);
  await writeRecovery(p);
  assert.equal(values.has("hazzino-project-" + p.id), false);
  assert.equal((await localProjects()).filter((v) => v.id === p.id).length, 1);
});
