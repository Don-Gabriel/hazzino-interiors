import React, { useState } from "react";
import { Scissors } from "lucide-react";
import { Dialog } from "./Dialogs.jsx";
import { Numeric } from "./App.jsx";
import { useEditor } from "./store.js";
import { machinePanel } from "../shared/machining.js";
export function MachiningDialog({ close }) {
  const s = useEditor(),
    part =
      s.selection.length === 1
        ? s.project.objects.find((o) => o.id === s.selection[0])
        : null;
  const [spec, setSpec] = useState({
      type: "drill",
      axis:
        s.face && part?.kind === "box"
          ? Math.floor(s.face.index / 2)
          : (part?.fabrication?.thicknessAxis ??
            (part ? part.size.indexOf(Math.min(...part.size)) : 2)),
      side: s.face ? (s.face.index % 2 === 0 ? 1 : -1) : -1,
      u: 37,
      v: 64,
      diameter: 5,
      countU: 1,
      countV: 8,
      spacingU: 32,
      spacingV: 32,
      depth: 12,
      through: false,
      width: 100,
      height: 100,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (k, v) => setSpec((s) => ({ ...s, [k]: v })),
    plane = [0, 1, 2].filter((i) => i !== spec.axis);
  async function cut() {
    setBusy(true);
    setError("");
    try {
      const before = useEditor.getState().project,
        result = await machinePanel(part, spec);
      if (useEditor.getState().project !== before)
        throw Error(
          "The project changed. Reopen this operation and try again.",
        );
      const ok = s.commit(
        spec.type === "drill" ? "Drill panel holes" : "Cut panel pocket",
        (p) => {
          p.objects = p.objects.filter((o) => o.hostId !== part.id);
          p.objects[p.objects.findIndex((o) => o.id === part.id)] = result;
        },
      );
      if (!ok) throw Error(useEditor.getState().status);
      s.set({ face: null });
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Panel machining"
      subtitle={
        part
          ? part.name + " · real holes, pockets and grooves"
          : "Select one panel in Object or Face selection mode."
      }
      onClose={close}
    >
      <div className="dialog-content">
        {part ? (
          <>
            <div className="segmented">
              <button
                className={spec.type === "drill" ? "active" : ""}
                onClick={() => set("type", "drill")}
              >
                Drill hole pattern
              </button>
              <button
                className={spec.type === "pocket" ? "active" : ""}
                onClick={() => set("type", "pocket")}
              >
                Pocket / dado / rebate
              </button>
            </div>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() =>
                  setSpec({
                    ...spec,
                    type: "drill",
                    diameter: 5,
                    countU: 1,
                    countV: 8,
                    spacingV: 32,
                    u: 37,
                    v: 64,
                    depth: Math.min(12, part.size[spec.axis] - 1),
                    through: false,
                  })
                }
              >
                Shelf pins · 32 mm
              </button>
              <button
                className="secondary"
                onClick={() =>
                  setSpec({
                    ...spec,
                    type: "drill",
                    diameter: 35,
                    countU: 1,
                    countV: 2,
                    spacingV: Math.max(40, part.size[plane[1]] - 200),
                    u: 22.5,
                    v: 100,
                    depth: Math.min(12, part.size[spec.axis] - 1),
                    through: false,
                  })
                }
              >
                35 mm hinge cups
              </button>
            </div>
            <div className="form-grid">
              <label className="field-label">
                Drilling / pocket axis
                <select
                  value={spec.axis}
                  onChange={(e) => set("axis", Number(e.target.value))}
                >
                  {["X", "Y", "Z"].map((a, i) => (
                    <option value={i} key={a}>
                      {a} · {part.size[i]} mm
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Face side
                <select
                  value={spec.side}
                  onChange={(e) => set("side", Number(e.target.value))}
                >
                  <option value={-1}>Negative face</option>
                  <option value={1}>Positive face</option>
                </select>
              </label>
              <Numeric
                label={"From minimum " + "XYZ"[plane[0]] + " · mm"}
                value={spec.u}
                min={0}
                onChange={(v) => set("u", v)}
              />
              <Numeric
                label={"From minimum " + "XYZ"[plane[1]] + " · mm"}
                value={spec.v}
                min={0}
                onChange={(v) => set("v", v)}
              />
              {(spec.type === "drill"
                ? [
                    ["diameter", "Hole diameter"],
                    ["countU", "Columns"],
                    ["countV", "Rows"],
                    ["spacingU", "Column spacing"],
                    ["spacingV", "Row spacing"],
                  ]
                : [
                    ["width", "Pocket width"],
                    ["height", "Pocket height"],
                  ]
              ).map(([k, label]) => (
                <Numeric
                  key={k}
                  label={label + (k.startsWith("count") ? "" : " · mm")}
                  value={spec[k]}
                  min={1}
                  onChange={(v) => set(k, v)}
                />
              ))}
              {!spec.through && (
                <Numeric
                  label="Cut depth · mm"
                  value={spec.depth}
                  min={0.1}
                  onChange={(v) => set("depth", v)}
                />
              )}
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={spec.through}
                onChange={(e) => set("through", e.target.checked)}
              />{" "}
              Cut through the panel
            </label>
            <p className="hint">
              Hole offsets locate the centre of the first hole. Pocket offsets
              locate its lower corner. A pocket at an edge creates a rebate; a
              narrow full-width pocket creates a dado. Measurements use the
              panel's local axes.
            </p>
            {part.machining?.length > 0 && (
              <p className="hint">
                {part.machining.length} machining operations already applied.
                Undo removes the latest operation.
              </p>
            )}
          </>
        ) : (
          <p>
            Choose Object selection mode, select a board, then reopen Panel
            machining.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <button className="secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={!part || busy || part.locked}
          onClick={cut}
        >
          <Scissors size={15} />
          {busy ? "Cutting geometry…" : "Apply machining"}
        </button>
      </div>
    </Dialog>
  );
}
