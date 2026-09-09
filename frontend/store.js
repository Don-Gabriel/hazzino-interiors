import { create } from "zustand";
import {
  blankProject,
  demoProject,
  clone,
  uid,
  validateProject,
} from "../shared/model.js";
const RECOVERY = "hazzino-recovery-v1";
function writeRecovery(p) {
  const data = JSON.stringify(p);
  localStorage.setItem(RECOVERY, data);
  localStorage.setItem("hazzino-project-" + p.id, data);
  let index = [];
  try {
    index = JSON.parse(localStorage.getItem("hazzino-project-index") || "[]");
  } catch {}
  index = index.filter((v) => v.id !== p.id);
  index.unshift({ id: p.id, name: p.name, updatedAt: p.updatedAt });
  localStorage.setItem("hazzino-project-index", JSON.stringify(index));
}
export function localProjects() {
  try {
    return JSON.parse(localStorage.getItem("hazzino-project-index") || "[]");
  } catch {
    return [];
  }
}
export function localProject(id) {
  return validateProject(
    JSON.parse(localStorage.getItem("hazzino-project-" + id)),
  );
}
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
  plane: "XY",
  snapEnabled: true,
  gridVisible: true,
  edges: true,
  shadows: true,
  xray: false,
  section: false,
  sectionHeight: 1500,
  axis: null,
  selectionMode: "object",
  history: [],
  future: [],
  status: "Ready to create",
  saveStatus: "Local recovery ready",
  dbStatus: "connecting",
  modal: null,
  tab: "properties",
  leftTab: "model",
  cursor: null,
  engine: null,
  dirty: false,
  set: (v) => set(v),
  notify: (status) => set({ status }),
  commit: (label, mutate) => {
    const s = get(),
      p = clone(s.project);
    try {
      mutate(p);
      p.updatedAt = new Date().toISOString();
      validateProject(p);
      set({
        project: p,
        history: [...s.history.slice(-79), { label, project: s.project }],
        future: [],
        dirty: true,
        status: label,
      });
      try {
        writeRecovery(p);
        set({ saveStatus: "Saved on this device" });
      } catch {
        set({ saveStatus: "Browser storage full — save project now" });
      }
    } catch (e) {
      set({ status: e.message });
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
  recover: () => {
    try {
      writeRecovery(get().project);
    } catch {}
  },
  select: (id, add = false, face = null) => {
    const s = get();
    let ids = id ? [id] : [];
    const o = s.project.objects.find((o) => o.id === id);
    if (o?.groupId && s.selectionMode === "group")
      ids = s.project.objects
        .filter((v) => v.groupId === o.groupId)
        .map((v) => v.id);
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
    get().commit(label, (p) => {
      p.objects.push(...objects);
      if (items.groups) p.groups.push(...items.groups);
      if (items.roomInfo) p.roomInfo = items.roomInfo;
    });
    set({ selection: objects.map((o) => o.id), tool: "select", face: null });
  },
  update: (id, patch, label = "Edit properties") =>
    get().commit(label, (p) => {
      const o = p.objects.find((o) => o.id === id);
      if (o && !o.locked) Object.assign(o, patch);
    }),
  remove: () => {
    const ids = get().selection;
    get().commit("Delete selection", (p) => {
      p.objects = p.objects.filter((o) => !ids.includes(o.id) || o.locked);
      p.groups = p.groups.filter((g) =>
        p.objects.some((o) => o.groupId === g.id),
      );
    });
    set({ selection: [], face: null });
  },
  duplicate: (offset = [100, 0, 0], count = 1) => {
    const s = get();
    const source = s.project.objects.filter((o) => s.selection.includes(o.id));
    if (!source.length) return;
    const copies = [],
      groups = [];
    for (let i = 1; i <= Math.min(100, count); i++) {
      const gm = new Map();
      for (const o of source) {
        if (o.groupId && !gm.has(o.groupId)) {
          const id = uid();
          gm.set(o.groupId, id);
          groups.push({
            id,
            name:
              (s.project.groups.find((g) => g.id === o.groupId)?.name ||
                "Group") + " copy",
          });
        }
        copies.push({
          ...clone(o),
          id: uid(),
          name: o.name + " copy",
          groupId: gm.get(o.groupId) || null,
          position: o.position.map((n, a) => n + offset[a] * i),
        });
      }
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
      p.groups = p.groups.filter((g) =>
        p.objects.some((o) => o.groupId === g.id),
      );
    });
  },
  ungroup: () => {
    const ids = get().selection;
    get().commit("Ungroup objects", (p) => {
      p.objects.forEach((o) => {
        if (ids.includes(o.id)) o.groupId = null;
      });
      p.groups = p.groups.filter((g) =>
        p.objects.some((o) => o.groupId === g.id),
      );
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
        dirty: false,
        modal: null,
        status: "Opened " + project.name,
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
        saveStatus: "Saved to MongoDB",
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
      set({ dbStatus: d.database });
    } catch {
      set({ dbStatus: "offline" });
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
