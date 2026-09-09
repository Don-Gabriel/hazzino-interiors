import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  entity,
  blankProject,
  validateProject,
  quantities,
} from "../shared/model.js";
import { openingGeometry } from "../shared/geometry.js";
import { quotationHTML, planSVG } from "../shared/reports.js";
import { EditorEngine } from "../frontend/engine.js";
import { useEditor } from "../frontend/store.js";
function meshVolume(g) {
  const index = g.index,
    position = g.attributes.position;
  let v = 0;
  for (let i = 0; i < index.count; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(position, index.getX(i)),
      b = new T.Vector3().fromBufferAttribute(position, index.getX(i + 1)),
      c = new T.Vector3().fromBufferAttribute(position, index.getX(i + 2));
    v += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(v);
}
function meshArea(g) {
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  let area = 0;
  for (let i = 0; i < g.index.count; i += 3) {
    a.fromBufferAttribute(g.attributes.position, g.index.getX(i));
    b.fromBufferAttribute(g.attributes.position, g.index.getX(i + 1));
    c.fromBufferAttribute(g.attributes.position, g.index.getX(i + 2));
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}
test("opening export omits internal cell faces", () => {
  const o = entity({
    size: [4000, 150, 2800],
    openings: [{ x: 1000, sill: 900, width: 1200, height: 1200 }],
  });
  const expected =
    2 * (4000 * 2800 + 4000 * 150 + 2800 * 150) -
    2 * 1200 * 1200 +
    2 * (1200 + 1200) * 150;
  assert.ok(Math.abs(meshArea(openingGeometry(o)) - expected) < 0.01);
});
test("degenerate profiles and complete wall removal are rejected", () => {
  const p = blankProject();
  p.objects = [
    entity({
      kind: "profile",
      profile: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    }),
  ];
  assert.throws(() => validateProject(p));
  p.objects = [
    entity({
      size: [1000, 150, 1000],
      openings: [{ x: 0, sill: 0, width: 1000, height: 1000 }],
    }),
  ];
  assert.throws(() => validateProject(p));
});
test("door opening removes the actual mesh volume and matching quantity", () => {
  const o = entity({
    name: "Wall",
    size: [4000, 150, 2800],
    openings: [{ id: "door", x: 1000, sill: 0, width: 900, height: 2100 }],
  });
  const g = openingGeometry(o);
  assert.ok(Math.abs(meshVolume(g) - (4000 * 2800 - 900 * 2100) * 150) < 0.01);
  assert.ok(Math.abs(quantities(o).volume - meshVolume(g) / 1e9) < 1e-9);
  assert.ok(g.groups.every((g) => g.materialIndex < 6));
  g.dispose();
});
test("window ray passes through opening but intersects wall beside it", () => {
  const o = entity({
    size: [4000, 150, 2800],
    position: [0, 0, 1400],
    openings: [{ x: 1000, sill: 900, width: 1200, height: 1200 }],
  });
  const mesh = new T.Mesh(
    openingGeometry(o),
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  mesh.position.fromArray(o.position);
  mesh.updateMatrixWorld();
  const ray = new T.Raycaster(
    new T.Vector3(-400, -1000, 1400),
    new T.Vector3(0, 1, 0),
  );
  assert.equal(ray.intersectObject(mesh).length, 0);
  ray.ray.origin.x = 1500;
  assert.ok(ray.intersectObject(mesh).length > 0);
});
test("overlapping and out-of-bounds openings reject before model changes", () => {
  const p = blankProject();
  p.objects = [
    entity({
      size: [1000, 150, 1000],
      openings: [{ x: 900, sill: 0, width: 200, height: 500 }],
    }),
  ];
  assert.throws(() => validateProject(p));
  p.objects[0].openings = [
    { x: 0, sill: 0, width: 500, height: 500 },
    { x: 100, sill: 100, width: 500, height: 500 },
  ];
  assert.throws(() => validateProject(p));
});
test("profile mesh and saved dimensions agree after resizing", () => {
  const engine = Object.create(EditorEngine.prototype);
  engine.material = () => new T.MeshBasicMaterial();
  const o = entity({
    kind: "profile",
    profile: [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ],
    size: [200, 300, 18],
    position: [0, 0, 0],
  });
  const mesh = engine.mesh(o);
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox.getSize(new T.Vector3());
  assert.deepEqual(size.toArray(), [200, 300, 18]);
});
test("reports escape user-controlled names and export SVG", () => {
  const p = blankProject("<script>alert(1)</script>");
  p.objects = [
    entity({ name: "<img src=x onerror=alert(1)>", position: [0, 0, 0] }),
  ];
  const html = quotationHTML(p);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  const svg = planSVG(p);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("<polygon"));
});
test("associative dimension endpoints follow resized and moved boards", () => {
  const o = entity({ size: [1000, 18, 2000], position: [100, 0, 1000] });
  const p = blankProject();
  p.objects = [o];
  useEditor.setState({ project: p });
  const mesh = new T.Mesh(new T.BoxGeometry(...o.size));
  mesh.position.fromArray(o.position);
  const engine = Object.create(EditorEngine.prototype);
  engine.objects = new Map([[o.id, mesh]]);
  const dimension = entity({
    kind: "dimension",
    points: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    anchors: [
      { id: o.id, local: [300, 0, 1000], fractions: [0.5, 0, 0.5] },
      { id: o.id, local: [-300, 0, 1000], fractions: [-0.5, 0, 0.5] },
    ],
  });
  const pts = engine.dimensionPoints(dimension);
  assert.equal(pts[0].distanceTo(pts[1]), 1000);
  assert.equal(pts[0].x, 600);
  assert.equal(pts[0].z, 2000);
});
