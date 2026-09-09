import { useEditor } from "./store.js";
export const shortcutGroups = [
  {
    name: "Edit",
    items: [
      ["Ctrl X / C / V", "Cut / copy / paste selection"],
      ["Ctrl Shift V", "Paste in place"],
      ["Ctrl D", "Duplicate selection"],
      ["Ctrl Z", "Undo"],
      ["Ctrl Y / Ctrl Shift Z", "Redo"],
      ["Ctrl A", "Select visible, unlocked objects"],
      ["Ctrl G / Ctrl Shift G", "Group / ungroup"],
      ["Delete / Backspace", "Delete unlocked selection"],
    ],
  },
  {
    name: "Project & help",
    items: [
      ["Ctrl S", "Save to MongoDB"],
      ["Ctrl Shift S", "Save a project copy"],
      ["Ctrl Alt N", "New project"],
      ["Ctrl Alt O / F10", "Open projects"],
      ["Ctrl Alt E", "Export"],
      ["Ctrl K", "Find tools / dimension commands"],
      ["F1 / ?", "Shortcut guide"],
      ["F2", "Rename selected object or project"],
    ],
  },
  {
    name: "Modelling tools",
    items: [
      ["V / L / R / P", "Select / line / rectangle / closed profile"],
      ["E / M / Q / S / D", "Push-pull / move / rotate / resize / dimension"],
      ["X / Y / Z", "Toggle axis constraint"],
      ["Enter", "Finish closed profile"],
      ["Esc", "Cancel drawing or close dialog"],
      ["Arrow keys", "Nudge selection along X/Y"],
      ["Page Up / Page Down", "Nudge selection along Z"],
      ["Shift + nudge", "10 × distance"],
      ["Alt + nudge", "0.1 × distance"],
    ],
  },
  {
    name: "Function keys",
    items: [
      ["F3 / F", "Fit complete model"],
      ["F4", "Properties / materials panel"],
      ["F6", "Cycle XY / XZ / YZ drawing planes"],
      ["F7", "Show / hide grid"],
      ["F8", "Enable / disable snapping"],
      ["F9", "Toggle section cut"],
      [
        "F5 / F11 / F12",
        "Browser reload / fullscreen / developer tools (browser controlled)",
      ],
    ],
  },
  {
    name: "Numpad — outside text fields",
    items: [
      ["1 / Ctrl 1", "Front / back"],
      ["3 / Ctrl 3", "Right / left"],
      ["7 / Ctrl 7", "Top / bottom"],
      ["0", "Isometric"],
      ["5", "Toggle perspective / orthographic"],
      ["4 / 6", "Orbit left / right"],
      ["8 / 2", "Orbit up / down"],
      ["9", "Back view"],
      ["+ / −", "Zoom in / out"],
      [". / Decimal", "Frame selection (or model)"],
      ["*", "Fit complete model"],
      ["/", "Toggle X-ray"],
    ],
  },
];
export function handleShortcut(e, options = {}) {
  const s = useEditor.getState(),
    tag = e.target?.tagName || "",
    editing =
      ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
      e.target?.isContentEditable;
  const key = e.key?.toLowerCase(),
    code = e.code || "",
    ctrl = e.ctrlKey || e.metaKey;
  if (key === "escape") {
    e.preventDefault();
    if (editing) e.target.blur?.();
    s.engine?.cancelDraw();
    s.set({ modal: null, tool: "select", axis: null });
    options.closeMenus?.();
    return true;
  }
  if (editing && ctrl && key === "s") {
    e.preventDefault();
    e.target.blur?.();
    e.shiftKey ? s.saveCopy() : s.save();
    return true;
  }
  if (editing) return false;
  if (s.modal) return false;
  let action;
  // Physical numpad codes work with Num Lock on or off; numeric text entry remains native.
  if (code.startsWith("Numpad")) {
    const views = {
      Numpad0: "iso",
      Numpad1: ctrl ? "back" : "front",
      Numpad3: ctrl ? "left" : "right",
      Numpad7: ctrl ? "bottom" : "top",
      Numpad9: "back",
    };
    if (views[code]) action = () => s.engine?.view(views[code]);
    else if (code === "Numpad5") action = () => s.engine?.toggleProjection();
    else if (code === "NumpadDecimal") action = () => s.engine?.fit(true);
    else if (code === "NumpadMultiply") action = () => s.engine?.fit();
    else if (code === "NumpadDivide") action = () => s.set({ xray: !s.xray });
    else if (code === "NumpadAdd" || code === "NumpadSubtract")
      action = () => s.engine?.zoomStep(code === "NumpadAdd" ? 0.8 : 1.25);
    else if (["Numpad4", "Numpad6", "Numpad8", "Numpad2"].includes(code))
      action = () =>
        s.engine?.orbitStep(
          code === "Numpad4" ? -0.2 : code === "Numpad6" ? 0.2 : 0,
          code === "Numpad8" ? -0.15 : code === "Numpad2" ? 0.15 : 0,
        );
  }
  if (!action && ctrl) {
    const map = {
      x: () => s.cut(),
      c: () => s.copy(),
      v: () => s.paste(e.shiftKey),
      d: () => s.duplicate(),
      z: () => (e.shiftKey ? s.redo() : s.undo()),
      y: s.redo,
      g: () => (e.shiftKey ? s.ungroup() : s.group()),
      a: () =>
        s.set({
          selection: s.project.objects
            .filter(
              (o) =>
                o.visible &&
                !o.locked &&
                s.project.layers.find((l) => l.id === o.layer)?.visible !==
                  false,
            )
            .map((o) => o.id),
          face: null,
        }),
      s: () => (e.shiftKey ? s.saveCopy() : s.save()),
      k: () => s.set({ modal: "commands" }),
    };
    if (e.altKey) {
      const modal = { n: "new", o: "projects", e: "export" }[key];
      if (modal) action = () => s.set({ modal });
    } else action = map[key];
  }
  if (!action && !ctrl) {
    const fn = {
      f1: () => s.set({ modal: "help" }),
      f2: () => options.rename?.(),
      f3: () => s.engine?.fit(),
      f4: () =>
        s.set({ tab: s.tab === "materials" ? "properties" : "materials" }),
      f6: () => {
        const plane = ["XY", "XZ", "YZ"][
          (["XY", "XZ", "YZ"].indexOf(s.plane) + 1) % 3
        ];
        s.set({ plane, status: "Drawing plane · " + plane });
      },
      f7: () => s.set({ gridVisible: !s.gridVisible }),
      f8: () => s.set({ snapEnabled: !s.snapEnabled }),
      f9: () => s.set({ section: !s.section }),
      f10: () => s.set({ modal: "projects" }),
    };
    action = fn[key];
    const axes = {
      arrowleft: [0, -1],
      arrowright: [0, 1],
      arrowup: [1, 1],
      arrowdown: [1, -1],
      pageup: [2, 1],
      pagedown: [2, -1],
    };
    if (!action && axes[key])
      action = () => {
        const [axis, sign] = axes[key],
          delta =
            sign *
            s.project.settings.snap *
            (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
        s.nudge(axis, delta);
      };
    if (!action && !e.altKey) {
      const tool = {
        v: "select",
        l: "line",
        r: "rectangle",
        p: "polygon",
        e: "pushpull",
        m: "move",
        q: "rotate",
        s: "scale",
        d: "measure",
      }[key];
      if (tool) action = () => s.set({ tool, status: "Tool · " + tool });
      else if (key === "delete" || key === "backspace") action = s.remove;
      else if (key === "enter") action = () => s.engine?.finishPolygon();
      else if (key === "f") action = () => s.engine?.fit();
      else if (key === "?") action = () => s.set({ modal: "help" });
      else if (["x", "y", "z"].includes(key))
        action = () =>
          s.set({
            axis: s.axis === key.toUpperCase() ? null : key.toUpperCase(),
          });
    }
  }
  if (action) {
    e.preventDefault();
    action();
    return true;
  }
  return false;
}
