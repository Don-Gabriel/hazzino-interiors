import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { sceneEntities, importModelData } from "../shared/model-import.js";
import {
  blankProject,
  validateProject,
  materialFor,
  bom,
} from "../shared/model.js";
import { bounds } from "../shared/geometry.js";
test("import bakes nested transforms, converts metres and Y-up, and preserves materials/UVs", () => {
  const root = new T.Group(),
    parent = new T.Group(),
    material = new T.MeshStandardMaterial({ color: "#ff2200", roughness: 0.3 });
  material.name = "Red finish";
  const mesh = new T.Mesh(new T.BoxGeometry(1, 2, 3), material);
  mesh.position.set(3, 1, 0);
  parent.position.set(2, 0, 0);
  parent.add(mesh);
  root.add(parent);
  const result = sceneEntities(root, {
    scale: 1000,
    up: "Y",
    placeAtOrigin: false,
  });
  assert.equal(result.objects.length, 1);
  const [o] = result.objects;
  assert.deepEqual(o.size.map(Math.round), [1000, 3000, 2000]);
  assert.deepEqual(o.position.map(Math.round), [5000, 0, 1000]);
  assert.equal(o.uv.length, (o.vertices.length / 3) * 2);
  const project = Object.assign(blankProject(), result);
  validateProject(project);
  assert.equal(materialFor(project, o.material).name, "Red finish");
  assert.equal(bom(project)[0].material, "Red finish");
  assert.equal(bom(project)[0].cost, 0);
});
test("OBJ and ASCII STL import real triangles and can be placed at the origin", async () => {
  const obj = await importModelData(
    "v 0 0 0\nv 100 0 0\nv 0 100 0\nf 1 2 3\n",
    "obj",
  );
  assert.equal(obj.objects[0].triangles.length, 3);
  assert.deepEqual(obj.objects[0].size, [100, 100, 0.1]);
  const stl =
    "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 100 0 0\nvertex 0 100 0\nendloop\nendfacet\nendsolid t";
  const imported = await importModelData(stl, "stl", { placeAtOrigin: false });
  assert.equal(imported.objects[0].vertices.length, 9);
  assert.equal(bounds(imported.objects[0]).min.x, 0);
  await assert.rejects(() => importModelData("", "skp"), /Choose a GLB/);
});
test("import preserves material groups in one closed mesh and compensates mirrored triangle winding", () => {
  const material = new T.MeshStandardMaterial({ color: "red" }),
    other = new T.MeshStandardMaterial({ color: "blue" });
  const geometry = new T.BoxGeometry(10, 10, 10);
  geometry.groups.forEach((g, i) => (g.materialIndex = i % 2));
  const mesh = new T.Mesh(geometry, [material, other]);
  mesh.scale.x = -1;
  const imported = sceneEntities(mesh, { placeAtOrigin: false });
  assert.equal(imported.objects.length, 1);
  assert.equal(imported.objects[0].faceGroups.length, 6);
  assert.equal(imported.materials.length, 2);
  const project = Object.assign(blankProject(), imported);
  validateProject(project);
});
test("custom materials and mesh texture coordinates reject unsafe or malformed input", () => {
  const result = sceneEntities(
    new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()),
  );
  const project = Object.assign(blankProject(), result);
  validateProject(project);
  project.materials[0].map = "https://invalid.example/texture.png";
  assert.throws(() => validateProject(project), /texture/);
  delete project.materials[0].map;
  project.objects[0].uv = [0, 1];
  assert.throws(() => validateProject(project), /texture coordinates/);
});
