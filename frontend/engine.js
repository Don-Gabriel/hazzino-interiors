import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { entity, MATERIALS, materialFor, clone } from "../shared/model.js";
import { DISPLAY_DEFAULTS } from "../shared/workspace.js";
import {
  DRAWING_TOOLS,
  ARC_TOOLS,
  THREE_POINT_TOOLS,
  drawingGeometry,
  profileFromPoints,
  simplifyStroke,
} from "../shared/drawing.js";
import {
  boxFeatures,
  extrudeObject,
  openingGeometry,
  objectGeometry,
} from "../shared/geometry.js";
import {
  initKernel,
  booleanObjects,
  offsetFace,
  faceRegion,
  weldedGeometry,
  pushPullRegion,
} from "../shared/solid-kernel.js";
import { TOOL_CURSORS } from "./tool-cursors.js";
import { useEditor, download } from "./store.js";
import { hasShear } from "../shared/assemblies.js";
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
      if (
        e.button === 0 &&
        ["pushpull", "offset"].includes(useEditor.getState().tool)
      ) {
        if (!this.operation) {
          this.startOperation(e);
          if (this.operation) this.operation.startedOnDown = true;
        } else this.operation.commitOnUp = true;
        return;
      }
      if (e.button === 0 && useEditor.getState().tool === "freehand") {
        this.cancelDraw();
        const hit = this.workPoint(e, false);
        if (hit) {
          this.freehandActive = true;
          this.points = [hit.point];
          this.renderer.domElement.setPointerCapture(e.pointerId);
        }
      }
    };
    this.onUp = (e) => {
      if (e.button === 0 && this.operation) {
        const moved =
          this.down &&
          Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5;
        if (
          this.operation.commitOnUp ||
          (this.operation.startedOnDown && moved)
        )
          this.finishOperation();
        else this.operation.startedOnDown = false;
        return;
      }
      if (this.freehandActive && e.button === 0) {
        this.sampleStroke(e);
        this.finishStroke();
        return;
      }
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
    this.onCancel = () => this.cancelDraw();
    this.onContext = (e) => {
      e.preventDefault();
      if (
        this.down &&
        Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5
      )
        return;
      const s = useEditor.getState(),
        hit = this.pick(e);
      if (hit && !s.selection.includes(hit.object.userData.id))
        s.select(hit.object.userData.id);
      s.set({ contextMenu: { x: e.clientX, y: e.clientY } });
    };
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    this.renderer.domElement.addEventListener("pointerup", this.onUp);
    this.renderer.domElement.addEventListener("pointermove", this.onMove);
    this.renderer.domElement.addEventListener("pointercancel", this.onCancel);
    this.renderer.domElement.addEventListener("contextmenu", this.onContext);
    this.resize = new ResizeObserver(() => this.resizeView());
    this.resize.observe(container);
    this.unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.project !== prev.project) {
        if (this.operation) this.cancelDraw();
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
      if (
        s.tool !== prev.tool ||
        s.plane !== prev.plane ||
        s.project.id !== prev.project.id
      ) {
        this.cancelDraw();
        this.controls.enableRotate = ![
          ...DRAWING_TOOLS,
          "pushpull",
          "offset",
        ].includes(s.tool);
        this.controls.mouseButtons.LEFT =
          s.tool === "pan" ? T.MOUSE.PAN : T.MOUSE.ROTATE;
        this.renderer.domElement.style.cursor =
          TOOL_CURSORS[s.tool] ||
          (DRAWING_TOOLS.includes(s.tool) ? "crosshair" : "default");
      }
      if (
        s.project !== prev.project ||
        [
          ...Object.keys(DISPLAY_DEFAULTS),
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
    this.grid.children.forEach((child, index) => {
      child.visible =
        index === 0
          ? useEditor.getState().gridVisible
          : useEditor.getState().axesVisible;
    });
  }
  texture(mat) {
    if (mat.map) {
      const cached = this.textures.get(mat.id);
      if (cached?.userData.source === mat.map) return cached;
      cached?.dispose();
      const texture = new T.TextureLoader().load(mat.map);
      texture.colorSpace = T.SRGBColorSpace;
      texture.flipY = mat.textureFlipY ?? false;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.userData.source = mat.map;
      this.textures.set(mat.id, texture);
      return texture;
    }
    if (!mat.grain) return null;
    const cached = this.textures.get(mat.id);
    if (cached?.userData.color === mat.color) return cached;
    cached?.dispose();
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
    tex.userData.color = mat.color;
    this.textures.set(mat.id, tex);
    return tex;
  }
  material(id) {
    const m = materialFor(useEditor.getState().project, id);
    const map = this.texture(m);
    const mat = new T.MeshStandardMaterial({
      color: map && m.grain ? "#ffffff" : m.color,
      map,
      roughness: m.roughness,
      metalness: m.metalness || 0,
      transparent: (m.opacity ?? 1) < 1,
      opacity: m.opacity ?? 1,
      side: T.DoubleSide,
    });
    mat.userData.materialId = m.id;
    return mat;
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
      const geometry = objectGeometry(o);
      const mats = o.faceGroups
        ? o.faceGroups.map((g, i) =>
            this.material(o.faceMaterials?.[i] || g.material),
          )
        : o.kind === "box"
          ? Array.from({ length: 6 }, (_, i) =>
              this.material(o.faceMaterials?.[i] || o.material),
            )
          : this.material(o.material);
      mesh = new T.Mesh(geometry, mats);
      if (o.kind === "mesh")
        for (const material of Array.isArray(mats) ? mats : [mats])
          material.flatShading = !o.smooth;
      if (o.isFace) {
        for (const material of Array.isArray(mats) ? mats : [mats]) {
          material.polygonOffset = true;
          material.polygonOffsetFactor = -2;
          material.polygonOffsetUnits = -2;
          if (o.hostId) material.depthWrite = false;
        }
      }
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
      edges.renderOrder = 2;
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
    this.grid.visible = s.gridVisible || s.axesVisible;
    this.grid.children.forEach((child, index) => {
      child.visible = index === 0 ? s.gridVisible : s.axesVisible;
    });
    this.scene.background.set(s.background);
    this.scene.fog = s.fogEnabled
      ? new T.Fog(s.background, s.fogNear, s.fogFar)
      : null;
    this.renderer.toneMappingExposure = s.exposure;
    const azimuth = rad(s.sunAzimuth),
      elevation = rad(s.sunElevation);
    this.sun.position.set(
      12000 * Math.cos(elevation) * Math.cos(azimuth),
      12000 * Math.cos(elevation) * Math.sin(azimuth),
      12000 * Math.sin(elevation),
    );
    this.sun.intensity = s.sunIntensity;
    if (this.camera.isPerspectiveCamera && this.camera.fov !== s.fieldOfView) {
      this.camera.fov = s.fieldOfView;
      this.camera.updateProjectionMatrix();
    }
    this.sun.castShadow = s.shadows;
    this.renderer.shadowMap.enabled = s.shadows;
    const clip = s.section
      ? [new T.Plane(new T.Vector3(0, 0, -1), s.sectionHeight)]
      : [];
    this.model.traverse((m) => {
      if (m.userData.edge) {
        m.visible =
          s.edges || ["wireframe", "hidden-line"].includes(s.displayStyle);
        m.material.opacity =
          s.displayStyle === "hidden-line" ? 0.85 : s.edgeOpacity;
        m.material.depthTest = s.displayStyle !== "wireframe";
        m.material.clippingPlanes = clip;
      }
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          mat.clippingPlanes = clip;
          const material = materialFor(s.project, mat.userData.materialId);
          mat.map =
            s.displayStyle === "textured" ? this.texture(material) : null;
          mat.color.set(
            ["monochrome", "hidden-line"].includes(s.displayStyle)
              ? "#f4f2e9"
              : mat.map
                ? "#ffffff"
                : material.color,
          );
          mat.roughness = material.roughness;
          mat.metalness = material.metalness || 0;
          mat.emissive.set(
            s.displayStyle === "hidden-line" ? "#ffffff" : "#000000",
          );
          mat.transparent = s.xray || (material.opacity ?? 1) < 1;
          mat.opacity = s.xray ? 0.3 : (material.opacity ?? 1);
          mat.depthWrite = !s.xray;
          mat.colorWrite = s.displayStyle !== "wireframe";
          if (s.displayStyle === "wireframe") mat.depthWrite = false;
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
    this.invalidTransform = false;
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
    const transforms = this.startObjects.map((a) =>
      delta.clone().multiply(a.matrix),
    );
    const articulatedScale =
      useEditor.getState().tool === "scale" &&
      this.startObjects.length > 1 &&
      this.startObjects.some((a) => a.object.mechanism);
    this.invalidTransform = articulatedScale || transforms.some(hasShear);
    for (const [index, a] of this.startObjects.entries()) {
      const m = this.objects.get(a.id);
      const matrix = this.invalidTransform ? a.matrix : transforms[index];
      matrix.decompose(m.position, m.quaternion, m.scale);
    }
    if (this.invalidTransform)
      useEditor
        .getState()
        .set({
          status: articulatedScale
            ? "Use Edit furniture to resize jointed assemblies and preserve clearances. Resize manual boards individually before attaching joints."
            : "This scale would shear rotated panels. Resize individual boards or use uniform scaling.",
        });
  }
  endTransform() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.invalidTransform) {
      this.startObjects = null;
      this.pivot.scale.set(1, 1, 1);
      this.transform.axis = null;
      return;
    }
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
    const hits = this.ray.intersectObjects(
      [...this.objects.values()].filter((m) => m.visible),
      false,
    );
    // Coplanar face subdivisions take precedence over their underlying solid.
    const near = hits.filter((hit) => hit.distance - hits[0].distance < 0.001);
    const objects = useEditor.getState().project.objects;
    return (
      near.find(
        (hit) => objects.find((o) => o.id === hit.object.userData.id)?.hostId,
      ) || hits[0]
    );
  }
  workPoint(e, allowSnap = true) {
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
    if (s.snapEnabled && allowSnap) {
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
          DRAWING_TOOLS.includes(s.tool) &&
          !["line", "measure"].includes(s.tool) &&
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
    if (s.axis && this.points.length && allowSnap) {
      const a = "XYZ".indexOf(s.axis),
        last = this.points.at(-1);
      snapped = last.clone().setComponent(a, snapped.getComponent(a));
      type = s.axis + " axis";
    }
    return { point: snapped, type, anchor };
  }
  pointer(e) {
    const s = useEditor.getState();
    if (this.operation) {
      this.updateOperation(e);
      return;
    }
    if (["pushpull", "offset"].includes(s.tool)) {
      this.hoverFace(e);
      return;
    }
    if (!DRAWING_TOOLS.includes(s.tool)) {
      this.marker.visible = false;
      return;
    }
    if (this.freehandActive) {
      this.sampleStroke(e);
      return;
    }
    const hit = this.workPoint(e, s.tool !== "freehand");
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
    try {
      const geometry = drawingGeometry(
        s.tool,
        pts.map((v) => v.toArray()),
        s.plane,
        s,
      );
      if (geometry) {
        pts = geometry.points.map(vec);
        if (geometry.closed) pts.push(pts[0]);
      }
    } catch {
      /* Keep the guide lines visible until the next point is valid. */
    }
    const line = new T.Line(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineBasicMaterial({ color: 0x20836c, depthTest: false }),
    );
    this.drawGroup.add(line);
  }
  click(e) {
    const s = useEditor.getState();
    if (["orbit", "pan", "freehand"].includes(s.tool)) return;
    if (DRAWING_TOOLS.includes(s.tool)) {
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
      if (THREE_POINT_TOOLS.includes(s.tool) && this.points.length < 3) {
        s.notify(
          s.tool === "arc-2point"
            ? "Choose the arc bulge"
            : s.tool === "rotated-rectangle"
              ? "Choose the rectangle width"
              : "Choose the final arc point",
        );
        return;
      }
      const [a, b] = this.points;
      if (a.distanceTo(b) < 0.1) {
        this.cancelDraw();
        return;
      }
      if (
        ["circle", "regular-polygon", ...THREE_POINT_TOOLS].includes(s.tool)
      ) {
        try {
          const geometry = drawingGeometry(
              s.tool,
              this.points.map((p) => p.toArray()),
              s.plane,
              s,
            ),
            name = {
              circle: "Circle",
              "regular-polygon": "Polygon",
              "rotated-rectangle": "Rotated rectangle",
              arc: "Arc",
              "arc-2point": "2 Point Arc",
              "arc-3point": "3 Point Arc",
              pie: "Pie",
            }[s.tool];
          const object = geometry.closed
            ? profileFromPoints(name, geometry.points, s.plane)
            : entity({
                name,
                kind: "line",
                points: geometry.points,
                position: [0, 0, 0],
                size: [1, 1, 1],
              });
          s.add([object], "Draw " + name);
          if (geometry.closed) s.set({ tool: "pushpull" });
        } catch (error) {
          this.points.pop();
          this.anchors.pop();
          s.notify(error.message + " · choose another point or Esc");
          return;
        }
      } else if (s.tool === "rectangle") {
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
      if (s.tool === "eraser") {
        s.select(id);
        s.remove();
        return;
      }
      if (s.tool === "paint") {
        s.select(
          id,
          false,
          s.selectionMode === "face" && hit.face
            ? {
                index: hit.face.materialIndex,
                normal: hit.face.normal.toArray(),
                point: hit.point.toArray(),
              }
            : null,
        );
        useEditor.getState().applyMaterial(s.paintMaterial);
        return;
      }
      const face = hit.face
        ? {
            index: hit.face.materialIndex,
            triangle: hit.faceIndex,
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
    if (this.points.length < 3 || useEditor.getState().tool !== "polygon")
      return;
    const s = useEditor.getState(),
      plane = s.plane;
    try {
      s.add(
        [
          profileFromPoints(
            "Custom profile",
            this.points.map((p) => p.toArray()),
            plane,
          ),
        ],
        "Close profile",
      );
    } catch (error) {
      s.notify(error.message);
      return;
    }
    this.cancelDraw();
    s.set({ tool: "pushpull" });
  }
  sampleStroke(e) {
    const hit = this.workPoint(e, false);
    if (!hit) return;
    if (!this.points.length || this.points.at(-1).distanceTo(hit.point) > 0.5) {
      this.points.push(hit.point);
      if (this.points.length > 2000)
        this.points = this.points.filter(
          (_, i, all) => i === 0 || i === all.length - 1 || i % 2 === 1,
        );
      useEditor.setState({
        cursor: { point: hit.point.toArray(), type: "Drawing plane" },
      });
      this.drawPreview(hit.point);
    }
  }
  finishStroke() {
    const s = useEditor.getState();
    let tolerance = 0.5,
      points = this.points.map((p) => p.toArray()),
      simplified = simplifyStroke(points, tolerance);
    while (simplified.length > 500) {
      tolerance *= 2;
      simplified = simplifyStroke(points, tolerance);
    }
    if (
      simplified.length >= 2 &&
      simplified.some((p) => vec(p).distanceTo(vec(simplified[0])) > 0.1)
    )
      s.add(
        [
          entity({
            name: "Freehand",
            kind: "line",
            points: simplified,
            position: [0, 0, 0],
            size: [1, 1, 1],
          }),
        ],
        "Draw freehand curve",
      );
    this.cancelDraw();
  }
  cancelDraw() {
    if (this.operation) {
      this.restoreOperation();
      this.operation = null;
      useEditor
        .getState()
        .set({ operationValue: null, operationActive: false });
    }
    this.hoverKey = null;
    this.freehandActive = false;
    this.points = [];
    this.anchors = [];
    this.disposeGroup(this.drawGroup);
    this.drawGroup.clear();
    this.marker.visible = false;
  }
  extrude(amount) {
    if (this.operation) {
      this.finishOperation(amount);
      return;
    }
    const s = useEditor.getState();
    try {
      const sources = s.project.objects.filter(
        (o) => s.selection.includes(o.id) && !o.locked,
      );
      if (new Set(sources.map((o) => o.hostId || o.id)).size !== sources.length)
        throw Error("Select one face of each solid for Push / Pull");
      const updates = sources
        .filter((o) => s.selection.includes(o.id) && !o.locked)
        .map((o) => ({
          id: o.hostId || o.id,
          result: this.pulledObject(o, amount, s.face),
        }));
      s.commit("Push / Pull " + amount + " mm", (p) => {
        for (const { id, result } of updates) {
          p.objects = p.objects.filter((o) => o.hostId !== id);
          if (result)
            Object.assign(
              p.objects.find((o) => o.id === id),
              result,
              { id },
            );
          else p.objects = p.objects.filter((o) => o.id !== id);
        }
      });
    } catch (error) {
      s.notify(error.message);
    }
  }

  pulledObject(o, amount, face) {
    if (o.hostId) {
      const host = useEditor
        .getState()
        .project.objects.find((v) => v.id === o.hostId);
      if (!host) throw Error("The parent solid is missing");
      return pushPullRegion(host, face?.triangle || 0, amount, o);
    }
    if (o.isFace || (o.kind === "box" && !o.openings?.length))
      return extrudeObject(o, amount, face);
    return pushPullRegion(o, face?.triangle || 0, amount);
  }

  async solidOperation(operation) {
    const before = useEditor.getState(),
      project = before.project;
    const sources = before.selection
      .map((id) => project.objects.find((o) => o.id === id))
      .filter(Boolean);
    try {
      await initKernel();
      const results = booleanObjects(sources, operation);
      if (useEditor.getState().project !== project)
        throw Error("The design changed. Select the solids and try again.");
      before.commit("Solid " + operation, (p) => {
        const removed = new Set(
          (operation === "trim" ? sources.slice(0, 1) : sources).map(
            (o) => o.id,
          ),
        );
        p.objects = p.objects.filter(
          (o) => !removed.has(o.id) && !removed.has(o.hostId),
        );
        p.objects.push(...results);
        p.groups = p.groups.filter((g) =>
          p.objects.some((o) => o.groupId === g.id),
        );
      });
      before.set({
        selection: results.map((o) => o.id),
        face: null,
        modal: null,
      });
    } catch (error) {
      before.notify(error.message);
    }
  }

  hoverFace(e) {
    const hit = this.pick(e),
      key = hit?.object.userData.id + ":" + hit?.faceIndex;
    if (this.hoverKey === key) return;
    this.hoverKey = key;
    this.disposeGroup(this.drawGroup);
    this.drawGroup.clear();
    if (!hit?.face) return;
    const source = useEditor
      .getState()
      .project.objects.find((o) => o.id === hit.object.userData.id);
    if (!source || source.locked) return;
    try {
      const region = faceRegion(source, hit.faceIndex),
        geometry = weldedGeometry(source);
      const indices = Array.from(geometry.index.array);
      geometry.setIndex(
        region.triangles.flatMap((t) => indices.slice(t * 3, t * 3 + 3)),
      );
      const material = new T.MeshBasicMaterial({
        color: 0x25876b,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          "#include <dithering_fragment>\nif(mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),3.0)>0.5) discard;",
        );
      };
      this.drawGroup.add(new T.Mesh(geometry, material));
    } catch {}
  }

  startOperation(e) {
    const s = useEditor.getState(),
      hit = this.pick(e);
    if (!hit?.face) return;
    const source = s.project.objects.find(
      (o) => o.id === hit.object.userData.id,
    );
    if (!source || source.locked) return;
    try {
      const region = faceRegion(source, hit.faceIndex),
        face = {
          index: hit.face.materialIndex,
          triangle: hit.faceIndex,
          normal: hit.face.normal.toArray(),
          point: hit.point.toArray(),
        };
      this.cancelDraw();
      s.select(source.id, false, face);
      const op = {
        kind: s.tool,
        source: clone(source),
        face,
        region,
        anchor: hit.point.clone(),
        amount: 0,
      };
      if (s.tool === "offset") {
        let nearest = Infinity;
        for (const loop of region.loops)
          for (let i = 0; i < loop.length; i++) {
            const a = region.origin
              .clone()
              .addScaledVector(region.u, loop[i][0])
              .addScaledVector(region.v, loop[i][1]);
            const next = loop[(i + 1) % loop.length],
              b = region.origin
                .clone()
                .addScaledVector(region.u, next[0])
                .addScaledVector(region.v, next[1]);
            const d = new T.Line3(a, b)
              .closestPointToPoint(hit.point, true, new T.Vector3())
              .distanceTo(hit.point);
            if (d < nearest) {
              nearest = d;
              op.direction = b.sub(a).normalize().cross(region.n).normalize();
            }
          }
      }
      this.operation = op;
      s.set({ operationValue: 0, operationActive: true, measurementDraft: "" });
      s.notify(
        s.tool === "offset"
          ? "Move to offset the face. Click or type a distance to finish."
          : "Move to push or pull. Click or type a distance to finish.",
      );
    } catch (error) {
      s.notify(error.message);
    }
  }

  updateOperation(e) {
    const op = this.operation,
      s = useEditor.getState();
    if (!op) return;
    this.rayAt(e);
    let amount = 0;
    if (op.kind === "offset") {
      const point = this.ray.ray.intersectPlane(
        new T.Plane().setFromNormalAndCoplanarPoint(op.region.n, op.anchor),
        new T.Vector3(),
      );
      if (!point) return;
      amount = point.sub(op.anchor).dot(op.direction);
    } else {
      const n = op.region.n,
        d = this.ray.ray.direction,
        w = this.ray.ray.origin.clone().sub(op.anchor),
        dot = d.dot(n),
        denom = 1 - dot * dot;
      if (denom < 0.001) return;
      amount = (n.dot(w) - dot * d.dot(w)) / denom;
    }
    if (s.snapEnabled)
      amount =
        Math.round(amount / s.project.settings.snap) * s.project.settings.snap;
    if (amount === op.amount) return;
    op.amount = amount;
    s.set({ operationValue: amount });
    this.previewOperation();
  }

  previewOperation() {
    const op = this.operation;
    if (!op) return;
    this.restoreOperation();
    this.disposeGroup(this.drawGroup);
    this.drawGroup.clear();
    op.results = null;
    if (Math.abs(op.amount) < 0.001) return;
    try {
      const results =
        op.kind === "offset"
          ? offsetFace(op.source, op.face.triangle, op.amount)
          : [this.pulledObject(op.source, op.amount, op.face)].filter(Boolean);
      results.forEach((o) => this.drawGroup.add(this.mesh(o)));
      op.hidden = [];
      const hostId = op.source.hostId || op.source.id;
      for (const o of useEditor.getState().project.objects) {
        if (
          o.id === op.source.id ||
          (op.kind === "pushpull" && (o.id === hostId || o.hostId === hostId))
        ) {
          const mesh = this.objects.get(o.id);
          if (mesh?.visible && !(op.kind === "offset" && !op.source.isFace)) {
            mesh.visible = false;
            op.hidden.push(o.id);
          }
        }
      }
      op.results = results;
      op.validAmount = op.amount;
    } catch (error) {
      useEditor.getState().notify(error.message);
      op.results = null;
    }
  }

  restoreOperation() {
    for (const id of this.operation?.hidden || []) {
      const mesh = this.objects.get(id);
      if (mesh) mesh.visible = true;
    }
    if (this.operation) this.operation.hidden = [];
  }

  finishOperation(amount) {
    const op = this.operation;
    if (!op) return;
    if (amount != null) {
      op.amount = amount;
      this.previewOperation();
    }
    if (
      !op.results ||
      op.validAmount !== op.amount ||
      Math.abs(op.amount) < 0.001
    )
      return;
    const s = useEditor.getState(),
      results = op.results,
      kind = op.kind,
      targetId = op.source.hostId || op.source.id;
    this.cancelDraw();
    s.commit(
      (kind === "offset" ? "Offset " : "Push / Pull ") + op.amount + " mm",
      (p) => {
        if (kind === "pushpull") {
          p.objects = p.objects.filter(
            (o) => o.id !== targetId && o.hostId !== targetId,
          );
          results.forEach((o) => p.objects.push({ ...o, id: targetId }));
        } else {
          if (op.source.isFace)
            p.objects = p.objects.filter((o) => o.id !== op.source.id);
          p.objects.push(...results);
        }
      },
    );
    s.set({
      selection:
        kind === "pushpull"
          ? results.length
            ? [targetId]
            : []
          : results.map((o) => o.id),
      face: null,
      lastOperation: { kind, distance: op.amount },
    });
  }

  offsetSelection(distance) {
    const s = useEditor.getState(),
      source = s.project.objects.find((o) => o.id === s.selection[0]);
    if (!source) {
      s.notify("Select a face to offset");
      return;
    }
    try {
      const results = offsetFace(source, s.face?.triangle || 0, distance);
      s.commit("Offset " + distance + " mm", (p) => {
        if (source.isFace)
          p.objects = p.objects.filter((o) => o.id !== source.id);
        p.objects.push(...results);
      });
      s.set({ selection: results.map((o) => o.id), face: null });
    } catch (error) {
      s.notify(error.message);
    }
  }

  fit(selectionOnly = false) {
    const box = new T.Box3();
    this.model.children
      .filter(
        (m) =>
          m.visible &&
          !m.userData.label &&
          (!selectionOnly ||
            !useEditor.getState().selection.length ||
            useEditor.getState().selection.includes(m.userData.id)),
      )
      .forEach((m) => box.expandByObject(m));
    if (box.isEmpty()) {
      box.min.set(-1000, -1000, 0);
      box.max.set(1000, 1000, 1000);
    }
    const center = box.getCenter(new T.Vector3()),
      size = box.getSize(new T.Vector3());
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    const right = new T.Vector3()
      .crossVectors(this.camera.up, direction)
      .normalize();
    const up = new T.Vector3().crossVectors(direction, right).normalize();
    const half = size.clone().multiplyScalar(0.5);
    const projected = (v) =>
      Math.abs(v.x) * half.x + Math.abs(v.y) * half.y + Math.abs(v.z) * half.z;
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const span =
      Math.max(projected(up) * 2, (projected(right) * 2) / aspect, 100) * 1.18;
    const distance = span / (2 * Math.tan(rad(21))) + projected(direction);
    this.controls.target.copy(center);
    this.camera.position.copy(
      center.clone().addScaledVector(direction, distance),
    );
    if (this.camera.isOrthographicCamera) {
      this.orthoSpan = span;
      this.resizeView();
    }
    this.controls.update();
    useEditor
      .getState()
      .notify(selectionOnly ? "Framed selection" : "Fit complete model");
  }
  zoomStep(factor) {
    if (this.camera.isOrthographicCamera) {
      this.orthoSpan = Math.max(20, Math.min(150000, this.orthoSpan * factor));
      this.resizeView();
    } else {
      const offset = this.camera.position
        .clone()
        .sub(this.controls.target)
        .multiplyScalar(factor);
      if (offset.length() > 20 && offset.length() < 150000)
        this.camera.position.copy(this.controls.target.clone().add(offset));
    }
    this.controls.update();
    useEditor.getState().notify(factor < 1 ? "Zoom in" : "Zoom out");
  }
  orbitStep(theta, phi) {
    const toY = new T.Quaternion().setFromUnitVectors(
        this.camera.up,
        new T.Vector3(0, 1, 0),
      ),
      offset = this.camera.position
        .clone()
        .sub(this.controls.target)
        .applyQuaternion(toY);
    const spherical = new T.Spherical().setFromVector3(offset);
    spherical.theta += theta;
    spherical.phi = Math.max(
      0.01,
      Math.min(Math.PI - 0.01, spherical.phi + phi),
    );
    offset.setFromSpherical(spherical).applyQuaternion(toY.invert());
    this.camera.position.copy(this.controls.target.clone().add(offset));
    this.controls.update();
    useEditor.getState().notify("Orbit camera");
  }
  toggleProjection() {
    const position = this.camera.position.clone(),
      target = this.controls.target.clone(),
      up = this.camera.up.clone(),
      ortho = this.camera.isPerspectiveCamera;
    this.view(ortho ? "iso" : "perspective");
    this.camera.position.copy(position);
    this.camera.up.copy(up);
    this.controls.target.copy(target);
    this.resizeView();
    this.controls.update();
    useEditor
      .getState()
      .notify(ortho ? "Orthographic projection" : "Perspective projection");
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
        ? new T.PerspectiveCamera(
            useEditor.getState().fieldOfView,
            1,
            1,
            200000,
          )
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
    useEditor.getState().set({
      cameraView: name,
      projection: this.camera.isOrthographicCamera
        ? "orthographic"
        : "perspective",
      activeViewId: null,
    });
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
    const exportMaterials = [];
    this.model.children
      .filter((m) => m.visible && m.isMesh)
      .forEach((m) => {
        const c = m.clone();
        c.children = [];
        const actualMaterial = (mat) => {
          const actual = this.material(mat.userData.materialId);
          exportMaterials.push(actual);
          return actual;
        };
        c.material = Array.isArray(m.material)
          ? m.material.map(actualMaterial)
          : actualMaterial(m.material);
        group.add(c);
      });
    group.updateMatrixWorld(true);
    try {
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
    } finally {
      exportMaterials.forEach((mat) => mat.dispose());
    }
  }
  captureView() {
    const s = useEditor.getState();
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      up: this.camera.up.toArray(),
      orthographic: !!this.camera.isOrthographicCamera,
      span: this.orthoSpan || 6000,
      zoom: this.camera.zoom,
      fov: s.fieldOfView,
      display: Object.fromEntries(
        Object.keys(DISPLAY_DEFAULTS).map((key) => [key, s[key]]),
      ),
      visibility: s.project.objects.map((o) => ({
        id: o.id,
        visible: o.visible !== false,
      })),
      layers: s.project.layers.map((l) => ({ id: l.id, visible: l.visible })),
    };
  }
  saveView(name) {
    const s = useEditor.getState();
    const id = crypto.randomUUID(),
      capture = this.captureView();
    s.commit("Save scene view", (p) =>
      p.views.push({
        id,
        name: name?.trim() || "Scene " + (p.views.length + 1),
        ...capture,
      }),
    );
    s.set({ activeViewId: id });
  }
  restoreView(v) {
    this.view(v.orthographic ? "iso" : "perspective");
    this.camera.position.fromArray(v.position);
    if (v.up) this.camera.up.fromArray(v.up);
    this.controls.target.fromArray(v.target);
    if (v.span) this.orthoSpan = v.span;
    this.camera.zoom = v.zoom || 1;
    if (v.fov && this.camera.isPerspectiveCamera) this.camera.fov = v.fov;
    this.resizeView();
    this.controls.update();
    useEditor.getState().set({
      fieldOfView: v.fov || v.display?.fieldOfView || 42,
      activeViewId: v.id,
    });
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
