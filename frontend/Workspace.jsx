import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Camera,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  Save,
  Undo2,
  Redo2,
  Focus,
  Eye,
  Grid2X2,
  Sun,
  Scissors,
  PanelLeft,
  PanelRight,
  PaintBucket,
  Layers,
  Settings2,
  Hand,
  Orbit,
  Circle,
  Square,
  Pencil,
  Move3D,
  Rotate3D,
  Scaling,
  Ruler,
  ArrowUpFromLine,
  MousePointer2,
  Eraser,
} from "lucide-react";
import { useEditor, WORKSPACE_DEFAULTS } from "./store.js";
import { MATERIALS, materialFor } from "../shared/model.js";
import { DISPLAY_DEFAULTS, DISPLAY_STYLES } from "../shared/workspace.js";
import { editorMenus, flattenCommands, PANEL_NAMES } from "./commands.js";
import { DRAWING_INSTRUCTIONS, TwoPointArcIcon } from "./DrawingTools.jsx";

function ToolButton({ icon: Icon, label, onClick, active, disabled }) {
  return (
    <button
      className={"icon-button " + (active ? "active" : "")}
      title={label}
      aria-label={label}
      aria-pressed={active == null ? undefined : active}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={17} />
    </button>
  );
}
function MenuItems({ items, close, root = false }) {
  return (
    <div
      className={root ? "studio-menu" : "studio-submenu"}
      role="menu"
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          const buttons = [...e.currentTarget.children]
            .flatMap((el) =>
              el.tagName === "BUTTON"
                ? [el]
                : [...el.children].filter((v) => v.tagName === "BUTTON"),
            )
            .filter((b) => !b.disabled);
          const index = buttons.indexOf(document.activeElement);
          buttons[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowUp" ? -1 : 1) + buttons.length) %
                  buttons.length
          ]?.focus();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div className="studio-menu-divider" role="separator" key={i} />
        ) : item.children ? (
          <div className="studio-submenu-parent" key={item.id}>
            <button
              role="menuitem"
              aria-haspopup="menu"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.nextElementSibling
                    ?.querySelector("button:not(:disabled)")
                    ?.focus();
                }
              }}
            >
              <span className="menu-check" />
              <span>{item.label}</span>
              <ChevronRight size={13} />
            </button>
            <MenuItems items={item.children} close={close} />
          </div>
        ) : (
          <button
            key={item.id}
            role={item.checked == null ? "menuitem" : "menuitemcheckbox"}
            aria-checked={item.checked}
            disabled={item.disabled}
            onClick={() => {
              close();
              item.run();
            }}
            title={item.label}
          >
            <span className="menu-check">
              {item.checked && <Check size={13} />}
            </span>
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
export function StudioMenuBar({ importProject }) {
  const s = useEditor(),
    [open, setOpen] = useState(null),
    nav = useRef();
  const menus = editorMenus(s, { importProject });
  useEffect(() => {
    const dismiss = (e) => {
      if (!nav.current?.contains(e.target)) setOpen(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  function close() {
    nav.current?.querySelector('[aria-expanded="true"]')?.focus();
    setOpen(null);
  }
  return (
    <nav
      className="menubar studio-menubar"
      aria-label="Application menus"
      ref={nav}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
        if (
          ["ArrowLeft", "ArrowRight"].includes(e.key) &&
          e.target.getAttribute("aria-expanded") != null
        ) {
          e.preventDefault();
          const index = menus.findIndex((m) => m.id === open),
            next =
              menus[
                (index + (e.key === "ArrowLeft" ? -1 : 1) + menus.length) %
                  menus.length
              ];
          setOpen(next.id);
          nav.current?.querySelector('[data-menu="' + next.id + '"]')?.focus();
        }
      }}
    >
      <div className="menu-list" role="menubar">
        {menus.map((menu) => (
          <div
            className="studio-menu-wrap"
            key={menu.id}
            onMouseEnter={() => open && setOpen(menu.id)}
          >
            <button
              data-menu={menu.id}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open === menu.id}
              className={open === menu.id ? "active" : ""}
              onClick={() => setOpen(open === menu.id ? null : menu.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(menu.id);
                  requestAnimationFrame(() =>
                    nav.current
                      ?.querySelector(".studio-menu button:not(:disabled)")
                      ?.focus(),
                  );
                }
              }}
            >
              {menu.label}
            </button>
            {open === menu.id && (
              <MenuItems items={menu.children} close={close} root />
            )}
          </div>
        ))}
      </div>
      <div className="top-spacer" />
      <span className="database-badge">
        <i
          className={"status-dot " + (s.dbStatus === "MongoDB" ? "online" : "")}
        />
        {s.dbStatus === "MongoDB" ? "MongoDB connected" : s.dbStatus}
      </span>
      <ToolButton
        icon={PanelLeft}
        label="Toggle Outliner"
        active={s.workspace.leftPanel}
        onClick={() => s.setWorkspace({ leftPanel: !s.workspace.leftPanel })}
      />
      <ToolButton
        icon={PanelRight}
        label="Toggle Default Tray"
        active={s.workspace.rightPanel}
        onClick={() => s.setWorkspace({ rightPanel: !s.workspace.rightPanel })}
      />
    </nav>
  );
}
export function StudioToolbar() {
  const s = useEditor();
  const groups = [
    [
      [Save, "Save project", s.save],
      [Undo2, "Undo", s.undo, false, !s.history.length],
      [Redo2, "Redo", s.redo, false, !s.future.length],
    ],
    [
      [Pencil, "Line", "line"],
      [Square, "Rectangle", "rectangle"],
      [Circle, "Circle", "circle"],
      [TwoPointArcIcon, "2 Point Arc", "arc-2point"],
      [Box, "Create a board or cylinder", () => s.set({ modal: "board" })],
    ],
    [
      [ArrowUpFromLine, "Push / Pull", "pushpull"],
      [Move3D, "Move", "move"],
      [Rotate3D, "Rotate", "rotate"],
      [Scaling, "Scale", "scale"],
      [PaintBucket, "Paint bucket", "paint"],
    ],
    [
      [Orbit, "Orbit", "orbit"],
      [Hand, "Pan", "pan"],
      [Focus, "Zoom extents", () => s.engine?.fit()],
    ],
    [
      [Eye, "X-ray", () => s.set({ xray: !s.xray }), s.xray],
      [Sun, "Shadows", () => s.set({ shadows: !s.shadows }), s.shadows],
      [
        Scissors,
        "Section cuts",
        () => s.set({ section: !s.section }),
        s.section,
      ],
    ],
  ];
  return (
    <div className="studio-toolbar" aria-label="Modelling toolbar">
      {groups.map((group, i) => (
        <div className="studio-tool-group" key={i}>
          {group.map(([Icon, label, action, active, disabled]) => (
            <ToolButton
              key={label}
              icon={Icon}
              label={label}
              active={typeof action === "string" ? s.tool === action : active}
              disabled={disabled}
              onClick={
                typeof action === "string"
                  ? () => s.set({ tool: action })
                  : action
              }
            />
          ))}
        </div>
      ))}
      <div className="top-spacer" />
      <select
        aria-label="Face style"
        value={s.displayStyle}
        onChange={(e) => s.set({ displayStyle: e.target.value })}
      >
        {DISPLAY_STYLES.map(([id, label]) => (
          <option value={id} key={id}>
            {label}
          </option>
        ))}
      </select>
      <ToolButton
        icon={Settings2}
        label="Workspace preferences"
        onClick={() => s.set({ modal: "workspace-settings" })}
      />
    </div>
  );
}
export function SceneTabs() {
  const s = useEditor();
  useEffect(() => {
    if (!s.playingScenes || s.project.views.length < 2) return;
    const timer = setInterval(() => {
      const state = useEditor.getState(),
        views = state.project.views;
      if (views.length < 2) {
        state.set({ playingScenes: false });
        return;
      }
      state.activateScene(
        views[
          (views.findIndex((v) => v.id === state.activeViewId) + 1) %
            views.length
        ].id,
      );
    }, 2500);
    return () => clearInterval(timer);
  }, [s.playingScenes, s.project.id, s.project.views.length]);
  return (
    <div className="scene-strip" aria-label="Scenes">
      <span className="scene-strip-label">
        <Camera size={13} /> SCENES
      </span>
      <div className="scene-tab-scroll">
        {s.project.views.length ? (
          s.project.views.map((v) => (
            <button
              key={v.id}
              className={s.activeViewId === v.id ? "active" : ""}
              onClick={() => s.activateScene(v.id)}
              onDoubleClick={() => s.showPanel("scenes")}
              title={v.name}
            >
              {v.name}
            </button>
          ))
        ) : (
          <span className="scene-placeholder">
            Save a camera view to revisit it
          </span>
        )}
      </div>
      <ToolButton
        icon={Plus}
        label="Add scene from current view"
        disabled={!s.engine}
        onClick={() => s.saveScene()}
      />
      <ToolButton
        icon={s.playingScenes ? Pause : Play}
        label={
          s.playingScenes ? "Stop scene slideshow" : "Play scene slideshow"
        }
        disabled={s.project.views.length < 2}
        active={s.playingScenes}
        onClick={() => s.set({ playingScenes: !s.playingScenes })}
      />
    </div>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = "",
  commit = false,
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const submit = (e) => {
    const n = Number(e.currentTarget.value);
    if (commit && n !== value) onChange(n);
  };
  return (
    <label className="tray-range">
      <span>
        {label}
        <output>
          {(commit ? draft : value).toFixed(step < 1 ? 2 : 0)}
          {suffix}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={commit ? draft : value}
        onChange={(e) =>
          commit
            ? setDraft(Number(e.target.value))
            : onChange(Number(e.target.value))
        }
        onPointerUp={submit}
        onKeyUp={submit}
        onBlur={submit}
      />
    </label>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <label className="tray-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function MaterialEditor() {
  const s = useEditor(),
    [query, setQuery] = useState("");
  const selected = s.project.objects.find((o) => s.selection.includes(o.id));
  const id = s.paintMaterial,
    m = materialFor(s.project, id);
  useEffect(() => {
    if (selected)
      s.set({
        paintMaterial:
          (s.face ? selected.faceMaterials?.[s.face.index] : null) ||
          selected.material,
      });
  }, [
    selected?.id,
    selected?.material,
    selected?.faceMaterials,
    s.face?.index,
  ]);
  const change = (key, value) =>
    s.commit("Edit " + m.name + " material", (p) => {
      p.materialOverrides = {
        ...p.materialOverrides,
        [id]: { ...p.materialOverrides?.[id], [key]: value },
      };
    });
  return (
    <div className="material-editor">
      <div className="material-preview" style={{ "--material-color": m.color }}>
        <div className="preview-grid" />
        <div className="material-cube" style={{ opacity: m.opacity ?? 1 }}>
          <i />
          <i />
          <i />
        </div>
        <span>{m.name}</span>
        <ToolButton
          icon={PaintBucket}
          label="Paint with selected material"
          active={s.tool === "paint"}
          onClick={() => s.set({ tool: "paint" })}
        />
      </div>
      <div className="tray-search">
        <Search size={13} />
        <input
          placeholder="Search finishes"
          aria-label="Search materials"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="finish-swatches">
        {MATERIALS.filter((v) =>
          v.name.toLowerCase().includes(query.toLowerCase()),
        ).map((v) => (
          <button
            key={v.id}
            aria-label={"Apply " + v.name}
            title={v.name}
            className={id === v.id ? "active" : ""}
            onClick={() => s.applyMaterial(v.id)}
          >
            <i style={{ background: materialFor(s.project, v.id).color }} />
            {id === v.id && <Check size={13} />}
          </button>
        ))}
      </div>
      <p className="tray-note">
        {s.selection.length
          ? `${s.selection.length} selected · ${s.face ? "face finish" : "object finish"}`
          : "Choose a finish, then paint an object."}
      </p>
      <label className="tray-color">
        Color
        <input
          type="color"
          aria-label="Material color"
          value={m.color}
          onChange={(e) => change("color", e.target.value)}
        />
        <span>{m.color.toUpperCase()}</span>
      </label>
      <Range
        label="Opacity"
        value={m.opacity ?? 1}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => change("opacity", v)}
        commit
      />
      <Range
        label="Metalness"
        value={m.metalness || 0}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => change("metalness", v)}
        commit
      />
      <Range
        label="Roughness"
        value={m.roughness}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => change("roughness", v)}
        commit
      />
      <button
        className="text-action"
        disabled={!s.project.materialOverrides?.[id]}
        onClick={() =>
          s.commit("Reset material", (p) => {
            delete p.materialOverrides[id];
          })
        }
      >
        Reset this finish
      </button>
      <p className="tray-note">
        Edits affect every use of this finish in this project.
      </p>
    </div>
  );
}
function ScenesPanel() {
  const s = useEditor();
  return (
    <div className="tray-content">
      <button
        className="tray-primary"
        disabled={!s.engine}
        onClick={() => s.saveScene()}
      >
        <Plus size={14} /> Add current view
      </button>
      {!s.project.views.length && (
        <p className="tray-note">
          Scenes remember the camera, display style, section cut, and object and
          tag visibility.
        </p>
      )}
      {s.project.views.map((v, i) => (
        <div
          className={"scene-card " + (s.activeViewId === v.id ? "active" : "")}
          key={v.id}
        >
          <button
            className="scene-camera"
            title={"Go to " + v.name}
            aria-label={"Go to " + v.name}
            onClick={() => s.activateScene(v.id)}
          >
            <Camera size={22} />
            <small>{String(i + 1).padStart(2, "0")}</small>
          </button>
          <div className="scene-details">
            <input
              key={v.name}
              aria-label={"Scene name " + (i + 1)}
              defaultValue={v.name}
              onBlur={(e) => {
                if (e.target.value.trim() !== v.name)
                  s.renameScene(v.id, e.target.value);
                e.target.value =
                  useEditor
                    .getState()
                    .project.views.find((scene) => scene.id === v.id)?.name ||
                  v.name;
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <small>
              {v.orthographic ? "Parallel projection" : "Perspective"}
            </small>
            <div className="scene-actions">
              <ToolButton
                icon={RefreshCw}
                label={"Update " + v.name + " from current view"}
                onClick={() => s.updateScene(v.id)}
              />
              <ToolButton
                icon={ArrowUp}
                label={"Move " + v.name + " earlier"}
                disabled={i === 0}
                onClick={() => s.moveScene(v.id, -1)}
              />
              <ToolButton
                icon={ArrowDown}
                label={"Move " + v.name + " later"}
                disabled={i === s.project.views.length - 1}
                onClick={() => s.moveScene(v.id, 1)}
              />
              <ToolButton
                icon={Trash2}
                label={"Delete " + v.name}
                onClick={() => s.removeScene(v.id)}
              />
            </div>
          </div>
        </div>
      ))}
      {s.project.views.length > 0 && (
        <p className="tray-note">
          Scene changes support Undo and Redo. Double-click a scene tab to open
          this panel.
        </p>
      )}
    </div>
  );
}
function StylesPanel() {
  const s = useEditor();
  return (
    <div className="tray-content">
      <div className="style-presets">
        {DISPLAY_STYLES.map(([id, label]) => (
          <button
            className={s.displayStyle === id ? "active" : ""}
            key={id}
            onClick={() => s.set({ displayStyle: id })}
          >
            <Box
              size={25}
              strokeWidth={id === "wireframe" ? 1 : 1.5}
              fill={
                id === "textured"
                  ? "#beaa83"
                  : id === "shaded"
                    ? "#a8b7a1"
                    : "none"
              }
            />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <Toggle
        label="Edges"
        checked={s.edges}
        onChange={(v) => s.set({ edges: v })}
      />
      <Range
        label="Edge contrast"
        value={s.edgeOpacity}
        min={0.05}
        max={1}
        step={0.05}
        onChange={(v) => s.set({ edgeOpacity: v })}
      />
      <Toggle
        label="X-ray"
        checked={s.xray}
        onChange={(v) => s.set({ xray: v })}
      />
      <Toggle
        label="Ground grid"
        checked={s.gridVisible}
        onChange={(v) => s.set({ gridVisible: v })}
      />
      <Toggle
        label="Drawing axes"
        checked={s.axesVisible}
        onChange={(v) => s.set({ axesVisible: v })}
      />
      <label className="tray-color">
        Background
        <input
          type="color"
          aria-label="Viewport background"
          value={s.background}
          onChange={(e) => s.set({ background: e.target.value })}
        />
      </label>
      <Range
        label="Exposure"
        value={s.exposure}
        min={0.1}
        max={4}
        step={0.05}
        onChange={(v) => s.set({ exposure: v })}
      />
      <button
        className="text-action"
        onClick={() => s.set({ ...DISPLAY_DEFAULTS })}
      >
        Restore display defaults
      </button>
    </div>
  );
}
function ShadowsPanel() {
  const s = useEditor();
  return (
    <div className="tray-content">
      <Toggle
        label="Display shadows"
        checked={s.shadows}
        onChange={(v) => s.set({ shadows: v })}
      />
      <Range
        label="Sun direction"
        value={s.sunAzimuth}
        min={0}
        max={360}
        suffix="°"
        onChange={(v) => s.set({ sunAzimuth: v })}
      />
      <Range
        label="Sun elevation"
        value={s.sunElevation}
        min={1}
        max={90}
        suffix="°"
        onChange={(v) => s.set({ sunElevation: v })}
      />
      <Range
        label="Sun intensity"
        value={s.sunIntensity}
        min={0}
        max={10}
        step={0.1}
        onChange={(v) => s.set({ sunIntensity: v })}
      />
      <p className="tray-note">
        Manual sun positioning. Use scenes to compare lighting directions.
      </p>
    </div>
  );
}
function FogPanel() {
  const s = useEditor();
  return (
    <div className="tray-content">
      <Toggle
        label="Display fog"
        checked={s.fogEnabled}
        onChange={(v) => s.set({ fogEnabled: v })}
      />
      <Range
        label="Start distance"
        value={s.fogNear}
        min={0}
        max={Math.min(99000, s.fogFar - 1000)}
        step={1000}
        suffix=" mm"
        onChange={(v) => s.set({ fogNear: v })}
      />
      <Range
        label="End distance"
        value={s.fogFar}
        min={s.fogNear + 1000}
        max={150000}
        step={1000}
        suffix=" mm"
        onChange={(v) => s.set({ fogFar: v })}
      />
      <p className="tray-note">Fog uses the viewport background color.</p>
    </div>
  );
}
function TagsPanel() {
  const s = useEditor();
  return (
    <div className="tray-content">
      {s.project.layers.map((l) => (
        <div className="tray-tag" key={l.id}>
          <Toggle
            label={l.id}
            checked={l.visible}
            onChange={(v) =>
              s.commit("Toggle tag", (p) => {
                p.layers.find((layer) => layer.id === l.id).visible = v;
              })
            }
          />
          <small>
            {s.project.objects.filter((o) => o.layer === l.id).length}
          </small>
        </div>
      ))}
      <button className="text-action" onClick={() => s.set({ modal: "layer" })}>
        <Plus size={13} /> Add tag
      </button>
    </div>
  );
}
const INSTRUCTIONS = {
  ...DRAWING_INSTRUCTIONS,
  select: [
    "Select",
    "Click an object. Shift-click to add or remove it from the selection. Right-click for object actions.",
  ],
  line: [
    "Line",
    "Click a start and end point on the drawing plane. X, Y or Z constrains the current axis.",
  ],
  rectangle: [
    "Rectangle",
    "Click two opposite corners. Set exact dimensions in Entity Info, then Push / Pull the face.",
  ],
  circle: [
    "Circle",
    "Click the center, then a point on its radius. Push / Pull creates a circular solid.",
  ],
  polygon: [
    "Closed profile",
    "Click each corner, then click the start point or press Enter to close the face.",
  ],
  pushpull: [
    "Push / Pull",
    "Select a face, enter an extrusion distance in Entity Info, and apply.",
  ],
  move: [
    "Move",
    "Drag a colored handle. Enter precise coordinates or displacement in Entity Info.",
  ],
  rotate: [
    "Rotate",
    "Drag a rotation ring. Snapping uses 15° steps. Set exact angles in Entity Info.",
  ],
  scale: [
    "Scale",
    "Drag an axis handle to resize. Set exact width, depth and height in Entity Info.",
  ],
  measure: [
    "Dimension",
    "Click two points. Object snap points keep the dimension attached when its object changes.",
  ],
  paint: [
    "Paint bucket",
    "Choose a finish in Materials and click an object. Face selection mode paints an individual box face.",
  ],
  eraser: [
    "Erase object",
    "Click an unlocked object to remove it. Undo restores it. This tool removes whole objects.",
  ],
  orbit: [
    "Orbit",
    "Drag to orbit around the view target. Scroll to zoom and right-drag to pan.",
  ],
  pan: ["Pan", "Drag to slide the view without rotating. Scroll to zoom."],
};
function Instructor() {
  const s = useEditor(),
    [title, description] = INSTRUCTIONS[s.tool] || INSTRUCTIONS.select;
  return (
    <div className="tray-content instructor-content">
      <strong>{title}</strong>
      <p>{description}</p>
      <div>
        <kbd>Esc</kbd> Cancel operation
      </div>
      <button className="text-action" onClick={() => s.set({ modal: "help" })}>
        All keyboard shortcuts
      </button>
    </div>
  );
}
export function InspectorTray({ properties }) {
  const s = useEditor(),
    [open, setOpen] = useState({
      properties: !!s.selection.length,
      materials: true,
      scenes: false,
      styles: false,
    });
  useEffect(() => {
    if (s.inspectorRequest)
      setOpen((v) => ({ ...v, [s.inspectorPanel]: true }));
  }, [s.inspectorPanel, s.inspectorRequest]);
  useEffect(() => {
    if (s.tab === "materials" || (s.tab === "properties" && s.selection.length))
      setOpen((v) => ({ ...v, [s.tab]: true }));
  }, [s.tab, s.selection]);
  const panels = {
    properties,
    materials: <MaterialEditor />,
    scenes: <ScenesPanel />,
    styles: <StylesPanel />,
    shadows: <ShadowsPanel />,
    fog: <FogPanel />,
    tags: <TagsPanel />,
    instructor: <Instructor />,
    history: (
      <div className="tray-content">
        {s.history
          .slice(-12)
          .reverse()
          .map((h, i) => (
            <p className="history-entry" key={i}>
              <Undo2 size={12} />
              {h.label}
            </p>
          ))}
        {!s.history.length && (
          <p className="tray-note">Your modelling actions appear here.</p>
        )}
      </div>
    ),
  };
  return (
    <aside
      className="right-panel inspector-tray"
      style={{ width: s.workspace.panelWidth }}
      aria-label="Default tray"
    >
      <div className="tray-title">
        <Layers size={14} />
        <strong>Default Tray</strong>
        <span />
        <ToolButton
          icon={Settings2}
          label="Tray preferences"
          onClick={() => s.set({ modal: "workspace-settings" })}
        />
        <ToolButton
          icon={X}
          label="Hide Default Tray"
          onClick={() => s.setWorkspace({ rightPanel: false })}
        />
      </div>
      <div className="tray-scroll">
        {Object.entries(PANEL_NAMES).map(([id, label]) => (
          <section className="tray-section" key={id}>
            <button
              className="tray-heading"
              aria-expanded={!!open[id]}
              aria-controls={"tray-" + id}
              onClick={() => setOpen((v) => ({ ...v, [id]: !v[id] }))}
            >
              {open[id] ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}
              <span>{label}</span>
              {id === "scenes" && <small>{s.project.views.length}</small>}
              {id === "properties" && (
                <small>
                  {s.selection.length
                    ? s.selection.length + " selected"
                    : "No selection"}
                </small>
              )}
            </button>
            {open[id] && <div id={"tray-" + id}>{panels[id]}</div>}
          </section>
        ))}
      </div>
    </aside>
  );
}
export function ViewportContextMenu() {
  const s = useEditor(),
    ref = useRef();
  useEffect(() => {
    const dismiss = (e) => {
      if (!ref.current?.contains(e.target)) s.set({ contextMenu: null });
    };
    const key = (e) => {
      if (e.key === "Escape") s.set({ contextMenu: null });
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key);
    };
  }, []);
  if (!s.contextMenu) return null;
  const ids = s.selection.length
    ? [
        "cut",
        "copy",
        "duplicate",
        "delete",
        "make-group",
        "ungroup",
        "hide",
        "lock",
        "unlock",
        "zoom-selection",
        "panel-properties",
      ]
    : ["paste", "select-all", "unhide", "zoom-extents", "save-scene"];
  const commands = flattenCommands(editorMenus(s)),
    items = ids.map((id) => commands.find((c) => c.id === id)).filter(Boolean);
  return (
    <div
      className="viewport-context"
      ref={ref}
      style={{
        left: Math.max(8, Math.min(s.contextMenu.x, window.innerWidth - 280)),
        top: Math.max(
          8,
          Math.min(
            s.contextMenu.y,
            window.innerHeight - items.length * 31 - 20,
          ),
        ),
      }}
    >
      <MenuItems
        items={items}
        root
        close={() => s.set({ contextMenu: null })}
      />
    </div>
  );
}
export function WorkspaceSettings({ close }) {
  const s = useEditor();
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace preferences"
      >
        <header>
          <div>
            <h2>Workspace preferences</h2>
            <p>Arrange your modelling space.</p>
          </div>
          <ToolButton icon={X} label="Close preferences" onClick={close} />
        </header>
        <div className="dialog-content workspace-settings">
          <h3>WORKSPACE</h3>
          {[
            ["leftPanel", "Outliner & component library"],
            ["rightPanel", "Default Tray"],
            ["toolbar", "Modelling toolbar"],
            ["sceneTabs", "Scene tabs"],
            ["compact", "Compact interface"],
          ].map(([key, label]) => (
            <Toggle
              key={key}
              label={label}
              checked={s.workspace[key]}
              onChange={(v) => s.setWorkspace({ [key]: v })}
            />
          ))}
          <Range
            label="Tray width"
            value={s.workspace.panelWidth}
            min={270}
            max={420}
            step={10}
            suffix=" px"
            onChange={(v) => s.setWorkspace({ panelWidth: v })}
          />
          <h3>CAMERA & DRAWING</h3>
          <Range
            label="Field of view"
            value={s.fieldOfView}
            min={10}
            max={100}
            suffix="°"
            onChange={(v) => s.set({ fieldOfView: v })}
          />
          <Range
            label="Circle segments"
            value={s.curveSegments}
            min={12}
            max={96}
            step={4}
            onChange={(v) => s.set({ curveSegments: v })}
          />
          <button
            className="text-action"
            onClick={() => s.set({ modal: "settings" })}
          >
            Model units, grid & snap settings…
          </button>
          <p className="tray-note">
            Workspace layout is remembered on this device. Save a scene to
            retain camera and display settings in the project.
          </p>
        </div>
        <div className="dialog-footer">
          <button
            className="secondary"
            onClick={() => s.setWorkspace({ ...WORKSPACE_DEFAULTS })}
          >
            Reset layout
          </button>
          <button className="primary" onClick={close}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}
