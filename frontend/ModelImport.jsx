import React, { useState } from "react";
import { Dialog } from "./Dialogs.jsx";
import { useEditor } from "./store.js";
import { validateProject } from "../shared/model.js";
import { placeBeside } from "../shared/motion.js";
function encodeTexture(image) {
  const factor = Math.min(1, 2048 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * factor));
  canvas.height = Math.max(1, Math.round(image.height * factor));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
export function ModelImportDialog({ close }) {
  const s = useEditor(),
    [file, setFile] = useState(null),
    [scale, setScale] = useState("auto"),
    [up, setUp] = useState("auto"),
    [origin, setOrigin] = useState(true),
    [beside, setBeside] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 100 * 1024 * 1024)
        throw Error("Choose a model under 100 MB");
      const { importModelData } = await import("../shared/model-import.js");
      const ext = file.name.split(".").at(-1),
        data = await file.arrayBuffer();
      const imported = await importModelData(
        ext === "gltf" ? new TextDecoder().decode(data) : data,
        ext,
        {
          name: file.name.replace(/\.[^.]+$/, ""),
          placeAtOrigin: origin,
          textureEncoder: encodeTexture,
          ...(scale === "auto" ? {} : { scale: Number(scale) }),
          ...(up === "auto" ? {} : { up }),
        },
      );
      s.commit("Import " + file.name, (p) => {
        if (beside) placeBeside(imported, p.objects);
        p.objects.push(...imported.objects);
        p.groups.push(...imported.groups);
        p.materials = [...(p.materials || []), ...imported.materials];
        validateProject(p);
      });
      s.set({ selection: imported.objects.map((o) => o.id), face: null });
      s.engine?.fit(true);
      close();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Import 3D model"
      subtitle="Bring model geometry and embedded GLB materials into this design."
      onClose={close}
    >
      <div className="dialog-content form-grid">
        <label>
          Model file
          <input
            type="file"
            accept=".glb,.gltf,.obj,.stl,.ply"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </label>
        <label>
          Source units
          <select value={scale} onChange={(e) => setScale(e.target.value)}>
            {[
              ["auto", "Automatic (glTF metres; others millimetres)"],
              ["1", "Millimetres"],
              ["10", "Centimetres"],
              ["1000", "Metres"],
              ["25.4", "Inches"],
              ["304.8", "Feet"],
            ].map(([v, n]) => (
              <option value={v} key={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Up direction
          <select value={up} onChange={(e) => setUp(e.target.value)}>
            <option value="auto">Automatic</option>
            <option value="Z">Z up</option>
            <option value="Y">Y up</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={origin}
            onChange={(e) => setOrigin(e.target.checked)}
          />
          Centre on the origin and place on the ground
        </label>
        <p className="hint">
          <label className="check-row">
            <input
              type="checkbox"
              checked={beside}
              onChange={(e) => setBeside(e.target.checked)}
            />
            Place beside existing furniture with 150 mm clearance
          </label>
          Use GLB with embedded textures for material transfer. OBJ, STL and PLY
          import mesh geometry. SKP files need conversion with the SketchUp
          exporter.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
      <footer className="dialog-footer">
        <button onClick={close}>Cancel</button>
        <button className="primary" disabled={!file || busy} onClick={run}>
          {busy ? "Importing…" : "Import model"}
        </button>
      </footer>
    </Dialog>
  );
}
