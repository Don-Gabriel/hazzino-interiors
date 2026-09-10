import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Columns3,
  Download,
  DoorOpen,
  RotateCcw,
  Package,
  ArrowUpRight,
} from "lucide-react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Dialog } from "./Dialogs.jsx";
import { Numeric } from "./App.jsx";
import { useEditor, download } from "./store.js";
import { materialCatalog, materialFor, clone } from "../shared/model.js";
import { objectGeometry } from "../shared/geometry.js";
import {
  FURNITURE_TYPES,
  BAY_TYPES,
  KITCHEN_MODULES,
  defaultFurnitureSpec,
  buildFurniture,
  selectedFurniture,
  replaceFurniture,
  setFurnitureOpen,
} from "../shared/furniture.js";
import {
  cutList,
  cutListCSV,
  productionHTML,
  nestPanels,
  nestingSVG,
} from "../shared/production.js";

function Preview({ model, project }) {
  const host = useRef();
  useEffect(() => {
    if (!host.current || !model) return;
    const container = host.current,
      scene = new T.Scene();
    scene.background = new T.Color("#e9eddf");
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const camera = new T.PerspectiveCamera(38, 1, 1, 200000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new T.HemisphereLight(0xffffff, 0x778069, 2.3));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(-3000, -4000, 6000);
    scene.add(light);
    const modelGroup = new T.Group();
    scene.add(modelGroup);
    for (const o of model.objects) {
      const m = materialFor(project, o.material),
        geo = objectGeometry(o),
        mat = new T.MeshStandardMaterial({
          color: m.color,
          roughness: m.roughness ?? 0.6,
          metalness: m.metalness ?? 0,
          transparent: m.opacity < 1,
          opacity: m.opacity ?? 1,
        });
      const mesh = new T.Mesh(geo, mat);
      mesh.position.fromArray(o.position);
      mesh.rotation.set(...o.rotation.map((n) => (n * Math.PI) / 180));
      modelGroup.add(mesh);
      const edges = new T.LineSegments(
        new T.EdgesGeometry(geo, 25),
        new T.LineBasicMaterial({
          color: 0x344439,
          transparent: true,
          opacity: 0.5,
        }),
      );
      mesh.add(edges);
    }
    const box = new T.Box3().setFromObject(modelGroup),
      center = box.getCenter(new T.Vector3()),
      size = box.getSize(new T.Vector3()),
      span = Math.max(size.x, size.y, size.z, 500);
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(new T.Vector3(-1, -1.6, 1).normalize().multiplyScalar(span * 2));
    const grid = new T.GridHelper(
      Math.max(4000, span * 2),
      20,
      0xb8c2a8,
      0xd1d8c4,
    );
    grid.rotation.x = Math.PI / 2;
    grid.position.set(center.x, center.y, box.min.z - 2);
    scene.add(grid);
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    let frame;
    const draw = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [model, project.materials, project.materialOverrides]);
  return (
    <div
      className="furniture-preview"
      ref={host}
      aria-label="Live 3D furniture preview"
    >
      <span>Drag to orbit · scroll to zoom</span>
    </div>
  );
}

export function FurnitureBuilder({ close, type = "wardrobe", edit = false }) {
  const s = useEditor(),
    existing = edit ? selectedFurniture(s.project, s.selection)[0] : null;
  const [spec, setSpec] = useState(() =>
    clone(existing?.furnitureSpec || defaultFurnitureSpec(type)),
  );
  const [tab, setTab] = useState("design"),
    [error, setError] = useState("");
  const set = (k, v) => setSpec((s) => ({ ...s, [k]: v }));
  const preview = useMemo(() => {
    try {
      return { model: buildFurniture(spec, { id: "preview" }) };
    } catch (e) {
      return { error: e.message };
    }
  }, [spec]);
  const materials = materialCatalog(s.project),
    runs = spec.layout === "straight" ? 1 : spec.layout === "L" ? 2 : 3;
  const changeBay = (i, key, value) =>
    set(
      "bays",
      spec.bays.map((b, j) =>
        j === i
          ? { drawerHeight: 600, upperType: "shelves", ...b, [key]: value }
          : b,
      ),
    );
  function changeLayout(layout) {
    const n = layout === "straight" ? 1 : layout === "L" ? 2 : 3;
    let modules = spec.modules.map((m) => ({
      ...m,
      run: Math.min(m.run, n - 1),
    }));
    for (let run = 1; run < n; run++)
      if (!modules.some((m) => m.run === run))
        modules.push(
          { type: "base", width: 600, run },
          { type: "drawers", width: 600, run },
        );
    setSpec({ ...spec, layout, modules });
  }
  function create() {
    setError("");
    try {
      let ids;
      if (existing) {
        const ok = s.commit("Reconfigure " + spec.name, (p) => {
          ids = replaceFurniture(p, existing.id, spec);
        });
        if (!ok) throw Error(useEditor.getState().status);
      } else {
        const result = buildFurniture(spec);
        const ok = s.commit("Build " + spec.name, (p) => {
          p.objects.push(...result.objects);
          p.groups.push(...result.groups);
        });
        if (!ok) throw Error(useEditor.getState().status);
        ids = result.objects.map((o) => o.id);
      }
      s.set({
        selection: ids,
        face: null,
        tool: "select",
        selectionMode: "group",
      });
      s.engine?.fit(true);
      close();
    } catch (e) {
      setError(e.message);
    }
  }
  const field = (k, label, min = 0) => (
    <Numeric
      key={k}
      label={label + " · mm"}
      value={spec[k]}
      min={min}
      onChange={(v) => set(k, v)}
    />
  );
  return (
    <Dialog
      title={existing ? "Edit furniture" : "Furniture studio"}
      subtitle="Design the assembly. Every panel, front and fitting stays editable."
      onClose={close}
      wide
    >
      <div className="furniture-layout">
        <div className="furniture-config">
          {!existing && (
            <div className="furniture-types">
              {FURNITURE_TYPES.map(([id, label]) => (
                <button
                  key={id}
                  className={spec.type === id ? "active" : ""}
                  onClick={() => {
                    setSpec({
                      ...defaultFurnitureSpec(id),
                      x: spec.x,
                      y: spec.y,
                    });
                    setError("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <label className="field-label">
            Assembly name
            <input
              value={spec.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <div className="segmented furniture-tabs">
            {[
              ["design", "Design"],
              ["construction", "Construction"],
              ["placement", "Placement"],
            ].map(([id, name]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </div>
          {tab === "design" && (
            <>
              <div className="form-grid">
                {spec.type !== "kitchen" &&
                  field("width", "Overall width", 200)}
                {field(
                  "height",
                  spec.type === "kitchen"
                    ? "Finished base height"
                    : "Overall height",
                  200,
                )}
                {field("depth", "Overall depth", 180)}
              </div>
              {spec.type !== "desk" && (
                <label className="field-label">
                  Door mechanism
                  <select
                    value={spec.frontStyle || "hinged"}
                    onChange={(e) => set("frontStyle", e.target.value)}
                  >
                    <option value="hinged">Hinged doors</option>
                    <option value="sliding">Two-track sliding doors</option>
                    <option value="lift-up">Lift-up doors</option>
                  </select>
                </label>
              )}
              {spec.type === "kitchen" ? (
                <>
                  <label className="field-label">
                    Kitchen layout
                    <select
                      value={spec.layout}
                      onChange={(e) => changeLayout(e.target.value)}
                    >
                      <option value="straight">Straight run</option>
                      <option value="L">L shaped</option>
                      <option value="U">U shaped</option>
                    </select>
                  </label>
                  {Array.from({ length: runs }, (_, run) => (
                    <div className="furniture-section" key={run}>
                      <h3>
                        {["Main run", "Right return", "Left return"][run]}{" "}
                        <small>
                          {spec.modules
                            .filter((m) => m.run === run && m.type !== "wall")
                            .reduce((n, m) => n + m.width, 0)}{" "}
                          mm
                        </small>
                      </h3>
                      {spec.modules.map(
                        (m, i) =>
                          m.run === run && (
                            <div className="module-row" key={i}>
                              <select
                                aria-label={"Module " + (i + 1) + " type"}
                                value={m.type}
                                onChange={(e) =>
                                  set(
                                    "modules",
                                    spec.modules.map((v, j) =>
                                      i === j
                                        ? { ...v, type: e.target.value }
                                        : v,
                                    ),
                                  )
                                }
                              >
                                {KITCHEN_MODULES.map(([id, label]) => (
                                  <option key={id} value={id}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <Numeric
                                label={"Module " + (i + 1) + " width"}
                                value={m.width}
                                min={300}
                                onChange={(v) =>
                                  set(
                                    "modules",
                                    spec.modules.map((m, j) =>
                                      i === j ? { ...m, width: v } : m,
                                    ),
                                  )
                                }
                              />
                              <button
                                className="icon-button"
                                aria-label={"Remove module " + (i + 1)}
                                onClick={() =>
                                  set(
                                    "modules",
                                    spec.modules.filter((_, j) => j !== i),
                                  )
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ),
                      )}
                      <button
                        className="secondary full"
                        onClick={() =>
                          set("modules", [
                            ...spec.modules,
                            { type: "base", width: 600, run },
                          ])
                        }
                      >
                        <Plus size={14} /> Add module
                      </button>
                    </div>
                  ))}
                  {spec.layout !== "straight" && (
                    <p className="hint">
                      Each corner adds a {spec.depth + 400} mm blind cabinet to
                      the main run, with a 400 mm access front and a joined
                      worktop. Returns include {spec.worktopOverhang + 50} mm
                      service clearance.
                    </p>
                  )}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={spec.wallUnits}
                      onChange={(e) => set("wallUnits", e.target.checked)}
                    />{" "}
                    Add matching wall cabinets
                  </label>
                  <div className="form-grid">
                    {field("wallHeight", "Wall unit height", 180)}
                    {field("wallDepth", "Wall unit depth", 180)}
                    {field("wallElevation", "Wall unit bottom", 180)}
                    {field("tallHeight", "Tall unit height", 200)}
                  </div>
                </>
              ) : spec.type === "desk" ? (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={spec.deskStorage}
                    onChange={(e) => set("deskStorage", e.target.checked)}
                  />{" "}
                  Drawer pedestal on the left
                </label>
              ) : (
                <>
                  {spec.bays.map((b, i) => (
                    <div className="furniture-section" key={i}>
                      <h3>
                        Compartment {i + 1}
                        <button
                          className="icon-button"
                          aria-label={"Remove compartment " + (i + 1)}
                          disabled={spec.bays.length === 1}
                          onClick={() =>
                            set(
                              "bays",
                              spec.bays.filter((_, j) => i !== j),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </h3>
                      <div className="form-grid">
                        <label className="field-label">
                          Interior
                          <select
                            value={b.type}
                            onChange={(e) =>
                              changeBay(i, "type", e.target.value)
                            }
                          >
                            {BAY_TYPES.map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Numeric
                          label={"Compartment " + (i + 1) + " width share"}
                          value={b.weight}
                          min={0.1}
                          onChange={(v) => changeBay(i, "weight", v)}
                        />
                        {(b.type === "shelves" || b.type === "mixed") && (
                          <Numeric
                            label={"Compartment " + (i + 1) + " shelves"}
                            value={b.shelves}
                            min={0}
                            onChange={(v) => changeBay(i, "shelves", v)}
                          />
                        )}
                        {["drawers", "mixed"].includes(b.type) && (
                          <Numeric
                            label={"Compartment " + (i + 1) + " drawers"}
                            value={b.drawers}
                            min={1}
                            onChange={(v) => changeBay(i, "drawers", v)}
                          />
                        )}
                        {b.type !== "drawers" && (
                          <label className="field-label">
                            Doors
                            <select
                              value={b.doors}
                              onChange={(e) =>
                                changeBay(i, "doors", Number(e.target.value))
                              }
                            >
                              <option value={0}>No door</option>
                              <option value={1}>Single door</option>
                              <option value={2}>Double doors</option>
                            </select>
                          </label>
                        )}
                        {b.type === "mixed" && (
                          <>
                            <Numeric
                              label={
                                "Compartment " +
                                (i + 1) +
                                " lower drawer height"
                              }
                              value={b.drawerHeight ?? 600}
                              min={180}
                              onChange={(v) => changeBay(i, "drawerHeight", v)}
                            />
                            <label className="field-label">
                              Above drawers
                              <select
                                value={b.upperType || "shelves"}
                                onChange={(e) =>
                                  changeBay(i, "upperType", e.target.value)
                                }
                              >
                                <option value="shelves">Shelves</option>
                                <option value="hanging">Hanging rail</option>
                                <option value="open">Open</option>
                              </select>
                            </label>
                          </>
                        )}
                        {b.doors === 1 && b.type !== "drawers" && (
                          <label className="field-label">
                            Hinge side
                            <select
                              value={b.hinge}
                              onChange={(e) =>
                                changeBay(i, "hinge", e.target.value)
                              }
                            >
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                            </select>
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    className="secondary full"
                    disabled={spec.bays.length >= 12}
                    onClick={() =>
                      set("bays", [
                        ...spec.bays,
                        {
                          type: "shelves",
                          shelves: 3,
                          drawers: 3,
                          drawerHeight: 600,
                          upperType: "shelves",
                          doors: 1,
                          hinge: "left",
                          weight: 1,
                        },
                      ])
                    }
                  >
                    <Plus size={14} /> Add compartment
                  </button>
                </>
              )}
              {spec.type === "tv" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={spec.tvPanel}
                    onChange={(e) => set("tvPanel", e.target.checked)}
                  />{" "}
                  Add TV wall panel
                </label>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={spec.fronts}
                  onChange={(e) => set("fronts", e.target.checked)}
                />{" "}
                Show cabinet doors
              </label>
            </>
          )}
          {tab === "construction" && (
            <>
              <div className="form-grid">
                {field("thickness", "Carcass / front thickness", 9)}
                {field("backThickness", "Back / drawer bottom", 3)}
                {field("plinth", "Plinth height", 0)}
                {field("reveal", "Door / drawer reveal", 1)}
                {["kitchen", "desk"].includes(spec.type) &&
                  field("worktopThickness", "Worktop thickness", 9)}
                {spec.type === "kitchen" &&
                  field("worktopOverhang", "Worktop front overhang", 0)}
              </div>
              {[
                ["material", "Carcass finish"],
                ["frontMaterial", "Door / drawer finish"],
                ["backMaterial", "Back / drawer box"],
                ["worktopMaterial", "Kitchen worktop"],
                ["hardwareMaterial", "Hardware"],
              ].map(([key, label]) => (
                <label className="field-label" key={key}>
                  {label}
                  <select
                    value={spec[key]}
                    onChange={(e) => set(key, e.target.value)}
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={spec.handles}
                  onChange={(e) => set("handles", e.target.checked)}
                />{" "}
                Add pull handles
              </label>
              <p className="hint">
                Applied backs, overlay fronts and butt joints. Drawer boxes
                allow 13 mm per side for runners. Hardware uses editable
                reference geometry.
              </p>
            </>
          )}
          {tab === "placement" && (
            <div className="form-grid">
              {field("x", "Position X", -100000)}
              {field("y", "Position Y", -100000)}
              {field("elevation", "Bottom elevation", -100000)}
              <Numeric
                label="Rotation · degrees"
                value={spec.rotation}
                onChange={(v) => set("rotation", v)}
              />
            </div>
          )}
        </div>
        <div className="furniture-stage">
          <Preview model={preview.model} project={s.project} />
          <div className="furniture-preview-info">
            <strong>{spec.name}</strong>
            <span>
              {preview.model
                ? `${preview.model.objects.filter((o) => o.role !== "hardware").length} panels · ${preview.model.hardware.length} fittings`
                : "Adjust dimensions to preview"}
            </span>
          </div>
          <label className="front-slider">
            <DoorOpen size={17} />
            <span>Open doors / drawers</span>
            <input
              aria-label="Open doors and drawers"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={spec.open}
              onChange={(e) => set("open", Number(e.target.value))}
            />
            <output>{Math.round(spec.open * 100)}%</output>
          </label>
          <p className="hint">
            Preview uses your exact dimensions. Orbit to inspect the back and
            interior.
          </p>
          {existing && (
            <p className="hint">
              Reconfiguration rebuilds this assembly's parts. Individual
              geometry edits are replaced; Undo restores the previous assembly.
            </p>
          )}
          {(preview.error || error) && (
            <p className="error" role="alert">
              {preview.error || error}
            </p>
          )}
        </div>
      </div>
      <div className="dialog-footer">
        <button className="secondary" onClick={close}>
          Cancel
        </button>
        <button className="primary" disabled={!!preview.error} onClick={create}>
          <Plus size={16} />
          {existing ? "Update furniture" : "Add furniture to project"}
        </button>
      </div>
    </Dialog>
  );
}

export function FurnitureActions() {
  const s = useEditor(),
    assemblies = selectedFurniture(s.project, s.selection);
  if (!assemblies.length) return null;
  return (
    <div className="furniture-actions">
      <strong>
        <Package size={15} />
        {assemblies.length === 1
          ? assemblies[0].name
          : assemblies.length + " furniture assemblies"}
      </strong>
      <div className="button-row">
        <button
          className="secondary"
          disabled={assemblies.length !== 1}
          onClick={() => s.set({ modal: "furniture-edit" })}
        >
          Edit furniture
        </button>
        <button
          className="secondary"
          onClick={() =>
            s.set({
              selection: s.project.objects
                .filter((o) => assemblies.some((g) => g.id === o.furnitureId))
                .map((o) => o.id),
              face: null,
            })
          }
        >
          Select assembly
        </button>
      </div>
      <div className="button-row">
        <button
          className="secondary"
          onClick={() =>
            s.commit("Open furniture fronts", (p) =>
              assemblies.forEach((g) => setFurnitureOpen(p, g.id, 1)),
            )
          }
        >
          <DoorOpen size={14} /> Open
        </button>
        <button
          className="secondary"
          onClick={() =>
            s.commit("Close furniture fronts", (p) =>
              assemblies.forEach((g) => setFurnitureOpen(p, g.id, 0)),
            )
          }
        >
          Close
        </button>
        <button
          className="secondary"
          onClick={() => s.set({ modal: "production" })}
        >
          Cut list
        </button>
      </div>
    </div>
  );
}

export function PanelFabrication() {
  const s = useEditor(),
    o =
      s.selection.length === 1
        ? s.project.objects.find((o) => o.id === s.selection[0])
        : null;
  if (
    !o ||
    o.role === "hardware" ||
    !["box", "profile", "mesh"].includes(o.kind) ||
    o.isFace
  )
    return null;
  const f = o.fabrication || {
    thicknessAxis: o.size.indexOf(Math.min(...o.size)),
    edgeBanding: 0,
    grain: true,
  };
  const set = (k, v) =>
    s.update(o.id, { fabrication: { ...f, [k]: v } }, "Edit panel fabrication");
  return (
    <div className="panel-section">
      <h3>PANEL FABRICATION</h3>
      <button
        className="secondary full"
        disabled={o.locked}
        onClick={() => s.set({ modal: "machining" })}
      >
        Drill holes / cut pocket
      </button>
      <label className="field-label">
        Thickness direction
        <select
          value={f.thicknessAxis}
          disabled={o.locked}
          onChange={(e) =>
            s.update(
              o.id,
              {
                fabrication: {
                  ...f,
                  thicknessAxis: Number(e.target.value),
                  grainAxis: undefined,
                },
              },
              "Set board thickness direction",
            )
          }
        >
          {["X", "Y", "Z"].map((a, i) => (
            <option value={i} key={a}>
              {a} · {o.size[i]} mm
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Edge banding
        <select
          value={f.edgeBanding}
          disabled={o.locked}
          onChange={(e) => set("edgeBanding", Number(e.target.value))}
        >
          {[
            "None",
            "One length edge",
            "Two length edges",
            "Two length + one width",
            "All four edges",
          ].map((n, i) => (
            <option value={i} key={i}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={f.grain}
          disabled={o.locked}
          onChange={(e) => set("grain", e.target.checked)}
        />{" "}
        Keep grain direction in sheet layout
      </label>
      {f.grain && (
        <label className="field-label">
          Grain / cut length direction
          <select
            value={
              f.grainAxis ??
              o.size
                .map((n, i) => (i === f.thicknessAxis ? -1 : n))
                .indexOf(
                  Math.max(...o.size.filter((_, i) => i !== f.thicknessAxis)),
                )
            }
            disabled={o.locked}
            onChange={(e) => set("grainAxis", Number(e.target.value))}
          >
            {[0, 1, 2]
              .filter((i) => i !== f.thicknessAxis)
              .map((i) => (
                <option key={i} value={i}>
                  {"XYZ"[i]} · {o.size[i]} mm
                </option>
              ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function ProductionDialog({ close }) {
  const s = useEditor(),
    [scope, setScope] = useState("all"),
    [sheetWidth, setSheetWidth] = useState(1220),
    [sheetLength, setSheetLength] = useState(2440),
    [kerf, setKerf] = useState(3),
    [error, setError] = useState(""),
    [nest, setNest] = useState(null);
  const assemblies = selectedFurniture(s.project, s.selection),
    ids = new Set(assemblies.map((g) => g.id));
  const project =
    scope === "selection"
      ? {
          ...s.project,
          objects: s.project.objects.filter(
            (o) => ids.has(o.furnitureId) || s.selection.includes(o.id),
          ),
        }
      : s.project;
  const rows = cutList(project),
    area = rows.reduce(
      (n, r) => n + (r.length * r.width * r.quantity) / 1e6,
      0,
    ),
    hardware = project.objects.filter((o) => o.role === "hardware");
  function pack() {
    try {
      setNest(nestPanels(rows, { sheetWidth, sheetLength, kerf }));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Dialog
      title="Furniture production"
      subtitle="Panel dimensions follow the model, including edits made after generation."
      onClose={close}
      wide
    >
      <div className="dialog-content">
        <div className="production-toolbar">
          <label className="field-label">
            Include
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setNest(null);
              }}
            >
              <option value="all">Entire project</option>
              <option value="selection">Selected furniture / parts</option>
            </select>
          </label>
          <strong>
            {rows.reduce((n, r) => n + r.quantity, 0)} panels ·{" "}
            {area.toFixed(2)} m² · {hardware.length} fittings
          </strong>
        </div>
        <div className="production-table">
          <table>
            <thead>
              <tr>
                <th>Part / material</th>
                <th>Qty</th>
                <th>Length</th>
                <th>Width</th>
                <th>Thick.</th>
                <th>Edge band</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.name}
                    <small>
                      {r.assembly} · {r.material}
                    </small>
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.length}</td>
                  <td>{r.width}</td>
                  <td>{r.thickness}</td>
                  <td>{r.edgeMeters.toFixed(2)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p>Add furniture or rectangular panels to generate a cut list.</p>
          )}
        </div>
        <div className="furniture-section">
          <h3>Sheet layout</h3>
          <div className="form-grid">
            <Numeric
              label="Sheet length · mm"
              value={sheetLength}
              min={100}
              onChange={(n) => {
                setSheetLength(n);
                setNest(null);
              }}
            />
            <Numeric
              label="Sheet width · mm"
              value={sheetWidth}
              min={100}
              onChange={(n) => {
                setSheetWidth(n);
                setNest(null);
              }}
            />
            <Numeric
              label="Saw kerf · mm"
              value={kerf}
              min={0}
              onChange={(n) => {
                setKerf(n);
                setNest(null);
              }}
            />
          </div>
          <button className="secondary" onClick={pack}>
            Calculate sheet layout
          </button>
          {nest && (
            <div>
              <p>
                {nest.sheets.length} sheets ·{" "}
                {(nest.utilization * 100).toFixed(1)}% overall area use ·{" "}
                {nest.unplaced.length} oversized parts
              </p>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    nestingSVG(nest),
                    s.project.name + "-sheet-layout.svg",
                    "image/svg+xml",
                  )
                }
              >
                <Download size={15} /> Export sheet layout SVG
              </button>
              {nest.unplaced.length > 0 && (
                <p role="alert">
                  Too large for the sheet:{" "}
                  {nest.unplaced.map((r) => r.name).join(", ")}
                </p>
              )}
            </div>
          )}
          <p className="hint">
            Rectangular guillotine layout grouped by material and thickness.
            Grain runs along each part's length; rotation is allowed only when
            grain is disabled. Cutouts are machined after cutting the blank.
          </p>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <button
          className="secondary"
          onClick={() =>
            download(
              cutListCSV(project),
              s.project.name + "-cut-list.csv",
              "text/csv",
            )
          }
        >
          <Download size={15} /> Cut list CSV
        </button>
        <button
          className="primary"
          onClick={() =>
            download(
              productionHTML(project),
              s.project.name + "-production.html",
              "text/html",
            )
          }
        >
          <Download size={15} /> Drawings & production report
        </button>
      </div>
    </Dialog>
  );
}
