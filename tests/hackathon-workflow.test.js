import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { EditorEngine } from "../frontend/engine.js";
import { useEditor } from "../frontend/store.js";
import { blankProject, entity, validateProject } from "../shared/model.js";
import { objectGeometry, objectMatrix, bounds } from "../shared/geometry.js";
import { closedIntersections } from "../shared/motion.js";

function engineFor(project) {
  useEditor.getState().set({ engine: null });
  useEditor.getState().load(project);
  const e = Object.create(EditorEngine.prototype);
  e.points = [];
  e.anchors = [];
  e.drawGroup = new T.Group();
  e.marker = new T.Mesh(new T.SphereGeometry(1), new T.MeshBasicMaterial());
  e.objects = new Map(
    project.objects.map((o) => {
      const mesh = new T.Mesh(
        objectGeometry(o),
        new T.MeshBasicMaterial({ side: T.DoubleSide }),
      );
      mesh.applyMatrix4(objectMatrix(o));
      mesh.userData.id = o.id;
      mesh.updateMatrixWorld();
      return [o.id, mesh];
    }),
  );
  e.camera = new T.PerspectiveCamera(45, 4 / 3, 1, 100000);
  e.camera.position.set(3000, -4500, 3200);
  e.camera.up.set(0, 0, 1);
  e.camera.lookAt(600, 300, 1000);
  e.camera.updateMatrixWorld();
  e.renderer = {
    domElement: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    },
  };
  e.ray = new T.Raycaster();
  e.mouse = new T.Vector2();
  return e;
}
const screen = (e, p) => {
  const q = new T.Vector3(...p).project(e.camera);
  return { clientX: (q.x + 1) * 400, clientY: (1 - q.y) * 300 };
};
test("point-to-point move snaps a real panel corner to another panel, preserving dimensions and undo", () => {
  const p = blankProject(),
    a = entity({ size: [18, 600, 2100], position: [9, 300, 1050] }),
    b = entity({ size: [18, 600, 2100], position: [1191, 300, 1050] });
  p.objects = [a, b];
  const e = engineFor(p),
    s = useEditor.getState();
  s.set({
    tool: "move-snap",
    selection: [a.id],
    snapEnabled: true,
    axis: null,
    plane: "XY",
  });
  const start = [18, 0, 2100],
    end = [1182, 0, 2100];
  assert.ok(
    e.workPoint(screen(e, start)).point.distanceTo(new T.Vector3(...start)) <
      1e-6,
  );
  e.click(screen(e, start));
  assert.ok(e.snapMove);
  e.pointer(screen(e, end));
  assert.equal(
    useEditor.getState().project.objects[0].position[0],
    9,
    "preview must not edit document",
  );
  e.click(screen(e, end));
  const moved = useEditor.getState().project.objects.find((o) => o.id === a.id);
  assert.ok(Math.abs(bounds(moved).max.x - 1182) < 1e-6);
  assert.deepEqual(moved.size, a.size);
  useEditor.getState().undo();
  assert.deepEqual(
    useEditor.getState().project.objects[0].position,
    a.position,
  );
  useEditor.getState().redo();
  assert.ok(
    Math.abs(bounds(useEditor.getState().project.objects[0]).max.x - 1182) <
      1e-6,
  );
});
test("point-to-point move cancels without changing geometry and respects an axis constraint", () => {
  const p = blankProject(),
    a = entity({ size: [100, 100, 100], position: [0, 0, 50] });
  p.objects = [a];
  const e = engineFor(p);
  useEditor.getState().set({
    selection: [a.id],
    tool: "move-snap",
    snapEnabled: true,
    axis: null,
  });
  e.pick = () => ({ object: { userData: { id: a.id } } });
  e.workPoint = () => ({
    point: new T.Vector3(50, 0, 50),
    anchor: { id: a.id },
  });
  e.click({});
  e.workPoint = () => ({ point: new T.Vector3(500, 300, 250), anchor: null });
  e.pointer({});
  e.cancelDraw();
  assert.deepEqual(e.objects.get(a.id).position.toArray(), a.position);
  assert.equal(useEditor.getState().history.length, 0);
  e.workPoint = EditorEngine.prototype.workPoint;
  e.points = [new T.Vector3(50, 0, 50)];
  useEditor.getState().set({ axis: "X" });
  const constrained = e.workPoint(screen(e, [500, 300, 250]));
  assert.equal(constrained.point.y, 0);
  assert.equal(constrained.point.z, 50);
  assert.equal(constrained.type, "X axis");
});
test("document cabinet workflow: draw 600 by 2100, pull 18, duplicate, move, assemble, material, group, MongoDB reopen and edit", async () => {
  const p = blankProject("__test__ manual hackathon workflow"),
    e = engineFor(p),
    s = useEditor.getState();
  s.set({ tool: "rectangle", plane: "YZ" });
  let pt = new T.Vector3(0, 0, 0);
  e.workPoint = () => ({ point: pt.clone(), anchor: null });
  e.click({});
  pt.set(0, 600, 2100);
  e.click({});
  e.extrude(18);
  assert.deepEqual(
    useEditor.getState().project.objects[0].size,
    [18, 600, 2100],
  );
  useEditor.getState().duplicate();
  useEditor.getState().nudge(0, 1082);
  assert.equal(useEditor.getState().project.objects.length, 2);
  const boards = [
    ["Top", [1164, 600, 18], [600, 300, 2091]],
    ["Bottom", [1164, 600, 18], [600, 300, 9]],
    ["Divider", [18, 600, 2064], [600, 300, 1050]],
    ["Left shelf", [573, 580, 18], [304.5, 300, 1050]],
    ["Right shelf", [573, 580, 18], [895.5, 300, 1050]],
    ["Left door", [597, 18, 2096], [300, -11, 1050]],
    ["Right door", [597, 18, 2096], [900, -11, 1050]],
  ].map(([name, size, position]) => entity({ name, size, position }));
  useEditor.getState().add(boards, "Build remaining manual panels");
  let current = useEditor.getState();
  current.set({
    selection: current.project.objects.map((o) => o.id),
    face: null,
  });
  current.applyMaterial("plywood");
  useEditor.getState().group();
  current = useEditor.getState();
  validateProject(current.project);
  assert.equal(current.project.groups.length, 1);
  assert.ok(current.project.objects.every((o) => o.material === "plywood"));
  assert.deepEqual(closedIntersections(current.project.objects), []);
  const base = "http://127.0.0.1:3001/api/projects/" + p.id;
  try {
    const put = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current.project),
    });
    assert.equal(put.status, 200);
    const saved = await (await fetch(base)).json();
    assert.deepEqual(saved.objects, current.project.objects);
    useEditor.getState().load(saved);
    const shelf = saved.objects.find((o) => o.name === "Left shelf");
    useEditor
      .getState()
      .update(
        shelf.id,
        { position: [304.5, 300, 1200] },
        "Edit reopened shelf",
      );
    assert.equal(
      useEditor.getState().project.objects.find((o) => o.id === shelf.id)
        .position[2],
      1200,
    );
    useEditor.getState().undo();
    assert.equal(
      useEditor.getState().project.objects.find((o) => o.id === shelf.id)
        .position[2],
      1050,
    );
  } finally {
    await fetch(base, { method: "DELETE" });
  }
});

