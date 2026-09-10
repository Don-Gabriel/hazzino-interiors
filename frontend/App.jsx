import React, { useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  Move3D,
  Rotate3D,
  Scaling,
  RectangleHorizontal,
  PenLine,
  Box,
  ArrowUpFromLine,
  Ruler,
  Magnet,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  Layers,
  Library,
  Search,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Group,
  Ungroup,
  Grid2X2,
  Focus,
  Camera,
  Download,
  X,
  Settings2,
  ArrowUpRight,
  PanelTop,
  Package,
  SlidersHorizontal,
  Sun,
  Scissors,
  History,
  FileJson,
  Columns3,
  Square,
  Home,
  Armchair,
  Table2,
  Keyboard,
  Circle,
  PaintBucket,
  Eraser,
  Orbit,
  Hand,
} from "lucide-react";
import { useEditor, download } from "./store.js";
import { EditorEngine } from "./engine.js";
import {
  MATERIALS,
  entity,
  furniture,
  bom,
  uid,
  clone,
  validateProject,
} from "../shared/model.js";
import { Dialogs } from "./Dialogs.jsx";
import { handleShortcut } from "./shortcuts.js";
import { DrawingOptions, extraDrawingTools } from "./DrawingTools.jsx";
import {
  StudioMenuBar,
  StudioToolbar,
  SceneTabs,
  InspectorTray,
  ViewportContextMenu,
} from "./Workspace.jsx";
export const toolList = [
  ["select", MousePointer2, "Select", "V"],
  ["line", PenLine, "Line", "L"],
  ["rectangle", RectangleHorizontal, "Rectangle", "R"],
  ["circle", Circle, "Circle", "C"],
  ...extraDrawingTools,
  ["polygon", PenLine, "Closed profile", "P"],
  ["pushpull", ArrowUpFromLine, "Push / Pull", "E"],
  ["move", Move3D, "Move", "M"],
  ["rotate", Rotate3D, "Rotate", "Q"],
  ["scale", Scaling, "Resize", "S"],
  ["measure", Ruler, "Dimension", "D"],
  ["paint", PaintBucket, "Paint bucket", "B"],
  ["eraser", Eraser, "Erase object", ""],
  ["orbit", Orbit, "Orbit", "O"],
  ["pan", Hand, "Pan", "H"],
];
export function IconButton({ icon: I, label, active, onClick, disabled }) {
  return (
    <button
      className={"icon-button " + (active ? "active" : "")}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <I size={17} />
    </button>
  );
}
export function Numeric({
  label,
  value,
  onChange,
  step = 1,
  min,
  unit,
  disabled,
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 1000) / 1000));
  useEffect(() => setDraft(String(Math.round(value * 1000) / 1000)), [value]);
  function submit() {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n) && (min == null || n >= min)) {
      if (n !== value) onChange(n);
    } else setDraft(String(value));
  }
  return (
    <label className="numeric">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        value={draft}
        step={step}
        min={min}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(String(value));
          }
        }}
      />
      {unit && <small>{unit}</small>}
    </label>
  );
}
function Viewport() {
  const el = useRef();
  const [error, setError] = useState("");
  useEffect(() => {
    let engine;
    try {
      engine = new EditorEngine(el.current);
      useEditor.setState({ engine });
    } catch (e) {
      setError(e.message);
      console.error(e);
    }
    return () => {
      engine?.dispose();
      useEditor.setState({ engine: null });
    };
  }, []);
  return (
    <div className="canvas" ref={el}>
      {error && (
        <div className="canvas-error">
          Unable to start 3D rendering: {error}
        </div>
      )}
    </div>
  );
}
export default function App() {
  const s = useEditor(),
    [fileMenu, setFileMenu] = useState(false),
    [editMenu, setEditMenu] = useState(false),
    [viewMenu, setViewMenu] = useState(false),
    [nameEdit, setNameEdit] = useState(false),
    [treeSearch, setTreeSearch] = useState("");
  const fileRef = useRef();
  useEffect(() => {
    s.checkDb();
    const h = setInterval(() => useEditor.getState().checkDb(), 15000),
      a = setInterval(() => {
        const t = useEditor.getState();
        if (t.dirty && t.dbStatus === "MongoDB") t.save();
      }, 30000);
    return () => {
      clearInterval(h);
      clearInterval(a);
    };
  }, []);
  useEffect(() => {
    const key = (e) =>
      handleShortcut(e, {
        closeMenus: () => {
          setFileMenu(false);
          setEditMenu(false);
          setViewMenu(false);
        },
        rename: () => {
          const input = document.querySelector(
            'input[aria-label="Object name"]',
          );
          if (input && !input.disabled) {
            input.focus();
            input.select();
          } else setNameEdit(true);
        },
      });
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const rows = bom(s.project);

  return (
    <div
      className={
        "app-shell studio-shell " + (s.workspace.compact ? "compact" : "")
      }
    >
      <header className="topbar">
        <div className="logo">
          <div className="logo-mark">
            h<span>·</span>
          </div>
          <div>
            HAZZINO<small>STUDIO</small>
          </div>
        </div>
        <div className="top-divider" />
        <div className="project-heading">
          {nameEdit ? (
            <input
              autoFocus
              defaultValue={s.project.name}
              onBlur={(e) => {
                if (e.target.value.trim())
                  s.commit(
                    "Rename project",
                    (p) => (p.name = e.target.value.trim()),
                  );
                setNameEdit(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          ) : (
            <button onClick={() => setNameEdit(true)}>
              {s.project.name}
              <ChevronDown size={13} />
            </button>
          )}
          <span>
            <i
              className={
                "status-dot " + (s.dbStatus === "MongoDB" ? "online" : "")
              }
            />
            {s.saveStatus}
          </span>
        </div>
        <div className="top-spacer" />
        <button
          className="search-command"
          onClick={() => s.set({ modal: "commands" })}
        >
          <Search size={15} /> Find a tool or create… <kbd>Ctrl K</kbd>
        </button>
        <button
          className="outline-dark"
          onClick={() => s.set({ modal: "bom" })}
        >
          <Columns3 size={15} /> Quantities
        </button>
        <button className="save-button" onClick={s.save}>
          <Save size={15} /> Save project
        </button>
        <div className="avatar">DP</div>
      </header>
      <StudioMenuBar importProject={() => fileRef.current?.click()} />
      {s.workspace.toolbar && <StudioToolbar />}
      <div hidden={!s.workspace.sceneTabs}>
        <SceneTabs />
      </div>
      <div className="editor-layout">
        <aside className="tool-rail">
          {toolList.map(([id, I, name, key], i) => (
            <React.Fragment key={id}>
              {[1, 5, 8].includes(i) && <div className="rail-divider" />}
              <button
                className={"tool-button " + (s.tool === id ? "active" : "")}
                title={key ? `${name} (${key})` : name}
                aria-label={name}
                onClick={() => s.set({ tool: id })}
              >
                <I size={20} />
                <span>{key}</span>
              </button>
            </React.Fragment>
          ))}
          <div className="rail-divider" />
          <IconButton
            icon={Box}
            label="Create dimensioned board"
            onClick={() => s.set({ modal: "board" })}
          />
          <div className="rail-spacer" />
          <IconButton
            icon={Keyboard}
            label="Keyboard shortcuts"
            onClick={() => s.set({ modal: "help" })}
          />
        </aside>
        <aside
          className="left-panel"
          style={{ display: s.workspace.leftPanel ? undefined : "none" }}
        >
          <div className="panel-tabs">
            <button
              className={s.leftTab === "model" ? "active" : ""}
              onClick={() => s.set({ leftTab: "model" })}
            >
              <Layers size={15} /> Outliner
            </button>
            <button
              className={s.leftTab === "library" ? "active" : ""}
              onClick={() => s.set({ leftTab: "library" })}
            >
              <Library size={15} /> Library
            </button>
          </div>
          {s.leftTab === "model" ? (
            <>
              <div className="panel-search">
                <Search size={14} />
                <input
                  placeholder="Find an object"
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                />
              </div>
              <div className="tree-scroll">
                <div className="tree-project">
                  <ChevronDown size={13} />
                  <Box size={15} />
                  <strong>Scene collection</strong>
                  <span>{s.project.objects.length}</span>
                </div>
                {s.project.groups.map((g) => (
                  <TreeGroup key={g.id} group={g} filter={treeSearch} />
                ))}
                {s.project.objects
                  .filter(
                    (o) =>
                      !o.groupId &&
                      o.name.toLowerCase().includes(treeSearch.toLowerCase()),
                  )
                  .map((o) => (
                    <TreeObject key={o.id} object={o} />
                  ))}
                {!s.project.objects.length && (
                  <div className="empty-tree">
                    <Box size={30} />
                    <p>Your canvas is ready.</p>
                    <span>Draw a rectangle or add a component to begin.</span>
                    <button onClick={() => s.set({ leftTab: "library" })}>
                      Explore library <ArrowUpRight size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="tree-actions">
                <IconButton
                  icon={Group}
                  label="Group (Ctrl G)"
                  onClick={s.group}
                />
                <IconButton
                  icon={Ungroup}
                  label="Ungroup"
                  onClick={s.ungroup}
                />
                <IconButton
                  icon={Copy}
                  label="Duplicate"
                  onClick={() => s.duplicate()}
                />
                <IconButton
                  icon={Trash2}
                  label="Delete selection"
                  onClick={s.remove}
                />
                <span>{s.selection.length} selected</span>
              </div>
              <div className="layers-panel">
                <div className="section-heading">
                  <h3>TAGS</h3>
                  <button onClick={() => s.set({ modal: "layer" })}>
                    <Plus size={14} />
                  </button>
                </div>
                {s.project.layers.map((l, i) => (
                  <div className="layer-row" key={l.id}>
                    <span className={"layer-dot color-" + i} />
                    <span>{l.id}</span>
                    <IconButton
                      icon={l.visible ? Eye : EyeOff}
                      label={"Toggle " + l.id}
                      onClick={() =>
                        s.commit(
                          "Toggle layer visibility",
                          (p) =>
                            (p.layers.find((v) => v.id === l.id).visible =
                              !l.visible),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ComponentLibrary />
          )}
          <div className="left-footer">
            <span className="small-brand">H</span>
            <div>
              Built for the details.<small>Design · Specify · Create</small>
            </div>
          </div>
        </aside>
        <main className="viewport">
          <Viewport />
          <div className="viewport-top">
            <div className="view-tabs">
              <button
                className={s.cameraView === "perspective" ? "active" : ""}
                onClick={() => s.engine?.view("perspective")}
              >
                <Box size={14} /> 3D studio
              </button>
              <button
                className={s.cameraView === "top" ? "active" : ""}
                onClick={() => s.engine?.view("top")}
              >
                <PanelTop size={14} /> Floor plan
              </button>
            </div>
            <div className="view-options">
              <span className="dropdown-wrap">
                <button onClick={() => setViewMenu(!viewMenu)}>
                  Camera <ChevronDown size={13} />
                </button>
                {viewMenu && (
                  <div className="dropdown camera-menu">
                    {[
                      "perspective",
                      "iso",
                      "front",
                      "back",
                      "left",
                      "right",
                      "top",
                      "bottom",
                    ].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          s.engine?.view(v);
                          setViewMenu(false);
                        }}
                      >
                        {v === "iso"
                          ? "Isometric"
                          : v[0].toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        s.engine?.saveView();
                        setViewMenu(false);
                      }}
                    >
                      Save current view
                    </button>
                    {s.project.views.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          s.activateScene(v.id);
                          setViewMenu(false);
                        }}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                )}
              </span>
              <IconButton
                icon={Focus}
                label="Fit model (F)"
                onClick={() => s.engine?.fit()}
              />
              <IconButton
                icon={Camera}
                label="Export viewport image"
                onClick={() => s.engine?.snapshot()}
              />
            </div>
          </div>
          <DrawingOptions />
          <div className="scene-caption">
            <span>DESIGN WORKSPACE</span>
            <h1>{s.project.name.split("·").at(-1).trim()}</h1>
            <p>
              {s.project.objects.length} objects <span>·</span>{" "}
              {new Set(rows.map((r) => r.material)).size} materials{" "}
              <span>·</span> Millimetre precision
            </p>
          </div>
          <div className="compass">
            <span className="z">Z</span>
            <span className="x">X</span>
            <span className="y">Y</span>
            <div />
            <small>Z UP</small>
          </div>
          <div className="viewport-bottom">
            <div className="display-tools">
              {[
                [Grid2X2, "Grid", "gridVisible"],
                [Magnet, "Snapping", "snapEnabled"],
                [Square, "Edges", "edges"],
                [Eye, "X-ray", "xray"],
                [Sun, "Shadows", "shadows"],
                [Scissors, "Section cut", "section"],
              ].map(([I, l, k]) => (
                <IconButton
                  key={k}
                  icon={I}
                  label={l}
                  active={s[k]}
                  onClick={() => s.set({ [k]: !s[k] })}
                />
              ))}
            </div>
            <div className="drawing-controls">
              <label>
                Plane
                <select
                  value={s.plane}
                  onChange={(e) => s.set({ plane: e.target.value })}
                >
                  <option>XY</option>
                  <option>XZ</option>
                  <option>YZ</option>
                </select>
              </label>
              <span className="axis-buttons">
                {["X", "Y", "Z"].map((a) => (
                  <button
                    key={a}
                    className={s.axis === a ? "active" : ""}
                    onClick={() => s.set({ axis: s.axis === a ? null : a })}
                  >
                    {a}
                  </button>
                ))}
              </span>
              <span className="snap-chip">
                {s.snapEnabled
                  ? s.project.settings.snap + " mm snap"
                  : "Free move"}
              </span>
            </div>
          </div>
          {s.section && (
            <div className="section-slider">
              <Scissors size={14} />
              <span>Section {s.sectionHeight} mm</span>
              <input
                aria-label="Section height"
                type="range"
                min="0"
                max="5000"
                step="10"
                value={s.sectionHeight}
                onChange={(e) =>
                  s.set({ sectionHeight: Number(e.target.value) })
                }
              />
            </div>
          )}
        </main>
        {s.workspace.rightPanel && (
          <InspectorTray properties={<Properties />} />
        )}
      </div>
      <footer className="statusbar">
        <span className="status-tool">
          {toolList.find((t) => t[0] === s.tool)?.[2]}
        </span>
        <span className="status-message" role="status" aria-live="polite">
          {s.status}
        </span>
        <div className="top-spacer" />
        {s.cursor && (
          <span className="coordinates">
            {s.cursor.type} <b>X</b>
            {s.cursor.point[0].toFixed(0)} <b>Y</b>
            {s.cursor.point[1].toFixed(0)} <b>Z</b>
            {s.cursor.point[2].toFixed(0)}
          </span>
        )}
        <span className="mouse-hint">
          Drag to orbit · Scroll to zoom · Right drag to pan
        </span>
        <span className="units-badge">{s.project.settings.unit}</span>
      </footer>
      <input
        hidden
        data-project-import
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          try {
            s.load(validateProject(JSON.parse(await f.text())));
          } catch (err) {
            s.notify("Import failed: " + err.message);
          }
          e.target.value = "";
        }}
      />
      <ViewportContextMenu />
      {s.modal && (
        <Dialogs kind={s.modal} close={() => s.set({ modal: null })} />
      )}
    </div>
  );
}
function TreeGroup({ group, filter }) {
  const s = useEditor(),
    [open, setOpen] = useState(group.name !== "Room envelope");
  const children = s.project.objects.filter(
    (o) =>
      o.groupId === group.id &&
      o.name.toLowerCase().includes(filter.toLowerCase()),
  );
  if (!children.length) return null;
  const selected = children.every((o) => s.selection.includes(o.id)),
    visible = children.some((o) => o.visible);
  return (
    <div className="tree-group">
      <div className={"tree-row group-row " + (selected ? "selected" : "")}>
        <button className="disclosure" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <button
          className="tree-name"
          onClick={() =>
            s.set({ selection: children.map((o) => o.id), face: null })
          }
        >
          <Package size={14} />
          <span>{group.name}</span>
          <small>{children.length}</small>
        </button>
        <button
          className="tree-visibility"
          aria-label={"Toggle " + group.name}
          onClick={() =>
            s.commit("Toggle group visibility", (p) =>
              p.objects
                .filter((o) => o.groupId === group.id)
                .forEach((o) => (o.visible = !visible)),
            )
          }
        >
          {visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
      </div>
      {(open || filter) &&
        children.map((o) => <TreeObject key={o.id} object={o} nested />)}
    </div>
  );
}
function TreeObject({ object: o, nested }) {
  const s = useEditor();
  return (
    <div
      className={
        "tree-row " +
        (nested ? "nested " : "") +
        (s.selection.includes(o.id) ? "selected" : "") +
        (o.visible ? "" : " hidden-object")
      }
    >
      <button className="tree-name" onClick={(e) => s.select(o.id, e.shiftKey)}>
        <Box size={12} />
        <span>{o.name}</span>
        {o.locked && <Lock size={10} />}
      </button>
      <button
        className="tree-visibility"
        aria-label={"Toggle " + o.name}
        onClick={() =>
          s.commit(
            "Toggle object visibility",
            (p) => (p.objects.find((v) => v.id === o.id).visible = !o.visible),
          )
        }
      >
        {o.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
    </div>
  );
}
export const libraryItems = [
  ["wardrobe", "Two-door wardrobe", "Parametric · 18 mm boards", Columns3],
  ["room", "Room envelope", "Walls + floor · exact dimensions", Home],
  ["desk", "Writing desk", "Oak top · steel frame", Table2],
  ["shelf", "Open bookcase", "Adjustable shelves", Library],
  ["sofa", "Lounge sofa", "Seating composition", Armchair],
  ["chair", "Dining chair", "Individual editable parts", Armchair],
];
function ComponentLibrary() {
  const s = useEditor();
  return (
    <div className="library-scroll">
      <div className="library-intro">
        <span>YOUR STARTING POINT</span>
        <h2>
          Make room
          <br />
          for an idea.
        </h2>
        <p>Editable components, down to the last board.</p>
      </div>
      {libraryItems.map(([id, name, desc, I]) => (
        <button
          className="library-card"
          key={id}
          onClick={() => s.set({ modal: "template:" + id })}
        >
          <div className={"component-illustration " + id}>
            <I size={42} strokeWidth={1} />
          </div>
          <div>
            <strong>{name}</strong>
            <small>{desc}</small>
          </div>
          <Plus size={15} />
        </button>
      ))}
      <button
        className="secondary full"
        onClick={() => s.set({ modal: "board" })}
      >
        <Plus size={15} /> Custom board or solid
      </button>
    </div>
  );
}
function Properties() {
  const s = useEditor(),
    chosen = s.project.objects.filter((o) => s.selection.includes(o.id)),
    [pull, setPull] = useState(18),
    [delta, setDelta] = useState([0, 0, 0]);
  const o = chosen[0],
    unit = s.project.settings.unit,
    factor = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 }[unit] || 1;
  if (!o)
    return (
      <>
        <div className="selection-empty">
          <div className="selection-symbol">
            <MousePointer2 size={26} />
          </div>
          <h2>Every detail matters.</h2>
          <p>
            Select an object to edit its dimensions, position, rotation, and
            finish.
          </p>
          <button
            className="primary full"
            onClick={() => s.set({ modal: "board" })}
          >
            <Plus size={15} /> Create a board
          </button>
        </div>
        <div className="panel-section">
          <h3>QUICK START</h3>
          {libraryItems.slice(0, 2).map(([id, n, d, I]) => (
            <button
              className="quick-start"
              key={id}
              onClick={() => s.set({ modal: "template:" + id })}
            >
              <I size={20} />
              <span>
                {n}
                <small>{d}</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
        <SelectionMode />
        <HistoryPanel />
      </>
    );
  const lineSpan =
    o.kind === "line"
      ? [0, 1, 2].map(
          (i) =>
            Math.max(...o.points.map((p) => p[i])) -
            Math.min(...o.points.map((p) => p[i])),
        )
      : null;
  const changeVector = (key, i, n) => {
    const v = [...o[key]];
    if (key === "size" && lineSpan) {
      if (lineSpan[i] < 1e-7) return;
      v[i] = n / lineSpan[i];
    } else v[i] = n;
    s.update(o.id, { [key]: v }, "Edit " + key);
  };
  return (
    <>
      <div className="object-heading">
        <div className="object-type-icon">
          <Box size={21} />
        </div>
        <div>
          <span>
            {chosen.length > 1 ? "MULTIPLE SELECTION" : o.kind.toUpperCase()}
          </span>
          <input
            aria-label="Object name"
            key={o.id + o.name}
            defaultValue={
              chosen.length > 1 ? chosen.length + " objects" : o.name
            }
            disabled={chosen.length > 1}
            onBlur={(e) =>
              e.target.value.trim() &&
              s.update(o.id, { name: e.target.value.trim() }, "Rename object")
            }
          />
        </div>
        <IconButton
          icon={o.locked ? Lock : Unlock}
          label="Toggle lock"
          onClick={() =>
            s.commit("Toggle lock", (p) =>
              p.objects
                .filter((v) => s.selection.includes(v.id))
                .forEach((v) => (v.locked = !o.locked)),
            )
          }
        />
      </div>
      <SelectionMode />
      {o.kind === "line" && chosen.length === 1 && (
        <p className="hint padded">
          {o.points.length - 1} segments · Length{" "}
          {(
            o.points
              .slice(1)
              .reduce(
                (total, point, i) =>
                  total +
                  Math.hypot(
                    ...point.map(
                      (v, axis) => (v - o.points[i][axis]) * o.size[axis],
                    ),
                  ),
                0,
              ) / factor
          ).toFixed(2)}{" "}
          {unit}
        </p>
      )}
      {s.face && (
        <p className="hint padded">
          Face {s.face.index + 1} selected · finish and Push/Pull apply here
        </p>
      )}
      <div className="panel-section">
        <div className="segmented">
          {[
            ["move", Move3D],
            ["rotate", Rotate3D],
            ["scale", Scaling],
          ].map(([t, I]) => (
            <button key={t} onClick={() => s.set({ tool: t })}>
              <I size={14} />
              {t}
            </button>
          ))}
        </div>
      </div>
      {chosen.length === 1 && (
        <>
          {[
            ["size", "DIMENSIONS", ["Width · X", "Depth · Y", "Height · Z"]],
            ["position", "POSITION · CENTRE", ["X", "Y", "Z"]],
            ["rotation", "ROTATION", ["X", "Y", "Z"]],
          ].map(([key, title, labels]) => (
            <div className="panel-section" key={key}>
              <div className="section-heading">
                <h3>
                  {key === "position" && lineSpan ? "POSITION · ORIGIN" : title}
                </h3>
                <span>{key === "rotation" ? "°" : unit}</span>
              </div>
              <div
                className={key === "size" ? "numeric-stack" : "numeric-triple"}
              >
                {labels.map((l, i) => (
                  <Numeric
                    key={l}
                    label={l}
                    value={
                      (o[key][i] *
                        (key === "size" && lineSpan ? lineSpan[i] : 1)) /
                      (key === "rotation" ? 1 : factor)
                    }
                    disabled={key === "size" && lineSpan && lineSpan[i] < 1e-7}
                    min={key === "size" ? 0.1 / factor : undefined}
                    onChange={(n) =>
                      changeVector(
                        key,
                        i,
                        n * (key === "rotation" ? 1 : factor),
                      )
                    }
                  />
                ))}
              </div>
              {key === "size" && o.isFace && (
                <p className="hint">2D face · Push/Pull adds thickness</p>
              )}
            </div>
          ))}
        </>
      )}
      <div className="panel-section">
        <h3>PUSH / PULL</h3>
        <div className="inline-field">
          <Numeric label="Distance" value={pull} onChange={setPull} unit="mm" />
          <button
            className="primary"
            aria-label="Apply push pull"
            disabled={chosen.every(
              (item) => !["box", "profile"].includes(item.kind),
            )}
            onClick={() => s.engine?.extrude(pull)}
          >
            <ArrowUpFromLine size={16} />
          </button>
        </div>
        <p className="hint">
          Select a face, enter an outward extrusion. Negative values inset a
          solid face.
        </p>
      </div>
      <div className="panel-section">
        <h3>EXACT DISPLACEMENT · MM</h3>
        <div className="numeric-triple">
          {["X", "Y", "Z"].map((l, i) => (
            <Numeric
              key={l}
              label={l}
              value={delta[i]}
              onChange={(n) => setDelta(delta.map((v, a) => (a === i ? n : v)))}
            />
          ))}
        </div>
        <button
          className="secondary full"
          onClick={() =>
            s.commit("Move by exact displacement", (p) =>
              p.objects
                .filter((v) => s.selection.includes(v.id) && !v.locked)
                .forEach(
                  (v) => (v.position = v.position.map((n, i) => n + delta[i])),
                ),
            )
          }
        >
          Apply displacement
        </button>
      </div>
      <div className="panel-section">
        <h3>MATERIAL & ORGANISATION</h3>
        <button
          className="material-selected"
          onClick={() => s.set({ tab: "materials" })}
        >
          <span
            style={{
              background: MATERIALS.find((m) => m.id === o.material)?.color,
            }}
          />
          <div>
            {MATERIALS.find((m) => m.id === o.material)?.name}
            <small>Change finish</small>
          </div>
          <ChevronRight size={14} />
        </button>
        <label className="field-label">
          Layer
          <select
            value={o.layer}
            onChange={(e) =>
              s.commit("Assign layer", (p) =>
                p.objects
                  .filter((v) => s.selection.includes(v.id))
                  .forEach((v) => (v.layer = e.target.value)),
              )
            }
          >
            {s.project.layers.map((l) => (
              <option key={l.id}>{l.id}</option>
            ))}
          </select>
        </label>
        <Numeric
          label="Rate / m²"
          value={
            o.rate ?? MATERIALS.find((m) => m.id === o.material)?.rate ?? 0
          }
          min={0}
          onChange={(n) => s.update(o.id, { rate: n }, "Set material rate")}
        />
      </div>
      <div className="panel-section">
        <h3>ASSEMBLY ACTIONS</h3>
        <button
          className="secondary full"
          style={{ marginBottom: 10 }}
          disabled={chosen.length !== 1 || o.kind !== "box"}
          onClick={() => s.set({ modal: "opening" })}
        >
          <Scissors size={14} /> Door / window opening
        </button>
        <div className="action-grid">
          <button onClick={() => s.duplicate()}>
            <Copy size={15} />
            Duplicate
          </button>
          <button onClick={() => s.set({ modal: "array" })}>
            <Grid2X2 size={15} />
            Array
          </button>
          <button onClick={s.group}>
            <Group size={15} />
            Group
          </button>
          <button onClick={s.ungroup}>
            <Ungroup size={15} />
            Ungroup
          </button>
          <button onClick={() => s.set({ modal: "align" })}>
            <Columns3 size={15} />
            Align
          </button>
          <button onClick={() => s.set({ modal: "mirror" })}>
            <Copy size={15} />
            Mirror
          </button>
        </div>
        <button className="danger-text full" onClick={s.remove}>
          <Trash2 size={14} /> Delete selected
        </button>
      </div>
      <HistoryPanel />
    </>
  );
}
function SelectionMode() {
  const s = useEditor();
  return (
    <div className="panel-section selection-mode">
      <h3>SELECTION MODE</h3>
      <select
        className="full-select"
        value={s.selectionMode}
        onChange={(e) => s.set({ selectionMode: e.target.value })}
      >
        <option value="object">Object</option>
        <option value="group">Assembly / group</option>
        <option value="face">Face</option>
        <option value="edge">Edge inspection</option>
      </select>
    </div>
  );
}
function MaterialsPanel() {
  const s = useEditor();
  return (
    <>
      <div className="material-intro">
        <h2>A finish for every idea.</h2>
        <p>
          {s.selection.length
            ? s.selection.length + " selected · choose a finish"
            : "Select objects to apply a material."}
        </p>
      </div>
      <div className="material-grid">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              if (!s.selection.length) {
                s.notify("Select an object first");
                return;
              }
              s.commit("Apply " + m.name, (p) =>
                p.objects
                  .filter((o) => s.selection.includes(o.id) && !o.locked)
                  .forEach((o) => {
                    if (s.face && o.kind === "box")
                      o.faceMaterials = {
                        ...o.faceMaterials,
                        [s.face.index]: m.id,
                      };
                    else {
                      o.material = m.id;
                      o.faceMaterials = {};
                    }
                  }),
              );
            }}
          >
            <div
              className={"material-swatch " + (m.grain ? "grain" : "")}
              style={{ backgroundColor: m.color }}
            />
            <strong>{m.name}</strong>
            <small>
              {m.opacity
                ? "Transparent"
                : m.metalness
                  ? "Metallic"
                  : m.grain
                    ? "Wood grain"
                    : "Solid finish"}
            </small>
          </button>
        ))}
      </div>
      <p className="hint padded">
        Grain is generated locally. Rate presets are editable planning
        assumptions, not supplier quotations.
      </p>
    </>
  );
}
function HistoryPanel() {
  const s = useEditor();
  return (
    <div className="panel-section history-panel">
      <h3>RECENT ACTIONS</h3>
      {s.history
        .slice(-4)
        .reverse()
        .map((h, i) => (
          <div key={i}>
            <History size={12} />
            <span>{h.label}</span>
          </div>
        ))}
      {!s.history.length && (
        <p className="hint">Your modelling history appears here.</p>
      )}
    </div>
  );
}
