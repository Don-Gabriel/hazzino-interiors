import { create } from "zustand";
import { DISPLAY_DEFAULTS } from "../shared/workspace.js";
import {
  groupObjects,
  pruneGroups,
  selectionProject,
  translateAssembly,
  reconcileFurnitureEdits,
} from "../shared/assemblies.js";
import { instantiateProject } from "../shared/project-import.js";
import { writeRecovery } from "./recovery.js";
export { localProjects, localProject } from "./recovery.js";
import {
  blankProject,
  demoProject,
  clone,
  uid,
  validateProject,
} from "../shared/model.js";
const RECOVERY = "hazzino-recovery-v1";
export const WORKSPACE_DEFAULTS = {
  leftPanel: true,
  rightPanel: true,
  toolbar: true,
  sceneTabs: true,
  compact: false,
  panelWidth: 310,
};
let workspace = { ...WORKSPACE_DEFAULTS };
try {
  const saved = JSON.parse(
    localStorage.getItem("hazzino-workspace-v1") || "{}",
  );
  for (const key of Object.keys(WORKSPACE_DEFAULTS)) {
    if (typeof saved[key] === typeof WORKSPACE_DEFAULTS[key])
      workspace[key] = saved[key];
  }
  workspace.panelWidth = Math.max(270, Math.min(420, workspace.panelWidth));
} catch {}
let initial;
try {
  initial = validateProject(JSON.parse(localStorage.getItem(RECOVERY)));
} catch {
  initial = demoProject();
}
export const useEditor = create((set, get) => ({
  project: initial,
  selection: [],
  face: null,
  tool: "select",
  operationActive: false,
  operationValue: null,
  measurementDraft: "",
  plane: "XY",
  snapEnabled: true,
  gridVisible: true,
  edges: true,
  shadows: true,
  xray: false,
  section: false,
  sectionHeight: 1500,
  ...DISPLAY_DEFAULTS,
  workspace,
  activeViewId: null,
  cameraView: "perspective",
  projection: "perspective",
  playingScenes: false,
  contextMenu: null,
  inspectorPanel: "properties",
  curveSegments: 48,
  arcSegments: 12,
  polygonSides: 6,
  arcClockwise: false,
  paintMaterial: "oak",
  axis: null,
  selectionMode: "object",
  history: [],
  future: [],
  status: "Ready to create",
  saveStatus: "Local recovery ready",
  dbStatus: "connecting",
  dbConnected: false,
  modal: null,
  tab: "properties",
  leftTab: "model",
  cursor: null,
  engine: null,
  dirty: false,
  clipboard: null,
  copy: () => {
    const s = get(),
      objects = s.project.objects.filter((o) => s.selection.includes(o.id));
    if (!objects.length) {
      s.notify("Select objects to copy");
      return;
    }
    set({
      clipboard: {
        ...selectionProject(s.project, s.selection),
        objects: selectionProject(s.project, s.selection).objects,
        groups: clone(selectionProject(s.project, s.selection).groups),
        layers: clone(s.project.layers),
        sourceId: s.project.id,
        cut: false,
        pasteCount: 0,
      },
      status: "Copied " + objects.length + " objects",
    });
  },
  cut: () => {
    const s = get(),
      objects = s.project.objects.filter(
        (o) => s.selection.includes(o.id) && !o.locked,
      );
    if (!objects.length) {
      s.notify("Select unlocked objects to cut");
      return;
    }
    set({
      clipboard: {
        ...selectionProject(
          s.project,
          objects.map((o) => o.id),
        ),
        objects: selectionProject(
          s.project,
          objects.map((o) => o.id),
        ).objects,
        groups: clone(
          selectionProject(
            s.project,
            objects.map((o) => o.id),
          ).groups,
        ),
        layers: clone(s.project.layers),
        sourceId: s.project.id,
        cut: true,
        pasteCount: 0,
      },
    });
    s.commit("Cut " + objects.length + " objects", (p) => {
      p.objects = p.objects.filter((o) => !objects.some((v) => v.id === o.id));
      pruneGroups(p);
    });
    set({ selection: [], face: null });
  },
  paste: (inPlace = false) => {
    const s = get(),
      c = s.clipboard;
    if (!c?.objects.length) {
      s.notify("Copy or cut objects first");
      return;
    }
    const offset = inPlace || c.cut ? 0 : 100 * (c.pasteCount + 1);
    const items = translateAssembly(
        instantiateProject({ ...blankProject(), ...c }, s.project),
        [offset, 0, 0],
      ),
      objects = items.objects;
    for (const o of objects)
      if (o.anchors)
        o.anchors = o.anchors.map((a) =>
          a &&
          (objects.some((v) => v.id === a.id) ||
            (c.sourceId === s.project.id &&
              s.project.objects.some((v) => v.id === a.id)))
            ? a
            : null,
        );
    s.commit(inPlace ? "Paste in place" : "Paste objects", (p) => {
      for (const l of items.layers)
        if (!p.layers.some((v) => v.id === l.id)) p.layers.push(l);
      p.groups.push(...items.groups);
      if (items.materials.length)
        p.materials = [...(p.materials || []), ...items.materials];
      p.objects.push(...objects);
    });
    set({
      selection: objects.map((o) => o.id),
      face: null,
      tool: "select",
      clipboard: { ...c, cut: false, pasteCount: c.pasteCount + 1 },
    });
  },
  nudge: (axis, amount) => {
    const s = get();
    if (!s.selection.length) {
      s.notify("Select objects to nudge");
      return;
    }
    s.commit("Nudge " + "XYZ"[axis] + " " + amount + " mm", (p) =>
      p.objects
        .filter((o) => s.selection.includes(o.id) && !o.locked)
        .forEach((o) => (o.position[axis] += amount)),
    );
  },
  saveCopy: async () => {
    const s = get(),
      p = clone(s.project);
    p.id = uid();
    p.name += " copy";
    s.load(p);
    return get().save();
  },
  set: (v) => set(v),
  setWorkspace: (patch) => {
    const workspace = { ...get().workspace, ...patch };
    set({ workspace });
    try {
      localStorage.setItem("hazzino-workspace-v1", JSON.stringify(workspace));
    } catch {}
  },
  showPanel: (panel) => {
    get().setWorkspace({ rightPanel: true });
    set({
      inspectorPanel: panel,
      tab: panel,
      inspectorRequest: (get().inspectorRequest || 0) + 1,
    });
  },
  selectAll: () => {
    const p = get().project;
    set({
      selection: p.objects
        .filter(
          (o) =>
            o.visible !== false &&
            !o.locked &&
            p.layers.find((l) => l.id === o.layer)?.visible !== false,
        )
        .map((o) => o.id),
      face: null,
    });
  },
  selectionProperty: (key, value) => {
    if (!["visible", "locked"].includes(key) || !get().selection.length) return;
    get().commit((value ? "Enable " : "Disable ") + key, (p) =>
      p.objects
        .filter(
          (o) =>
            get().selection.includes(o.id) && (key === "locked" || !o.locked),
        )
        .forEach((o) => {
          o[key] = value;
        }),
    );
    if (key === "visible" && !value) set({ selection: [], face: null });
  },
  unhideAll: () =>
    get().commit("Show all objects and tags", (p) => {
      p.objects
        .filter((o) => !o.locked)
        .forEach((o) => {
          o.visible = true;
        });
      p.layers.forEach((l) => {
        l.visible = true;
      });
    }),
  applyMaterial: (id) => {
    const s = get();
    set({ paintMaterial: id });
    if (!s.selection.length) return;
    s.commit("Apply material", (p) =>
      p.objects
        .filter((o) => s.selection.includes(o.id) && !o.locked)
        .forEach((o) => {
          if (s.face && (o.kind === "box" || o.faceGroups))
            o.faceMaterials = { ...o.faceMaterials, [s.face.index]: id };
          else {
            o.material = id;
            o.faceMaterials = {};
            if (o.faceGroups) o.faceGroups.forEach((g) => (g.material = id));
          }
        }),
    );
  },
  saveScene: (name) => get().engine?.saveView(name),
  updateScene: (id) => {
    const capture = get().engine?.captureView();
    if (!capture) return;
    get().commit("Update scene", (p) => {
      const v = p.views.find((v) => v.id === id);
      if (v) Object.assign(v, capture);
    });
    set({ activeViewId: id });
  },
  renameScene: (id, name) => {
    if (!name.trim() || name.trim().length > 200) return;
    get().commit("Rename scene", (p) => {
      const v = p.views.find((v) => v.id === id);
      if (v) v.name = name.trim();
    });
  },
  removeScene: (id) => {
    get().commit("Delete scene", (p) => {
      p.views = p.views.filter((v) => v.id !== id);
    });
    if (get().activeViewId === id)
      set({ activeViewId: null, playingScenes: false });
  },
  moveScene: (id, delta) =>
    get().commit("Reorder scenes", (p) => {
      const i = p.views.findIndex((v) => v.id === id),
        next = i + delta;
      if (i < 0 || next < 0 || next >= p.views.length) return;
      const [v] = p.views.splice(i, 1);
      p.views.splice(next, 0, v);
    }),
  activateScene: (id) => {
    const s = get(),
      v = s.project.views.find((v) => v.id === id);
    if (!v) return;
    s.engine?.restoreView(v);
    const objects = new Map(v.visibility?.map((o) => [o.id, o.visible]) || []);
    const layers = new Map(v.layers?.map((l) => [l.id, l.visible]) || []);
    if (
      s.project.objects.some(
        (o) => objects.has(o.id) && objects.get(o.id) !== o.visible,
      ) ||
      s.project.layers.some(
        (l) => layers.has(l.id) && layers.get(l.id) !== l.visible,
      )
    ) {
      s.commit("Restore scene visibility", (p) => {
        p.objects.forEach((o) => {
          if (objects.has(o.id)) o.visible = objects.get(o.id);
        });
        p.layers.forEach((l) => {
          if (layers.has(l.id)) l.visible = layers.get(l.id);
        });
      });
    }
    set({
      ...(v.display || {}),
      activeViewId: id,
      status: "Scene · " + v.name,
      selection: [],
      face: null,
    });
  },
  notify: (status) => set({ status }),
  commit: (label, mutate) => {
    const s = get(),
      p = clone(s.project);
    try {
      mutate(p);
      reconcileFurnitureEdits(s.project, p);
      pruneGroups(p, [...s.project.groups, ...p.groups]);
      p.updatedAt = new Date().toISOString();
      validateProject(p);
      set({
        project: p,
        history: [...s.history.slice(-79), { label, project: s.project }],
        future: [],
        dirty: true,
        status: label,
      });
      get().recover(true);
      return true;
    } catch (e) {
      set({ status: e.message });
      return false;
    }
  },
  undo: () => {
    const s = get();
    if (!s.history.length) return;
    const h = s.history.at(-1);
    set({
      project: h.project,
      history: s.history.slice(0, -1),
      future: [{ label: h.label, project: s.project }, ...s.future],
      selection: [],
      face: null,
      dirty: true,
      status: "Undo · " + h.label,
    });
    get().recover();
  },
  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const h = s.future[0];
    set({
      project: h.project,
      future: s.future.slice(1),
      history: [...s.history, { label: h.label, project: s.project }],
      selection: [],
      face: null,
      dirty: true,
      status: "Redo · " + h.label,
    });
    get().recover();
  },
  recover: async (showStatus = false) => {
    const project = get().project;
    try {
      await writeRecovery(project);
      if (showStatus && get().project === project)
        set({ saveStatus: "Saved on this device" });
      return true;
    } catch {
      if (showStatus && get().project === project)
        set({ saveStatus: "Recovery unavailable — save project now" });
      return false;
    }
  },
  select: (id, add = false, face = null) => {
    const s = get();
    let ids = id ? [id] : [];
    const o = s.project.objects.find((o) => o.id === id);
    if ((o?.groupId || o?.furnitureId) && s.selectionMode === "group")
      ids = groupObjects(s.project, o.furnitureId || o.groupId).map(
        (v) => v.id,
      );
    set({
      selection: add
        ? [
            ...new Set([
              ...s.selection.filter((v) => !ids.includes(v)),
              ...ids.filter((v) => !s.selection.includes(v)),
            ]),
          ]
        : ids,
      face,
      tab: "properties",
    });
  },
  add: (items, label = "Create object") => {
    const objects = Array.isArray(items) ? items : items.objects;
    const ok = get().commit(label, (p) => {
      p.objects.push(...objects);
      if (items.groups) p.groups.push(...items.groups);
      if (items.materials?.length)
        p.materials = [...(p.materials || []), ...items.materials];
      if (items.layers?.length) p.layers.push(...items.layers);
      if (items.roomInfo) p.roomInfo = items.roomInfo;
    });
    if (ok)
      set({ selection: objects.map((o) => o.id), tool: "select", face: null });
    return ok;
  },
  update: (id, patch, label = "Edit properties") =>
    get().commit(label, (p) => {
      const o = p.objects.find((o) => o.id === id);
      if (o && !o.locked) Object.assign(o, patch);
    }),
  remove: () => {
    const ids = get().selection;
    get().commit("Delete selection", (p) => {
      const removed = new Set(
        p.objects
          .filter((o) => ids.includes(o.id) && !o.locked)
          .map((o) => o.id),
      );
      p.objects = p.objects.filter(
        (o) => !removed.has(o.id) && !removed.has(o.hostId),
      );
      pruneGroups(p);
    });
    set({ selection: [], face: null });
  },
  duplicate: (offset = [100, 0, 0], count = 1) => {
    const s = get();
    const source = s.project.objects.filter((o) => s.selection.includes(o.id));
    if (!source.length) return;
    const copies = [],
      groups = [];
    const sourceProject = selectionProject(
      s.project,
      source.map((o) => o.id),
    );
    for (let i = 1; i <= Math.min(100, count); i++) {
      const items = translateAssembly(
        instantiateProject(sourceProject, s.project),
        offset.map((n) => n * i),
      );
      items.groups.forEach((g) => {
        g.name += " copy";
        if (g.furnitureSpec) g.furnitureSpec.name = g.name;
      });
      items.objects.forEach((o) => (o.name += " copy"));
      copies.push(...items.objects);
      groups.push(...items.groups);
    }
    get().add({ objects: copies, groups }, "Duplicate selection");
  },
  group: () => {
    const ids = get().selection;
    if (ids.length < 2) {
      get().notify("Select two or more objects with Shift to group");
      return;
    }
    const g = {
      id: uid(),
      name: "Assembly " + (get().project.groups.length + 1),
    };
    get().commit("Group objects", (p) => {
      p.groups.push(g);
      p.objects.forEach((o) => {
        if (ids.includes(o.id)) o.groupId = g.id;
      });
      pruneGroups(p);
    });
  },
  ungroup: () => {
    const ids = get().selection;
    get().commit("Ungroup objects", (p) => {
      p.objects.forEach((o) => {
        if (ids.includes(o.id)) o.groupId = null;
      });
      pruneGroups(p);
    });
  },
  load: (project) => {
    try {
      validateProject(project);
      get().recover();
      set({
        project: clone(project),
        selection: [],
        face: null,
        history: [],
        future: [],
        activeViewId: null,
        playingScenes: false,
        contextMenu: null,
        dirty: false,
        modal: null,
        status: "Opened " + project.name,
        saveStatus: "Local recovery ready",
      });
      get().recover();
      setTimeout(() => get().engine?.fit(), 100);
    } catch (e) {
      get().notify(e.message);
    }
  },
  newProject: (name = "Untitled design") => get().load(blankProject(name)),
  save: async () => {
    const s = get();
    set({ saveStatus: "Saving…" });
    try {
      const r = await fetch("/api/projects/" + s.project.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s.project),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      set({
        saveStatus: "Saved to " + (d.storageLabel || "MongoDB"),
        dirty: get().project !== s.project,
        status: "Project saved",
      });
      get().recover();
      return true;
    } catch (e) {
      set({ saveStatus: "Local recovery only", status: e.message });
      return false;
    }
  },
  checkDb: async () => {
    try {
      const r = await fetch("/api/health");
      const d = await r.json();
      set({ dbStatus: d.database, dbConnected: r.ok && d.ok === true });
    } catch {
      set({ dbStatus: "offline", dbConnected: false });
    }
  },
}));
export function download(data, name, type = "application/json") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