test("screen inference prefers an endpoint near a corner and identifies true 3D intersections", () => {
  const p = blankProject(),
    a = entity({ size: [600, 18, 2100], position: [300, 0, 1050] });
  p.objects = [a];
  let e = engineFor(p);
  useEditor
    .getState()
    .set({ tool: "move-snap", axis: null, snapEnabled: true });
  const v = [600, -9, 2100],
    mouse = screen(e, v);
  mouse.clientX += 4;
  const hit = e.workPoint(mouse);
  assert.equal(hit.type, "Endpoint");
  assert.ok(
    Math.abs(hit.point.x - 600) < 1e-6 &&
      Math.abs(hit.point.z - 2100) < 1e-6 &&
      Math.abs(Math.abs(hit.point.y) - 9) < 1e-6,
    "nearby thin-board corners must remain exact vertices",
  );
  const lines = blankProject();
  lines.objects = [
    entity({
      kind: "line",
      size: [1, 1, 1],
      position: [0, 0, 0],
      points: [
        [-600, 0, 0],
        [600, 0, 0],
      ],
    }),
    entity({
      kind: "line",
      size: [1, 1, 1],
      position: [0, 0, 0],
      points: [
        [100, -600, 0],
        [100, 600, 0],
      ],
    }),
  ];
  e = engineFor(lines);
  useEditor
    .getState()
    .set({ tool: "line", axis: null, plane: "XY", snapEnabled: true });
  const crossing = e.workPoint(screen(e, [100, 0, 0]));
  assert.equal(crossing.type, "Intersection");
  assert.ok(crossing.point.distanceTo(new T.Vector3(100, 0, 0)) < 1e-6);
  lines.objects[1].position[2] = 20;
  e = engineFor(lines);
  useEditor
    .getState()
    .set({ tool: "line", axis: null, plane: "XY", snapEnabled: true });
  assert.notEqual(
    e.workPoint(screen(e, [100, 0, 0])).type,
    "Intersection",
    "skew lines must not fabricate intersections",
  );
});
