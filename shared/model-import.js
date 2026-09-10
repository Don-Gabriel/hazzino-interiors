import * as T from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { entity, uid } from "./model.js";

export function sceneEntities(
  scene,
  {
    name = "Imported model",
    scale = 1,
    up = "Z",
    placeAtOrigin = true,
    textureEncoder,
  } = {},
) {
  const wrapper = new T.Group();
  wrapper.add(scene);
  wrapper.scale.setScalar(scale);
  if (up === "Y") wrapper.rotation.x = Math.PI / 2;
  wrapper.updateMatrixWorld(true);
  const objects = [],
    materials = [],
    catalog = new Map(),
    groupId = uid();
  function materialId(material) {
    if (!material) return "plaster";
    if (catalog.has(material.uuid)) return catalog.get(material.uuid);
    const id = uid(),
      value = {
        id,
        name: (material.name || "Imported finish").slice(0, 200),
        color: "#" + (material.color?.getHexString() || "dddddd"),
        roughness: material.roughness ?? 0.7,
        metalness: material.metalness ?? 0,
        opacity: material.opacity ?? 1,
        rate: 0,
      };
    if (material.map?.image && textureEncoder) {
      const map = textureEncoder(material.map.image);
      if (map) {
        value.map = map;
        value.textureFlipY = material.map.flipY;
      }
    }
    materials.push(value);
    catalog.set(material.uuid, id);
    return id;
  }
  scene.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes.position) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const position = geometry.attributes.position,
      uv = geometry.attributes.uv;
    const indices = geometry.index
      ? Array.from(geometry.index.array)
      : Array.from({ length: position.count }, (_, i) => i);
    if (node.matrixWorld.determinant() < 0)
      for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const groups =
      Array.isArray(node.material) && geometry.groups.length
        ? geometry.groups
        : [{ start: 0, count: indices.length, materialIndex: 0 }];
    const vertices = [],
      triangles = [],
      coords = [],
      faceGroups = [];
    for (const group of groups) {
      const source = Array.isArray(node.material)
        ? node.material[group.materialIndex]
        : node.material;
      const selected = indices.slice(group.start, group.start + group.count),
        remap = new Map(),
        start = triangles.length;
      source?.map?.updateMatrix();
      for (const index of selected) {
        if (!remap.has(index)) {
          remap.set(index, vertices.length / 3);
          vertices.push(
            position.getX(index),
            position.getY(index),
            position.getZ(index),
          );
          if (uv) {
            const p = new T.Vector2(uv.getX(index), uv.getY(index));
            if (source?.map) p.applyMatrix3(source.map.matrix);
            coords.push(p.x, p.y);
          }
        }
        triangles.push(remap.get(index));
      }
      if (triangles.length > start)
        faceGroups.push({
          start,
          count: triangles.length - start,
          material: materialId(source),
        });
    }
    if (triangles.length < 3) {
      geometry.dispose();
      return;
    }
    const box = new T.Box3();
    for (let i = 0; i < vertices.length; i += 3)
      box.expandByPoint(new T.Vector3(...vertices.slice(i, i + 3)));
    const center = box.getCenter(new T.Vector3()).toArray(),
      size = box
        .getSize(new T.Vector3())
        .toArray()
        .map((v) => Math.max(0.1, v));
    for (let i = 0; i < vertices.length; i++) vertices[i] -= center[i % 3];
    objects.push(
      entity({
        kind: "mesh",
        name: node.name || name,
        vertices,
        triangles,
        meshSize: [...size],
        size,
        position: center,
        material: faceGroups[0].material,
        faceGroups,
        groupId,
        smooth: true,
        ...(uv ? { uv: coords } : {}),
      }),
    );
    geometry.dispose();
  });
  if (!objects.length) throw Error("This file contains no triangle geometry");
  if (placeAtOrigin) {
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const o of objects)
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], o.position[a] - o.size[a] / 2);
        max[a] = Math.max(max[a], o.position[a] + o.size[a] / 2);
      }
    const offset = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2]];
    for (const o of objects)
      o.position = o.position.map((v, a) => v - offset[a]);
  }
  return { objects, materials, groups: [{ id: groupId, name }] };
}

export async function importModelData(data, extension, options = {}) {
  const ext = extension.toLowerCase().replace(/^\./, ""),
    text = () =>
      typeof data === "string" ? data : new TextDecoder().decode(data);
  let scene;
  if (ext === "obj") scene = new OBJLoader().parse(text());
  else if (ext === "stl" || ext === "ply") {
    const geometry =
      ext === "stl" ? new STLLoader().parse(data) : new PLYLoader().parse(data);
    geometry.computeVertexNormals();
    scene = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({ color: "#d9d9d3" }),
    );
  } else if (ext === "glb" || ext === "gltf") {
    const manager = new T.LoadingManager();
    manager.setURLModifier((url) => {
      if (!url.startsWith("data:") && !url.startsWith("blob:"))
        throw Error(
          "Use a self-contained GLB file with embedded buffers and textures",
        );
      return url;
    });
    const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(data, "");
    scene = gltf.scene;
  } else throw Error("Choose a GLB, self-contained glTF, OBJ, STL or PLY file");
  try {
    return sceneEntities(scene, {
      scale: ext === "glb" || ext === "gltf" ? 1000 : 1,
      up: ext === "glb" || ext === "gltf" ? "Y" : "Z",
      ...options,
    });
  } finally {
    const textures = new Set(),
      geometries = new Set(),
      materials = new Set();
    scene.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material)
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          materials.add(material);
          for (const value of Object.values(material))
            if (value?.isTexture) textures.add(value);
        }
    });
    textures.forEach((t) => {
      t.image?.close?.();
      t.dispose();
    });
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
  }
}
