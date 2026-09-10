import React, { useState } from "react";
import { Box, X } from "lucide-react";
import { parseDistance } from "../shared/measurements.js";
import { useEditor } from "./store.js";
import { Dialog } from "./Dialogs.jsx";
export function OffsetIcon({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 4h18v16H3Z M8 9h8v6H8Z M3 4l5 5 M3 8V4h4" />
    </svg>
  );
}
export const SOLID_ACTIONS = [
  [
    "union",
    "Union",
    "Combine selected solids and remove their overlapping internal faces.",
  ],
  [
    "subtract",
    "Subtract",
    "Cut every following solid out of the first selected solid.",
  ],
  [
    "intersect",
    "Intersect",
    "Keep only the volume shared by all selected solids.",
  ],
  [
    "trim",
    "Trim",
    "Cut the first selected solid and retain the cutting objects.",
  ],
  [
    "split",
    "Split",
    "Separate two solids into their shared volume and two remainders.",
  ],
  ["outer-shell", "Outer shell", "Join selected solids into one result."],
];
export function SolidToolsDialog({ close }) {
  const s = useEditor(),
    objects = s.selection
      .map((id) => s.project.objects.find((o) => o.id === id))
      .filter(Boolean);
  return (
    <Dialog
      title="Solid tools"
      subtitle="Select solids in order: the first object is the target for Subtract and Trim."
      onClose={close}
      wide
    >
      <div className="dialog-content">
        <div className="solid-selection">
          {objects.map((o, i) => (
            <div key={o.id}>
              <b>{i + 1}</b> {o.name}{" "}
              <small>
                {o.isFace ? "2D face" : o.kind}
                {o.locked ? " · locked" : ""}
              </small>
            </div>
          ))}
        </div>
        {objects.length < 2 && (
          <p>Select two or more solids with Shift or from the Outliner.</p>
        )}
        <div className="solid-tool-grid">
          {SOLID_ACTIONS.map(([id, label, description]) => (
            <button
              key={id}
              disabled={
                objects.length < 2 ||
                objects.some(
                  (o) =>
                    o.isFace ||
                    o.locked ||
                    ["line", "dimension"].includes(o.kind),
                ) ||
                (id === "split" && objects.length !== 2)
              }
              onClick={() => s.engine?.solidOperation(id)}
            >
              <Box size={20} />
              <strong>{label}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
        <p role="status" className="hint">
          {s.status}
        </p>
      </div>
    </Dialog>
  );
}
export function FollowMeIcon({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      {...props}
    >
      <path d="M3 18V9a5 5 0 0 1 5-5h9m-4-3 4 3-4 3M3 18l5-3 5 3-5 3Z M13 18V9" />
    </svg>
  );
}
export function FollowMeDialog({ close }) {
  const s = useEditor(),
    faces = s.project.objects.filter((o) => o.isFace && !o.locked),
    curves = s.project.objects.filter((o) => o.kind === "line" && !o.locked);
  const [faceId, setFaceId] = useState(
    faces.find((o) => s.selection.includes(o.id))?.id || faces[0]?.id || "",
  );
  const [paths, setPaths] = useState(
    curves.filter((o) => s.selection.includes(o.id)).map((o) => o.id),
  );
  const [align, setAlign] = useState(true),
    [keepPath, setKeepPath] = useState(true),
    [busy, setBusy] = useState(false);
  async function apply() {
    setBusy(true);
    try {
      const { initKernel } = await import("../shared/solid-kernel.js");
      await initKernel();
      const { sweepProfile } = await import("../shared/sweep.js");
      const result = sweepProfile(
        faces.find((o) => o.id === faceId),
        curves.filter((o) => paths.includes(o.id)),
        { align },
      );
      if (!result) throw Error("The sweep produced no solid");
      s.commit("Follow Me", (p) => {
        p.objects = p.objects.filter(
          (o) => o.id !== faceId && (keepPath || !paths.includes(o.id)),
        );
        p.objects.push(result);
      });
      s.set({ selection: [result.id], face: null, tool: "select" });
      close();
    } catch (error) {
      s.notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Follow Me"
      subtitle="Sweep a face along connected edges, arcs or a closed loop."
      onClose={close}
    >
      <div className="dialog-content form-grid">
        <label>
          Profile face
          <select value={faceId} onChange={(e) => setFaceId(e.target.value)}>
            <option value="">Choose a flat face</option>
            {faces.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Path</legend>
          {curves.length ? (
            curves.map((o) => (
              <label className="check-row" key={o.id}>
                <input
                  type="checkbox"
                  checked={paths.includes(o.id)}
                  onChange={(e) =>
                    setPaths(
                      e.target.checked
                        ? [...paths, o.id]
                        : paths.filter((id) => id !== o.id),
                    )
                  }
                />
                {o.name}
              </label>
            ))
          ) : (
            <p>Draw a line, arc or curve first.</p>
          )}
        </fieldset>
        <label className="check-row">
          <input
            type="checkbox"
            checked={align}
            onChange={(e) => setAlign(e.target.checked)}
          />
          Align the profile centre to the path start
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={keepPath}
            onChange={(e) => setKeepPath(e.target.checked)}
          />
          Keep the path
        </label>
        <p role="status">{s.status}</p>
      </div>
      <footer className="dialog-footer">
        <button onClick={close}>Cancel</button>
        <button
          className="primary"
          disabled={busy || !faceId || !paths.length}
          onClick={apply}
        >
          {busy ? "Sweeping…" : "Create sweep"}
        </button>
      </footer>
    </Dialog>
  );
}
export function ModellingOptions() {
  const s = useEditor(),
    [distance, setDistance] = useState("100");
  if (!["pushpull", "offset"].includes(s.tool)) return null;
  const name = s.tool === "offset" ? "Offset" : "Push / Pull";
  function apply(event) {
    event?.preventDefault();
    try {
      const value = parseDistance(s.measurementDraft || distance);
      if (Number.isFinite(value) && value !== 0) {
        if (s.operationActive) s.engine?.finishOperation(value);
        else if (s.tool === "pushpull") s.engine?.extrude(value);
        else s.engine?.offsetSelection(value);
      }
    } catch (error) {
      s.notify(error.message);
    }
  }
  return (
    <form className="modelling-options" onSubmit={apply}>
      <div>
        <strong>{name}</strong>
        <span>
          {s.operationActive
            ? "Move the pointer, then click to finish."
            : "Click a face to begin."}{" "}
          Type a distance for precision.
        </span>
      </div>
      <label>
        Distance{" "}
        <input
          aria-label="Tool distance"
          value={s.measurementDraft || distance}
          onChange={(e) => {
            setDistance(e.target.value);
            s.set({ measurementDraft: "" });
          }}
          placeholder="mm"
        />
        <small>mm / units</small>
      </label>
      <button className="primary" type="submit">
        Apply
      </button>
      {s.operationActive && (
        <output>{Number(s.operationValue || 0).toFixed(1)} mm</output>
      )}
      <button
        type="button"
        className="icon-button"
        aria-label="Cancel tool"
        onClick={() => s.set({ tool: "select" })}
      >
        <X size={16} />
      </button>
    </form>
  );
}
