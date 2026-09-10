import { useEditor, WORKSPACE_DEFAULTS, download } from "./store.js";
import { DISPLAY_STYLES } from "../shared/workspace.js";
import {
  FURNITURE_TYPES,
  selectedFurniture,
  setFurnitureOpen,
} from "../shared/furniture.js";

export const PANEL_NAMES = {
  properties: "Entity Info",
  materials: "Materials",
  scenes: "Scenes",
  styles: "Styles",
  shadows: "Shadows",
  fog: "Fog",
  tags: "Tags",
  instructor: "Instructor",
  history: "History",
};
export function editorMenus(s = useEditor.getState(), options = {}) {
  const action = (id, label, run, extras = {}) => ({
    id,
    label,
    run,
    ...extras,
  });
  const modal = (id, label, kind, extras) =>
    action(id, label, () => s.set({ modal: kind }), extras);
  const tool = (id, label, shortcut) =>
    action("tool-" + id, label, () => s.set({ tool: id }), {
      shortcut,
      checked: s.tool === id,
    });
  const toggle = (key, label) =>
    action("toggle-" + key, label, () => s.set({ [key]: !s[key] }), {
      checked: !!s[key],
    });
  const submenu = (id, label, children) => ({ id, label, children });
  const separator = { separator: true };
  const selected = s.selection.length > 0;
  const editable = s.project.objects.some(
    (o) => s.selection.includes(o.id) && !o.locked,
  );
  const needsSelection = { disabled: !editable };
  const views = [
    "perspective",
    "iso",
    "top",
    "front",
    "right",
    "back",
    "left",
    "bottom",
  ];
  const viewItems = views.map((name) =>
    action(
      "view-" + name,
      name === "iso" ? "Isometric" : name[0].toUpperCase() + name.slice(1),
      () => s.engine?.view(name),
      { checked: s.cameraView === name, disabled: !s.engine },
    ),
  );
  const drawing = [
    submenu("draw-lines", "Lines", [
      tool("line", "Line", "L"),
      tool("freehand", "Freehand"),
    ]),
    submenu("draw-arcs", "Arcs", [
      tool("arc", "Arc"),
      tool("arc-2point", "2 Point Arc", "A"),
      tool("arc-3point", "3 Point Arc"),
      tool("pie", "Pie"),
    ]),
    submenu("draw-shapes", "Shapes", [
      tool("rectangle", "Rectangle", "R"),
      tool("rotated-rectangle", "Rotated Rectangle"),
      tool("circle", "Circle", "C"),
      tool("regular-polygon", "Polygon"),
    ]),
    tool("polygon", "Closed profile"),
  ];
  return [
    submenu("furniture", "Furniture", [
      ...FURNITURE_TYPES.map(([id, label]) =>
        modal(
          "build-" + id,
          "Build " + label.toLowerCase() + "…",
          "furniture:" + id,
        ),
      ),
      separator,
      modal("edit-furniture", "Edit selected furniture…", "furniture-edit", {
        disabled: selectedFurniture(s.project, s.selection).length !== 1,
      }),
      action(
        "select-furniture",
        "Select whole furniture",
        () => {
          const ids = new Set(
            selectedFurniture(s.project, s.selection).map((g) => g.id),
          );
          s.set({
            selection: s.project.objects
              .filter((o) => ids.has(o.furnitureId))
              .map((o) => o.id),
            face: null,
          });
        },
        { disabled: !selectedFurniture(s.project, s.selection).length },
      ),
      ...[
        [1, "Open"],
        [0, "Close"],
      ].map(([amount, label]) =>
        action(
          "fronts-" + amount,
          label + " doors and drawers",
          () =>
            s.commit(label + " furniture fronts", (p) =>
              selectedFurniture(p, s.selection).forEach((g) =>
                setFurnitureOpen(p, g.id, amount),
              ),
            ),
          { disabled: !selectedFurniture(s.project, s.selection).length },
        ),
      ),
      separator,
      modal("production", "Cut list, drawings & sheet layout…", "production"),
      modal("motion", "Hinges, slides & clearance…", "motion"),
      modal("machining", "Panel drilling, pockets & grooves…", "machining", {
        disabled: s.selection.length !== 1,
      }),
    ]),
    submenu("file", "File", [
      modal("new-project", "New project…", "new", { shortcut: "Ctrl Alt N" }),
      modal("open-project", "Open projects…", "projects", {
        shortcut: "Ctrl Alt O",
      }),
      action("save", "Save", s.save, { shortcut: "Ctrl S" }),
      action("save-copy", "Save a copy", s.saveCopy, {
        shortcut: "Ctrl Shift S",
      }),
      separator,
      action(
        "import-json",
        "Import project JSON…",
        () => options.importProject?.(),
        { disabled: !options.importProject },
      ),
      modal("import-model", "Import 3D model…", "import-model"),
      modal("model-library", "3D model library…", "model-library"),
      submenu("export", "Export", [
        action("export-json", "Editable project · JSON", () =>
          download(
            JSON.stringify(s.project, null, 2),
            s.project.name + ".json",
          ),
        ),
        ...["glb", "obj", "stl"].map((type) =>
          action(
            "export-" + type,
            "3D model · " + type.toUpperCase(),
            () =>
              s.engine
                ?.export(type)
                .catch((e) => s.notify("Export failed: " + e.message)),
            { disabled: !s.engine },
          ),
        ),
        action(
          "export-png",
          "Viewport image · PNG",
          () => s.engine?.snapshot(),
          { disabled: !s.engine },
        ),
        modal("export-production", "Plans, quantities & reports…", "export"),
      ]),
      separator,
      modal("versions", "Version checkpoints…", "versions"),
      modal("model-info", "Model settings…", "settings"),
    ]),
    submenu("edit", "Edit", [
      action(
        "undo",
        "Undo" + (s.history.length ? " · " + s.history.at(-1).label : ""),
        s.undo,
        { shortcut: "Ctrl Z", disabled: !s.history.length },
      ),
      action("redo", "Redo", s.redo, {
        shortcut: "Ctrl Y",
        disabled: !s.future.length,
      }),
      separator,
      action("cut", "Cut", s.cut, { shortcut: "Ctrl X", ...needsSelection }),
      action("copy", "Copy", s.copy, {
        shortcut: "Ctrl C",
        disabled: !selected,
      }),
      action("paste", "Paste", () => s.paste(), {
        shortcut: "Ctrl V",
        disabled: !s.clipboard,
      }),
      action("paste-in-place", "Paste in place", () => s.paste(true), {
        shortcut: "Ctrl Shift V",
        disabled: !s.clipboard,
      }),
      action("delete", "Delete selection", s.remove, {
        shortcut: "Delete",
        ...needsSelection,
      }),
      separator,
      action("select-all", "Select all", s.selectAll, { shortcut: "Ctrl A" }),
      action("select-none", "Select none", () => s.select(null)),
      action("invert-selection", "Invert selection", () => {
        const before = new Set(s.selection);
        s.selectAll();
        s.set({
          selection: useEditor
            .getState()
            .selection.filter((id) => !before.has(id)),
        });
      }),
      separator,
      action("make-group", "Make group", s.group, {
        shortcut: "Ctrl G",
        ...needsSelection,
      }),
      action("ungroup", "Ungroup", s.ungroup, {
        shortcut: "Ctrl Shift G",
        ...needsSelection,
      }),
      action(
        "hide",
        "Hide selection",
        () => s.selectionProperty("visible", false),
        needsSelection,
      ),
      action("unhide", "Unhide all", s.unhideAll),
      action(
        "lock",
        "Lock selection",
        () => s.selectionProperty("locked", true),
        { disabled: !selected },
      ),
      action(
        "unlock",
        "Unlock selection",
        () => s.selectionProperty("locked", false),
        { disabled: !selected },
      ),
    ]),
    submenu("view", "View", [
      submenu(
        "face-style",
        "Face style",
        DISPLAY_STYLES.map(([id, label]) =>
          action("style-" + id, label, () => s.set({ displayStyle: id }), {
            checked: s.displayStyle === id,
          }),
        ),
      ),
      toggle("edges", "Edges"),
      toggle("xray", "X-ray"),
      toggle("gridVisible", "Grid"),
      toggle("axesVisible", "Axes"),
      toggle("shadows", "Shadows"),
      toggle("fogEnabled", "Fog"),
      toggle("section", "Section cuts"),
      separator,
      submenu(
        "workspace-visibility",
        "Workspace",
        [
          ["toolbar", "Toolbars"],
          ["sceneTabs", "Scene tabs"],
          ["leftPanel", "Outliner & library"],
          ["rightPanel", "Default tray"],
        ].map(([key, label]) =>
          action(
            "workspace-" + key,
            label,
            () => s.setWorkspace({ [key]: !s.workspace[key] }),
            { checked: s.workspace[key] },
          ),
        ),
      ),
      action("reset-workspace", "Reset workspace layout", () =>
        s.setWorkspace({ ...WORKSPACE_DEFAULTS }),
      ),
    ]),
    submenu("camera", "Camera", [
      submenu("standard-views", "Standard views", viewItems),
      action(
        "perspective-projection",
        "Perspective",
        () => {
          if (s.projection !== "perspective") s.engine?.toggleProjection();
        },
        { checked: s.projection === "perspective", disabled: !s.engine },
      ),
      action(
        "parallel-projection",
        "Parallel projection",
        () => {
          if (s.projection !== "orthographic") s.engine?.toggleProjection();
        },
        { checked: s.projection === "orthographic", disabled: !s.engine },
      ),
      separator,
      tool("orbit", "Orbit", "O"),
      tool("pan", "Pan", "H"),
      action("zoom-in", "Zoom in", () => s.engine?.zoomStep(0.8), {
        shortcut: "Num +",
      }),
      action("zoom-out", "Zoom out", () => s.engine?.zoomStep(1.25), {
        shortcut: "Num −",
      }),
      action("zoom-extents", "Zoom extents", () => s.engine?.fit(), {
        shortcut: "F3",
      }),
      action("zoom-selection", "Zoom selection", () => s.engine?.fit(true), {
        disabled: !selected,
      }),
      separator,
      action("save-scene", "Add scene", () => s.saveScene(), {
        disabled: !s.engine,
      }),
      action("scene-panel", "Manage scenes…", () => s.showPanel("scenes")),
    ]),
    submenu("draw", "Draw", [
      ...drawing,
      separator,
      modal("create-solid", "Dimensioned board / cylinder…", "board"),
      modal("create-room", "Room envelope…", "template:room"),
    ]),
    submenu("tools", "Tools", [
      tool("select", "Select", "Space"),
      tool("eraser", "Erase object", "E"),
      tool("paint", "Paint bucket", "B"),
      separator,
      tool("pushpull", "Push / Pull", "P"),
      tool("offset", "Offset", "F"),
      modal("follow-me", "Follow Me…", "follow-me"),
      submenu("solid-operations", "Solid tools", [
        ...[
          ["union", "Union"],
          ["subtract", "Subtract"],
          ["intersect", "Intersect"],
          ["trim", "Trim"],
          ["split", "Split"],
          ["outer-shell", "Outer shell"],
        ].map(([id, label]) =>
          action("solid-" + id, label, () => s.engine?.solidOperation(id), {
            disabled: s.selection.length < 2,
          }),
        ),
        modal("solid-tools-panel", "Solid tools panel…", "solid-tools"),
      ]),
      tool("move", "Move", "M"),
      tool("rotate", "Rotate", "Q"),
      tool("scale", "Scale", "S"),
      tool("measure", "Dimension", "D"),
      separator,
      action("duplicate", "Duplicate", () => s.duplicate(), {
        shortcut: "Ctrl D",
        ...needsSelection,
      }),
      modal("array", "Array copies…", "array", needsSelection),
      modal("mirror", "Mirror copies…", "mirror", needsSelection),
      modal("align", "Align objects…", "align", {
        disabled: s.selection.length < 2,
      }),
      modal("opening", "Door / window opening…", "opening", {
        disabled: s.selection.length !== 1 || !editable,
      }),
      separator,
      modal("health", "Model health checks…", "health"),
      modal("quantities", "Quantities & estimate…", "bom"),
    ]),
    submenu("window", "Window", [
      ...Object.entries(PANEL_NAMES).map(([id, name]) =>
        action("panel-" + id, name, () => s.showPanel(id), {
          checked: s.workspace.rightPanel && s.inspectorPanel === id,
        }),
      ),
      separator,
      action("outliner", "Outliner", () => {
        s.setWorkspace({ leftPanel: true });
        s.set({ leftTab: "model" });
      }),
      action("components", "Components", () => {
        s.setWorkspace({ leftPanel: true });
        s.set({ leftTab: "library" });
      }),
      modal("preferences", "Preferences…", "workspace-settings"),
    ]),
    submenu("extensions", "Extensions", [
      modal("hospital", "AI Hospital…", "hospital"),
      ...[
        ["wardrobe", "Parametric wardrobe"],
        ["shelf", "Parametric bookcase"],
      ].map(([id, label]) =>
        modal("template-" + id, label + "…", "template:" + id),
      ),
    ]),
    submenu("help", "Help", [
      modal("command-search", "Search commands…", "commands", {
        shortcut: "Ctrl K",
      }),
      modal("shortcut-guide", "Keyboard shortcuts…", "help", {
        shortcut: "F1",
      }),
      action("instructor", "Instructor", () => s.showPanel("instructor")),
    ]),
  ];
}
export function flattenCommands(menus, path = []) {
  return menus.flatMap((item) =>
    item.separator
      ? []
      : item.children
        ? flattenCommands(item.children, [...path, item.label])
        : [{ ...item, path: path.join(" › ") }],
  );
}
