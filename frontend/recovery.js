import { validateProject } from "../shared/model.js";
const RECOVERY = "hazzino-recovery-v1";
let opening;
function database() {
  if (!globalThis.indexedDB)
    return Promise.reject(Error("IndexedDB is unavailable"));
  return (opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("hazzino-projects", 1);
    request.onupgradeneeded = () => {
      for (const name of ["projects", "index"])
        request.result.createObjectStore(name, { keyPath: "id" });
      request.result.createObjectStore("meta");
    };
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        opening = null;
      };
      resolve(request.result);
    };
  }));
}
async function read(store, key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request =
      key == null
        ? db.transaction(store).objectStore(store).getAll()
        : db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function legacyIndex() {
  try {
    return JSON.parse(localStorage.getItem("hazzino-project-index") || "[]");
  } catch {
    return [];
  }
}
export async function writeRecovery(project) {
  const db = await database();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["projects", "index", "meta"], "readwrite");
    tx.objectStore("projects").put(project);
    tx.objectStore("index").put({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
    });
    tx.objectStore("meta").put(project.id, "latest");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || Error("Recovery save was interrupted"));
  });
  // Remove only the migrated duplicate after the IndexedDB transaction commits.
  try {
    localStorage.removeItem("hazzino-project-" + project.id);
    localStorage.setItem(
      RECOVERY,
      JSON.stringify({ storage: "indexeddb", id: project.id }),
    );
  } catch {}
}
export async function localProjects() {
  let modern = [];
  try {
    modern = await read("index");
  } catch {}
  const ids = new Set(modern.map((p) => p.id));
  return [...modern, ...legacyIndex().filter((p) => !ids.has(p.id))].sort(
    (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
  );
}
export async function localProject(id) {
  let project;
  try {
    project = await read("projects", id);
  } catch {}
  if (!project)
    project = JSON.parse(localStorage.getItem("hazzino-project-" + id));
  return validateProject(project);
}
export async function latestRecovery() {
  try {
    const id = await read("meta", "latest");
    if (id) return await localProject(id);
  } catch {}
  try {
    return validateProject(JSON.parse(localStorage.getItem(RECOVERY)));
  } catch {
    return null;
  }
}
