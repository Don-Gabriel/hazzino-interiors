import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateProject, blankProject } from "../shared/model.js";
import { instantiateProject } from "../shared/project-import.js";
import { objectGeometry } from "../shared/geometry.js";
const root = new URL("../public/models/", import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL("catalog.json", root), "utf8"),
);
test("all eight native SKP exports validate and their geometry and material groups remain intact", async () => {
  assert.equal(catalog.length, 8);
  for (const model of catalog) {
    assert.ok(model.file, model.name);
    assert.deepEqual(model.warnings, []);
    const project = JSON.parse(
      await readFile(new URL(model.file, root), "utf8"),
    );
    validateProject(project);
    assert.equal(project.objects.length, model.objects);
    let triangles = 0;
    for (const o of project.objects) {
      const geometry = objectGeometry(o);
      triangles += geometry.index.count / 3;
      assert.equal(geometry.groups.length, o.faceGroups.length);
      geometry.dispose();
    }
    assert.equal(triangles, model.triangles);
  }
});
test("inserting a library model twice creates independent IDs and reuses identical materials", async () => {
  const source = JSON.parse(
      await readFile(new URL(catalog[4].file, root), "utf8"),
    ),
    target = blankProject();
  const first = instantiateProject(source, target);
  Object.assign(target, {
    objects: first.objects,
    groups: first.groups,
    materials: first.materials,
  });
  const second = instantiateProject(source, target);
  target.objects.push(...second.objects);
  target.groups.push(...second.groups);
  target.materials.push(...second.materials);
  validateProject(target);
  assert.equal(target.objects.length, source.objects.length * 2);
  assert.equal(target.materials.length, source.materials.length);
  assert.notEqual(target.objects[0].id, source.objects[0].id);
});
