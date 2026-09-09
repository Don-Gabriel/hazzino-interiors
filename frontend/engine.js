import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { entity, MATERIALS, clone } from "../shared/model.js";
import {
  boxFeatures,
  extrudeObject,
  openingGeometry,
} from "../shared/geometry.js";
import { useEditor, download } from "./store.js";
T.Object3D.DEFAULT_UP.set(0, 0, 1);
const rad = (n) => (n * Math.PI) / 180,
  deg = (n) => (n * 180) / Math.PI;
const vec = (a) => new T.Vector3(...a);
export class EditorEngine {
  constructor(container) {
    this.container = container;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#eef0ec");
    this.scene.fog = new T.Fog("#eef0ec", 22000, 65000);
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);
    this.camera = new T.PerspectiveCamera(42, 1, 1, 200000);
    this.camera.position.set(7500, -9500, 7000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 800);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxDistance = 90000;
    this.controls.minDistance = 20;
    this.controls.screenSpacePanning = true;
    this.scene.add(new T.HemisphereLight(0xffffff, 0xa0a49b, 2.4));
    this.sun = new T.DirectionalLight(0xfff4de, 3.2);
    this.sun.position.set(-4000, -6000, 10000);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -10000,
      right: 10000,
      top: 10000,
      bottom: -10000,
      near: 100,
      far: 35000,
    });
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 1;
    this.scene.add(this.sun);
    const fill = new T.DirectionalLight(0xd9e6ff, 1);
    fill.position.set(6000, 4000, 6000);
    this.scene.add(fill);
    this.model = new T.Group();
    this.scene.add(this.model);
    this.helpers = new T.Group();
    this.scene.add(this.helpers);
    this.drawGroup = new T.Group();
    this.scene.add(this.drawGroup);
    this.objects = new Map();
    this.textures = new Map();
    this.ray = new T.Raycaster();
    this.ray.params.Line.threshold = 12;
    this.mouse = new T.Vector2();
    this.points = [];
    this.anchors = [];
    this.pivot = new T.Object3D();
    this.scene.add(this.pivot);
    this.transform = new TransformControls(
      this.camera,
      this.renderer.domElement,
    );
    this.transform.setSize(0.8);
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener("dragging-changed", (e) => {
      this.controls.enabled = !e.value;
      if (e.value) this.beginTransform();
      else this.endTransform();
    });
    this.transform.addEventListener("objectChange", () =>
      this.previewTransform(),
    );
    this.marker = new T.Mesh(
      new T.SphereGeometry(15, 10, 10),
      new T.MeshBasicMaterial({ color: 0xd59c3d, depthTest: false }),
    );
    this.marker.renderOrder = 1000;
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.onDown = (e) => {
      this.down = [e.clientX, e.clientY];
    };
    this.onUp = (e) => {
      if (
        e.button !== 0 ||
        !this.down ||
        Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5 ||
        this.transform.dragging ||
        this.transform.axis
      )
        return;
      this.click(e);
    };
    this.onMove = (e) => this.pointer(e);
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    this.renderer.domElement.addEventListener("pointerup", this.onUp);
    this.renderer.domElement.addEventListener("pointermove", this.onMove);
    this.resize = new ResizeObserver(() => this.resizeView());
    this.resize.observe(container);
    this.unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.project !== prev.project) {
        this.rebuild();
        if (s.project.settings.grid !== prev.project.settings.grid)
          this.makeGrid();
      }
      if (
        s.selection !== prev.selection ||
        s.tool !== prev.tool ||
        s.axis !== prev.axis ||
        s.selectionMode !== prev.selectionMode ||
        s.project !== prev.project
      )
        this.syncSelection();
      if (s.tool !== prev.tool) {
        this.cancelDraw();
        this.controls.enableRotate = ![
          "rectangle",
          "line",
          "polygon",
          "measure",
        ].includes(s.tool);
        this.renderer.domElement.style.cursor = [
          "rectangle",
          "line",
          "polygon",
          "measure",
        ].includes(s.tool)
          ? "crosshair"
          : "default";
      }
      if (
        s.project !== prev.project ||
        [
          "gridVisible",
          "edges",
          "shadows",
          "xray",
          "section",
          "sectionHeight",
          "snapEnabled",
          "axis",
        ].some((k) => s[k] !== prev[k])
      )
        this.settings(s);
    });
    this.makeGrid();
    this.rebuild();
    this.settings(useEditor.getState());
    this.resizeView();
    this.fit();
    this.loop = () => {
      this.frame = requestAnimationFrame(this.loop);
      this.controls.update();
      this.helpers.children.forEach((h) => h.isBoxHelper && h.update());
      this.renderer.render(this.scene, this.camera);
    };
    this.loop();
  }
  resizeView() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    if (this.camera.isPerspectiveCamera) this.camera.aspect = w / h;
    else {
      const span = this.orthoSpan || 6000;
      this.camera.left = (-span * w) / h / 2;
      this.camera.right = (span * w) / h / 2;
      this.camera.top = span / 2;
      this.camera.bottom = -span / 2;
    }
    this.camera.updateProjectionMatrix();
  }
  makeGrid() {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.disposeGroup(this.grid);
    }
    this.grid = new T.Group();
    const spacing = useEditor.getState().project.settings.grid;
    const extent = Math.max(10000, Math.min(spacing * 100, 50000));
    const major = new T.GridHelper(
      extent * 2,
      Math.min(400, (extent * 2) / spacing),
      0xc0c9c0,
      0xd5ddd4,
    );
    major.rotation.x = Math.PI / 2;
    major.position.z = -0.8;
    major.material.transparent = true;
    major.material.opacity = 0.7;
    this.grid.add(major);
    for (const [axis, color] of [
      [new T.Vector3(extent, 0, 0), 0xba6b63],
      [new T.Vector3(0, extent, 0), 0x719a79],
    ]) {
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints([axis.clone().negate(), axis]),
        new T.LineBasicMaterial({ color, transparent: true, opacity: 0.65 }),
      );
      line.position.z = -0.4;
      this.grid.add(line);
    }
    this.scene.add(this.grid);
  }
  texture(mat) {
    if (!mat.grain) return null;
    if (this.textures.has(mat.id)) return this.textures.get(mat.id);
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = mat.color;
    ctx.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 100; i++) {
      ctx.strokeStyle = i % 3 ? "rgba(40,23,6,.06)" : "rgba(255,255,230,.1)";
      ctx.lineWidth = (i % 4) + 1;
      ctx.beginPath();
      const x = (i * 37) % 128;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 12, 150, x - 8, 360, x + 4, 512);
      ctx.stroke();
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    this.textures.set(mat.id, tex);
    return tex;
  }
  material(id) {
    const m = MATERIALS.find((v) => v.id === id) || MATERIALS[0];
    const map = this.texture(m);
    return new T.MeshStandardMaterial({
      color: map ? "#ffffff" : m.color,
      map,
      roughness: m.roughness,
      metalness: m.metalness || 0,
      transparent: !!m.opacity,
      opacity: m.opacity || 1,
      side: T.DoubleSide,
    });
  }
  mesh(o) {
    let mesh;
    const size = o.size;
    if (["line", "dimension"].includes(o.kind)) {
      const points =
        o.kind === "dimension"
          ? this.dimensionPoints(o)
          : o.points.map((p) => vec(p));
      mesh = new T.Line(
        new T.BufferGeometry().setFromPoints(points),
        new T.LineBasicMaterial({
          color: o.kind === "dimension" ? 0x92742d : 0x2b6558,
        }),
      );
      if (o.kind === "dimension") {
        mesh.add(
          this.label(
            Math.round(points[0].distanceTo(points[1]) * 10) / 10 + " mm",
            points[0].clone().add(points[1]).multiplyScalar(0.5),
          ),
        );
      } else {
        mesh.position.fromArray(o.position);
        mesh.rotation.set(...o.rotation.map(rad));
        mesh.scale.fromArray(o.size);
      }
    } else {
      let geometry;
      if (o.kind === "cylinder") {
        geometry = new T.CylinderGeometry(
          size[0] / 2,
          size[0] / 2,
          size[2],
          48,
        );
        geometry.rotateX(Math.PI / 2);
        geometry.scale(1, size[1] / size[0], 1);
      } else if (o.kind === "profile") {
        const shape = new T.Shape(o.profile.map((p) => new T.Vector2(...p)));
        geometry = new T.ExtrudeGeometry(shape, {
          depth: size[2],
          bevelEnabled: false,
          steps: 1,
        });
        geometry.translate(0, 0, -size[2] / 2);
        const px = o.profile.map((p) => p[0]),
          py = o.profile.map((p) => p[1]);
        geometry.scale(
          size[0] / (Math.max(...px) - Math.min(...px)),
          size[1] / (Math.max(...py) - Math.min(...py)),
          1,
        );
      } else geometry = openingGeometry(o);
      const mats =
        o.kind === "box"
          ? Array.from({ length: 6 }, (_, i) =>
              this.material(o.faceMaterials?.[i] || o.material),
            )
          : this.material(o.material);
      mesh = new T.Mesh(geometry, mats);
      mesh.position.fromArray(o.position);
      mesh.rotation.set(...o.rotation.map(rad));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const edges = new T.LineSegments(
        new T.EdgesGeometry(geometry, 25),
        new T.LineBasicMaterial({
          color: 0x3d433b,
          transparent: true,
          opacity: 0.28,
        }),
      );
      edges.userData.edge = true;
      mesh.add(edges);
    }
    mesh.userData.id = o.id;
    return mesh;
  }
  label(text, position) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffcf0";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#5e4f26";
    ctx.font = "500 45px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 64);
    const map = new T.CanvasTexture(canvas);
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ map, depthTest: false }),
    );
    sprite.position.copy(position);
    sprite.scale.set(350, 66, 1);
    sprite.userData.label = true;
    return sprite;
  }
  dimensionPoints(o) {
    return o.points.map((p, i) => {
      const a = o.anchors?.[i],
        target = a && this.objects.get(a.id);
      if (target) {
        target.updateMatrixWorld();
        const source = useEditor
          .getState()
          .project.objects.find((v) => v.id === a.id);
        const local =
          a.fractions && source
            ? a.fractions.map((v, i) => v * source.size[i])
            : a.local;
        return vec(local).applyMatrix4(target.matrixWorld);
      }
      return vec(p);
    });
  }
  rebuild() {
    this.transform.detach();
    this.disposeGroup(this.model);
    this.model.clear();
    this.objects.clear();
    const p = useEditor.getState().project;
    for (const o of p.objects.filter((o) => o.kind !== "dimension")) {
      const mesh = this.mesh(o);
      mesh.visible =
        o.visible !== false &&
        p.layers.find((l) => l.id === o.layer)?.visible !== false;
      this.model.add(mesh);
      this.objects.set(o.id, mesh);
    }
    for (const o of p.objects.filter((o) => o.kind === "dimension")) {
      const mesh = this.mesh(o);
      mesh.visible =
        o.visible !== false &&
        p.layers.find((l) => l.id === o.layer)?.visible !== false;
      this.model.add(mesh);
      this.objects.set(o.id, mesh);
    }
    this.settings(useEditor.getState());
  }
  settings(s) {
    this.grid.visible = s.gridVisible;
    this.sun.castShadow = s.shadows;
    this.renderer.shadowMap.enabled = s.shadows;
    const clip = s.section
      ? [new T.Plane(new T.Vector3(0, 0, -1), s.sectionHeight)]
      : [];
    this.model.traverse((m) => {
      if (m.userData.edge) m.visible = s.edges;
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          mat.clippingPlanes = clip;
          const material = MATERIALS.find(
            (v) =>
              v.id ===
              s.project.objects.find((o) => o.id === m.userData.id)?.material,
          );
          mat.transparent = s.xray || !!material?.opacity;
          mat.opacity = s.xray ? 0.3 : material?.opacity || 1;
          mat.depthWrite = !s.xray;
          mat.needsUpdate = true;
        });
      }
    });
    this.transform.setTranslationSnap(
      s.snapEnabled ? s.project.settings.snap : null,
    );
    this.transform.setRotationSnap(s.snapEnabled ? rad(15) : null);
    this.transform.showX = !s.axis || s.axis === "X";
    this.transform.showY = !s.axis || s.axis === "Y";
    this.transform.showZ = !s.axis || s.axis === "Z";
  }
  syncSelection() {
    this.disposeGroup(this.helpers);
    this.helpers.clear();
    const s = useEditor.getState();
    const meshes = s.selection
      .map((id) => this.objects.get(id))
      .filter(Boolean);
    for (const m of meshes) {
      const box = new T.BoxHelper(m, 0x20836c);
      box.material.depthTest = false;
      box.material.transparent = true;
      box.material.opacity = 0.9;
      this.helpers.add(box);
    }
    this.highlightFace(s);
    this.transform.detach();
    if (!meshes.length || !["move", "rotate", "scale"].includes(s.tool)) return;
    if (
      s.selection.some(
        (id) =>
          s.project.objects.find((o) => o.id === id)?.locked ||
          s.project.objects.find((o) => o.id === id)?.kind === "dimension",
      )
    )
      return;
    const box = new T.Box3();
    meshes.forEach((m) => box.expandByObject(m));
    box.getCenter(this.pivot.position);
    this.pivot.quaternion.identity();
    this.pivot.scale.set(1, 1, 1);
    this.pivot.updateMatrixWorld();
    this.transform.setMode(
      { move: "translate", rotate: "rotate", scale: "scale" }[s.tool],
    );
    this.transform.attach(this.pivot);
  }
  highlightFace(s) {
    if (!s.face || s.selection.length !== 1) return;
    const o = s.project.objects.find((o) => o.id === s.selection[0]),
      m = this.objects.get(o?.id);
    if (!o || o.kind !== "box" || !m) return;
    const axis = Math.floor(s.face.index / 2),
      sign = s.face.index % 2 === 0 ? 1 : -1;
    const normal = new T.Vector3().setComponent(axis, sign);
    const dims =
      axis === 0
        ? [o.size[2], o.size[1]]
        : axis === 1
          ? [o.size[0], o.size[2]]
          : [o.size[0], o.size[1]];
    const face = new T.Mesh(
      new T.PlaneGeometry(...dims),
      new T.MeshBasicMaterial({
        color: 0x35af8a,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    face.position.copy(
      normal
        .clone()
        .multiplyScalar(o.size[axis] / 2 + 0.2)
        .applyEuler(m.rotation)
        .add(m.position),
    );
    face.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
    face.quaternion.premultiply(m.quaternion);
    this.helpers.add(face);
  }
  beginTransform() {
    this.dragging = true;
    this.pivot.updateMatrixWorld();
    this.startPivot = this.pivot.matrixWorld.clone().invert();
    this.startObjects = useEditor.getState().selection.map((id) => {
      const m = this.objects.get(id);
      m.updateMatrixWorld();
      return {
        id,
        matrix: m.matrixWorld.clone(),
        object: clone(
          useEditor.getState().project.objects.find((o) => o.id === id),
        ),
      };
    });
  }
  previewTransform() {
    if (!this.dragging || !this.startObjects) return;
    this.pivot.updateMatrixWorld();
    const delta = this.pivot.matrixWorld.clone().multiply(this.startPivot);
    for (const a of this.startObjects) {
      const m = this.objects.get(a.id);
      const matrix = delta.clone().multiply(a.matrix);
      matrix.decompose(m.position, m.quaternion, m.scale);
    }
  }
  endTransform() {
    if (!this.dragging) return;
    this.dragging = false;
    const updates =
      this.startObjects?.map((a) => {
        const m = this.objects.get(a.id);
        return {
          id: a.id,
          position: m.position.toArray(),
          rotation: [deg(m.rotation.x), deg(m.rotation.y), deg(m.rotation.z)],
          size: a.object.size.map((n, i) =>
            Math.max(
              0.1,
              (a.object.kind === "line" ? 1 : n) *
                Math.abs(m.scale.getComponent(i)),
            ),
          ),
        };
      }) || [];
    if (updates.length)
      useEditor.getState().commit("Transform selection", (p) =>
        updates.forEach((u) => {
          const o = p.objects.find((o) => o.id === u.id);
          if (o && !o.locked) Object.assign(o, u);
        }),
      );
    this.startObjects = null;
    setTimeout(() => {
      this.transform.axis = null;
    }, 0);
  }
  rayAt(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.mouse, this.camera);
  }
  pick(e) {
    this.rayAt(e);
    return this.ray.intersectObjects(
      [...this.objects.values()].filter((m) => m.visible),
      false,
    )[0];
  }
  workPoint(e) {
    this.rayAt(e);
    const s = useEditor.getState();
    const normal =
      s.plane === "XY"
        ? new T.Vector3(0, 0, 1)
        : s.plane === "XZ"
          ? new T.Vector3(0, 1, 0)
          : new T.Vector3(1, 0, 0);
    const p = this.ray.ray.intersectPlane(
      new T.Plane(normal, 0),
      new T.Vector3(),
    );
    if (!p) return null;
    let type = "",
      anchor = null;
    let snapped = p.clone();
    if (s.snapEnabled) {
      const candidates = [];
      for (const [id, m] of this.objects) {
        if (!m.visible) continue;
        const o = s.project.objects.find((v) => v.id === id);
        m.updateMatrixWorld();
        if (o.kind === "box" || o.kind === "cylinder") {
          const f = boxFeatures(o);
          f.corners.forEach((p) =>
            candidates.push({ p, type: "Endpoint", id }),
          );
          f.midpoints.forEach((p) =>
            candidates.push({ p, type: "Midpoint", id }),
          );
          f.faces.forEach((p) =>
            candidates.push({ p, type: "Face center", id }),
          );
          for (const [a, b] of f.edges) {
            const onEdge = new T.Vector3();
            this.ray.ray.distanceSqToSegment(a, b, new T.Vector3(), onEdge);
            candidates.push({ p: onEdge, type: "Edge", id });
          }
          candidates.push({ p: f.center, type: "Center", id });
        } else if (o.kind === "line")
          o.points.forEach((v) =>
            candidates.push({
              p: vec(v).applyMatrix4(m.matrixWorld),
              type: "Endpoint",
              id,
            }),
          );
      }
      this.points.forEach((q) => candidates.push({ p: q, type: "Endpoint" }));
      let best = 12;
      const rect = this.renderer.domElement.getBoundingClientRect();
      for (const c of candidates) {
        if (
          ["rectangle", "polygon"].includes(s.tool) &&
          Math.abs(c.p.dot(normal)) > 0.01
        )
          continue;
        const q = c.p.clone().project(this.camera);
        if (q.z > 1 || q.z < -1) continue;
        const d = Math.hypot(
          ((q.x - this.mouse.x) * rect.width) / 2,
          ((q.y - this.mouse.y) * rect.height) / 2,
        );
        if (d < best) {
          best = d;
          snapped = c.p;
          type = c.type;
          if (c.id) {
            const m = this.objects.get(c.id);
            const local = c.p
              .clone()
              .applyMatrix4(m.matrixWorld.clone().invert())
              .toArray();
            const source = s.project.objects.find((v) => v.id === c.id);
            anchor = {
              id: c.id,
              local,
              ...(["box", "cylinder", "profile"].includes(source?.kind)
                ? { fractions: local.map((v, i) => v / source.size[i]) }
                : {}),
            };
          }
        }
      }
      if (!type) {
        snapped = p
          .clone()
          .divideScalar(s.project.settings.snap)
          .round()
          .multiplyScalar(s.project.settings.snap);
        type = "Grid";
      }
    }
    if (s.axis && this.points.length) {
      const a = "XYZ".indexOf(s.axis),
        last = this.points.at(-1);
      snapped = last.clone().setComponent(a, snapped.getComponent(a));
      type = s.axis + " axis";
    }
    return { point: snapped, type, anchor };
  }
  pointer(e) {
    const s = useEditor.getState();
    if (!["rectangle", "line", "polygon", "measure"].includes(s.tool)) {
      this.marker.visible = false;
      return;
    }
    const hit = this.workPoint(e);
    if (!hit) return;
    this.marker.visible = true;
    this.marker.position.copy(hit.point);
    this.marker.scale.setScalar(
      Math.max(0.3, this.camera.position.distanceTo(hit.point) / 10000),
    );
    useEditor.setState({
      cursor: { point: hit.point.toArray(), type: hit.type },
    });
    this.drawPreview(hit.point);
  }
  drawPreview(end) {
    this.disposeGroup(this.drawGroup);
    this.drawGroup.clear();
    if (!this.points.length) return;
    const s = useEditor.getState(),
      p = this.points[0];
    let pts = [...this.points, end];
    if (s.tool === "rectangle") {
      const a = p.clone(),
        b = end.clone();
      let c = a.clone(),
        d = b.clone();
      const ax = s.plane === "YZ" ? 1 : 0;
      c.setComponent(ax, b.getComponent(ax));
      d.setComponent(ax, a.getComponent(ax));
      pts = [a, c, b, d, a];
    }
    const line = new T.Line(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineBasicMaterial({ color: 0x20836c, depthTest: false }),
    );
    this.drawGroup.add(line);
  }
  click(e) {
    const s = useEditor.getState();
    if (["rectangle", "line", "polygon", "measure"].includes(s.tool)) {
      const hit = this.workPoint(e);
      if (!hit) return;
      if (
        s.tool === "polygon" &&
        this.points.length >= 3 &&
        hit.point.distanceTo(this.points[0]) < 1
      ) {
        this.finishPolygon();
        return;
      }
      this.points.push(hit.point);
      this.anchors.push(hit.anchor);
      if (s.tool === "polygon") {
        s.notify(
          `${this.points.length} vertices · click start or Enter to close`,
        );
        return;
      }
      if (this.points.length < 2) {
        s.notify("Choose the second point · Esc cancels");
        return;
      }
      const [a, b] = this.points;
      if (a.distanceTo(b) < 0.1) {
        this.cancelDraw();
        return;
      }
      if (s.tool === "rectangle") {
        const dims = [
          Math.abs(a.x - b.x),
          Math.abs(a.y - b.y),
          Math.abs(a.z - b.z),
        ];
        const thin = s.plane === "XY" ? 2 : s.plane === "XZ" ? 1 : 0;
        dims[thin] = 0.1;
        if (dims.some((n, i) => i !== thin && n < 0.1)) {
          s.notify("Rectangle needs two non-zero dimensions");
          this.cancelDraw();
          return;
        }
        s.add(
          [
            entity({
              name: "Rectangle",
              size: dims,
              position: a.clone().add(b).multiplyScalar(0.5).toArray(),
              isFace: true,
              thinAxis: thin,
            }),
          ],
          "Draw rectangle",
        );
        s.set({ tool: "pushpull" });
      } else {
        s.add(
          [
            entity({
              name: s.tool === "measure" ? "Dimension" : "Line",
              kind: s.tool === "measure" ? "dimension" : "line",
              points: [a.toArray(), b.toArray()],
              anchors: s.tool === "measure" ? clone(this.anchors) : undefined,
              position: [0, 0, 0],
              size: [1, 1, 1],
              layer: s.tool === "measure" ? "Annotations" : "Furniture",
            }),
          ],
          s.tool === "measure" ? "Measure distance" : "Draw line",
        );
      }
      this.cancelDraw();
      return;
    }
    const hit = this.pick(e);
    if (hit) {
      const id = hit.object.userData.id;
      const face = hit.face
        ? {
            index: hit.face.materialIndex,
            normal: hit.face.normal.toArray(),
            point: hit.point.toArray(),
          }
        : null;
      s.select(
        id,
        e.shiftKey,
        s.selectionMode === "face" || s.tool === "pushpull" ? face : null,
      );
      if (s.tool === "pushpull")
        s.notify("Enter a distance in Push / Pull to extrude this face");
      if (s.selectionMode === "edge") {
        const o = s.project.objects.find((o) => o.id === id);
        if (o?.kind === "box") {
          const features = boxFeatures(o);
          let best = null,
            distance = Infinity;
          for (const edge of features.edges) {
            const near = new T.Line3(...edge).closestPointToPoint(
                hit.point,
                true,
                new T.Vector3(),
              ),
              d = near.distanceTo(hit.point);
            if (d < distance) {
              distance = d;
              best = edge;
            }
          }
          if (best) {
            const highlight = new T.Line(
              new T.BufferGeometry().setFromPoints(best),
              new T.LineBasicMaterial({ color: 0xe6a42e, depthTest: false }),
            );
            this.helpers.add(highlight);
            s.notify(
              "Edge length · " + best[0].distanceTo(best[1]).toFixed(2) + " mm",
            );
          }
        }
      }
    } else if (!e.shiftKey) s.select(null);
  }
  finishPolygon() {
    if (this.points.length < 3) return;
    const s = useEditor.getState(),
      plane = s.plane;
    const center = this.points
      .reduce((a, b) => a.add(b), new T.Vector3())
      .multiplyScalar(1 / this.points.length);
    const indices = plane === "XY" ? [0, 1] : plane === "XZ" ? [0, 2] : [1, 2];
    const profile = this.points.map((p) =>
      indices.map((i) => p.getComponent(i) - center.getComponent(i)),
    );
    const xs = profile.map((p) => p[0]),
      ys = profile.map((p) => p[1]);
    s.add(
      [
        entity({
          name: "Custom profile",
          kind: "profile",
          profile,
          position: center.toArray(),
          rotation:
            plane === "XY"
              ? [0, 0, 0]
              : plane === "XZ"
                ? [90, 0, 0]
                : [90, 0, 90],
          size: [
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys),
            0.1,
          ],
          isFace: true,
          thinAxis: 2,
        }),
      ],
      "Close profile",
    );
    this.cancelDraw();
    s.set({ tool: "pushpull" });
  }
  cancelDraw() {
    this.points = [];
    this.anchors = [];
    this.disposeGroup(this.drawGroup);
    this.drawGroup.clear();
    this.marker.visible = false;
  }
  extrude(amount) {
    const s = useEditor.getState();
    s.commit("Push / Pull " + amount + " mm", (p) => {
      p.objects = p.objects.map((o) =>
        s.selection.includes(o.id) ? extrudeObject(o, amount, s.face) : o,
      );
    });
  }

  fit() {
    const box = new T.Box3();
    this.model.children
      .filter((m) => m.visible && !m.userData.label)
      .forEach((m) => box.expandByObject(m));
    if (box.isEmpty()) {
      box.min.set(-1000, -1000, 0);
      box.max.set(1000, 1000, 1000);
    }
    const center = box.getCenter(new T.Vector3()),
      size = box.getSize(new T.Vector3());
    const distance = Math.max(size.x, size.y, size.z, 1000) * 1.8;
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.controls.target.copy(center);
    this.camera.position.copy(
      center.clone().addScaledVector(direction, distance),
    );
    if (this.camera.isOrthographicCamera) {
      this.orthoSpan = Math.max(size.x, size.y, size.z) * 1.5;
      this.resizeView();
    }
    this.controls.update();
  }
  view(name) {
    const center = this.controls.target.clone(),
      distance = this.camera.position.distanceTo(center);
    const dirs = {
      front: [0, -1, 0],
      back: [0, 1, 0],
      left: [-1, 0, 0],
      right: [1, 0, 0],
      top: [0, 0, 1],
      bottom: [0, 0, -1],
      iso: [1, -1, 0.8],
      perspective: [1, -1, 0.8],
    };
    const dir = vec(dirs[name] || dirs.iso).normalize();
    const old = this.camera;
    this.camera =
      name === "perspective"
        ? new T.PerspectiveCamera(42, 1, 1, 200000)
        : new T.OrthographicCamera(-4000, 4000, 4000, -4000, 1, 200000);
    this.camera.up.set(0, 0, 1);
    if (name === "top") this.camera.up.set(0, 1, 0);
    if (name === "bottom") this.camera.up.set(0, -1, 0);
    this.camera.position.copy(center.clone().addScaledVector(dir, distance));
    this.camera.lookAt(center);
    this.orthoSpan = distance * 0.65;
    this.controls.object = this.camera;
    this.transform.camera = this.camera;
    this.resizeView();
    this.controls.update();
    useEditor
      .getState()
      .notify(name[0].toUpperCase() + name.slice(1) + " view");
  }
  snapshot() {
    this.renderer.render(this.scene, this.camera);
    const a = document.createElement("a");
    a.download = useEditor.getState().project.name + ".png";
    a.href = this.renderer.domElement.toDataURL("image/png");
    a.click();
  }
  async export(type) {
    const group = new T.Group();
    this.model.children
      .filter((m) => m.visible && m.isMesh)
      .forEach((m) => {
        const c = m.clone();
        c.children = [];
        group.add(c);
      });
    group.updateMatrixWorld(true);
    if (type === "glb") {
      group.scale.setScalar(0.001);
      group.rotation.x = -Math.PI / 2;
      group.updateMatrixWorld(true);
      const result = await new GLTFExporter().parseAsync(group, {
        binary: true,
      });
      download(
        result,
        useEditor.getState().project.name + ".glb",
        "model/gltf-binary",
      );
    } else if (type === "obj") {
      download(
        new OBJExporter().parse(group),
        useEditor.getState().project.name + ".obj",
        "text/plain",
      );
    } else
      download(
        new STLExporter().parse(group),
        useEditor.getState().project.name + ".stl",
        "model/stl",
      );
    useEditor.getState().notify(type.toUpperCase() + " exported");
  }
  saveView() {
    const s = useEditor.getState();
    s.commit("Save scene view", (p) =>
      p.views.push({
        id: crypto.randomUUID(),
        name: "View " + (p.views.length + 1),
        position: this.camera.position.toArray(),
        target: this.controls.target.toArray(),
        up: this.camera.up.toArray(),
        orthographic: this.camera.isOrthographicCamera,
        span: this.orthoSpan,
      }),
    );
  }
  restoreView(v) {
    this.view(v.orthographic ? "iso" : "perspective");
    this.camera.position.fromArray(v.position);
    if (v.up) this.camera.up.fromArray(v.up);
    this.controls.target.fromArray(v.target);
    if (v.span) this.orthoSpan = v.span;
    this.resizeView();
    this.controls.update();
  }
  disposeGroup(group) {
    group.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [];
      mats.forEach((m) => {
        if (o.userData.label) m.map?.dispose();
        m.dispose();
      });
    });
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.unsubscribe();
    this.resize.disconnect();
    this.controls.dispose();
    this.transform.dispose();
    this.disposeGroup(this.scene);
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
