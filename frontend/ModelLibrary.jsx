import React, { useState, useEffect } from "react";
import { Box, ArrowUpRight } from "lucide-react";
import { Dialog } from "./Dialogs.jsx";
import { useEditor } from "./store.js";
import { instantiateProject } from "../shared/project-import.js";
import { placeBeside } from "../shared/motion.js";
export function ModelLibraryDialog({ close }) {
  const s = useEditor(),
    [models, setModels] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/models/catalog.json")
      .then((r) => {
        if (!r.ok) throw Error("The model library is unavailable");
        return r.json();
      })
      .then((data) => {
        if (alive) setModels(data.filter((m) => m.file));
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function add(model) {
    setBusy(model.file);
    setError("");
    try {
      const response = await fetch("/models/" + encodeURIComponent(model.file));
      if (!response.ok) throw Error("The model could not be loaded");
      const source = await response.json(),
        state = useEditor.getState();
      const copy = instantiateProject(source, state.project);
      placeBeside(copy, state.project.objects);
      state.add(copy, "Insert " + model.name);
      state.engine?.fit(true);
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Dialog
      title="3D model library"
      subtitle="Your SketchUp collection, ready to place and edit."
      onClose={close}
      wide
    >
      <div className="dialog-content">
        <div className="solid-tool-grid">
          {models.map((m) => (
            <button key={m.file} onClick={() => add(m)} disabled={!!busy}>
              <Box size={24} />
              <strong>{m.name.replace(/_\d+$/, "")}</strong>
              <span>
                {busy === m.file
                  ? "Loading model…"
                  : m.objects +
                    " editable parts · " +
                    m.triangles.toLocaleString() +
                    " triangles"}
              </span>
            </button>
          ))}
        </div>
        {!models.length && !error && <p>Loading models…</p>}
        {error && <p role="alert">{error}</p>}
        <a
          href="https://3dwarehouse.sketchup.com/collection/3ea90f0b-e9e3-4037-886e-b9a311a0b0d2/3D-Models"
          target="_blank"
          rel="noreferrer"
        >
          Browse the original 3D Warehouse collection <ArrowUpRight size={14} />
        </a>
      </div>
    </Dialog>
  );
}
