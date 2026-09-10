import React, { useState } from "react";
import { Dialog } from "./Dialogs.jsx";
import { Numeric } from "./App.jsx";
import { useEditor } from "./store.js";
import {
  motionJoints,
  attachJoint,
  setJointOpen,
  inspectClearance,
  posePart,
  openFurnitureSafely,
} from "../shared/motion.js";
import { bounds } from "../shared/geometry.js";
import { Box3, Vector3 } from "three";

export function MotionDialog({ close }) {
  const s = useEditor(),
    selected = s.project.objects.filter((o) => s.selection.includes(o.id));
  const [tab, setTab] = useState("operate"),
    [message, setMessage] = useState(""),
    [issues, setIssues] = useState(null),
    [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("hinge"),
    [type, setType] = useState("door"),
    [angle, setAngle] = useState(-90),
    [travel, setTravel] = useState(400),
    [axis, setAxis] = useState(2),
    [direction, setDirection] = useState(1),
    [sign, setSign] = useState(-1);
  const [pivot, setPivot] = useState(() => selected[0]?.position || [0, 0, 0]);
  const joints = motionJoints(s.project.objects),
    chosen = joints.filter((j) =>
      j.parts.some((o) => s.selection.includes(o.id)),
    );
  const [all, setAll] = useState(!chosen.length);
  function jointLabel(j) {
    const o = j.parts[0],
      bay = /bay(\d+)/.exec(o.partKey || ""),
      drawer = /drawer(\d+)/.exec(o.partKey || "");
    const side = /doorL/.test(o.partKey || "")
      ? "Left door"
      : /doorR/.test(o.partKey || "")
        ? "Right door"
        : j.name;
    return [
      s.project.groups.find((g) => g.id === o.groupId)?.name,
      bay && "Compartment " + (Number(bay[1]) + 1),
      drawer ? "Drawer " + (Number(drawer[1]) + 1) : side,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  function operate(j, fraction) {
    let report;
    const ok = s.commit("Move " + j.name, (p) => {
      report = setJointOpen(p, j.key, fraction);
      if (
        Math.abs(report.actual - (j.parts[0].mechanism.appliedFraction || 0)) <
        1e-8
      )
        throw Error(
          report.blocked
            ? `${j.name} stays at ${Math.round(report.actual * 100)}%: ${report.obstacle} blocks its path. Clear the door or drawer first.`
            : "Already at this position.",
        );
    });
    setMessage(
      ok
        ? report.blocked
          ? `${j.name} stopped at ${Math.round(report.actual * 100)}%: ${report.obstacle} blocks its path. Open obstructing doors first; retract drawers before closing.`
          : `${j.name}: ${Math.round(report.actual * 100)}% open.`
        : useEditor.getState().status,
    );
  }
  function corner(which) {
    const b = new Box3();
    selected.forEach((o) => b.union(bounds(o)));
    if (b.isEmpty()) return;
    const c = b.getCenter(new Vector3());
    setPivot(
      which === "left"
        ? [b.min.x, b.min.y, b.min.z]
        : which === "right"
          ? [b.max.x, b.min.y, b.min.z]
          : [c.x, b.min.y, b.max.z],
    );
    setAxis(which === "top" ? 0 : 2);
    setAngle(which === "right" ? 90 : -90);
  }
  function assign() {
    const v = [0, 0, 0],
      d = [0, 0, 0];
    v[axis] = 1;
    d[direction] = sign;
    const ok = s.commit("Assign manual joint", (p) =>
      attachJoint(p, s.selection, {
        kind,
        type,
        pivot,
        axis: v,
        direction: d,
        angle,
        travel,
      }),
    );
    setMessage(
      ok
        ? "Joint attached. Selected parts move rigidly together; their current pose is the closed position."
        : useEditor.getState().status,
    );
    if (ok) setTab("operate");
  }
  async function check() {
    setBusy(true);
    setMessage("");
    const snapshot = structuredClone(s.project);
    try {
      const current = await inspectClearance(snapshot.objects);
      const closedObjects = snapshot.objects.map((o) =>
        o.mechanism
          ? {
              ...posePart(o, 0),
              mechanism: { ...o.mechanism, appliedFraction: 0 },
            }
          : o,
      );
      const closed = await inspectClearance(closedObjects);
      snapshot.objects = closedObjects;
      const blocked = [];
      for (const g of snapshot.groups.filter((g) => g.furnitureSpec)) {
        const r = openFurnitureSafely(
          snapshot,
          g.id,
          1,
          g.furnitureSpec.slidingAccess || "right",
        );
        blocked.push(
          ...r.blocked.map((b) => ({
            a: motionJoints(snapshot.objects).find((j) => j.key === b.key)
              ?.parts[0]?.id,
            b: b.obstacleId,
            certainty: "blocked",
            message: `${g.name}: ${b.name} stops at ${Math.round(b.actual * 100)}% against ${b.obstacle}`,
          })),
        );
      }
      for (const j of motionJoints(snapshot.objects).filter(
        (j) => j.parts[0].mechanism.manual && !j.parts[0].furnitureId,
      )) {
        const r = setJointOpen(snapshot, j.key, 1);
        if (r.blocked)
          blocked.push({
            a: j.parts[0].id,
            b: r.obstacleId,
            certainty: "blocked",
            message: `${j.name} stops at ${Math.round(r.actual * 100)}% against ${r.obstacle}`,
          });
      }
      setIssues([
        ...current.map((i) => ({ ...i, phase: "Current pose" })),
        ...closed.map((i) => ({ ...i, phase: "Closed pose" })),
        ...blocked.map((i) => ({ ...i, phase: "Opening sweep" })),
      ]);
      setMessage(
        `Checked ${snapshot.objects.length} parts, current and closed geometry, and generated and manual joint opening paths. ${blocked.length} movement(s) stop at an obstruction.`,
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Hinges, slides & clearance"
      subtitle="Rigid joints, exact panel dimensions and obstruction checks."
      onClose={close}
      wide
    >
      <div className="dialog-content">
        <div className="button-row">
          {[
            ["operate", "Operate joints"],
            ["assign", "Attach to manual parts"],
            ["audit", "Check clearances"],
          ].map(([v, n]) => (
            <button
              className={tab === v ? "primary" : "secondary"}
              key={v}
              onClick={() => setTab(v)}
            >
              {n}
            </button>
          ))}
        </div>
        {tab === "operate" && (
          <>
            <p>
              Open cabinet doors before extending enclosed drawers. A joint
              stops when any moving panel or handle meets an obstruction. Close
              drawers before doors.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => setAll(e.target.checked)}
              />
              Show all project joints
            </label>
            {!(all ? joints : chosen).length && (
              <p>
                Select moving parts or attach a joint to manually drawn boards.
              </p>
            )}
            {(all ? joints : chosen).map((j) => (
              <div className="furniture-section" key={j.key}>
                <strong>
                  {jointLabel(j)} · {j.parts.length} rigid parts
                </strong>
                <div className="button-row">
                  <button className="secondary" onClick={() => operate(j, 1)}>
                    Open
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      s.commit("Remove joint", (p) =>
                        p.objects
                          .filter((o) => j.parts.some((v) => v.id === o.id))
                          .forEach((o) => delete o.mechanism),
                      );
                      setMessage(
                        "Joint removed; geometry stays in its current position. Undo restores it.",
                      );
                    }}
                  >
                    Remove joint
                  </button>
                  <button className="secondary" onClick={() => operate(j, 0)}>
                    Close
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      s.set({ selection: j.parts.map((o) => o.id) });
                      s.engine?.fit(true);
                    }}
                  >
                    Select moving parts
                  </button>
                </div>
                <label className="field-label">
                  Opening
                  <input
                    aria-label={"Opening " + jointLabel(j)}
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={j.parts[0].mechanism.appliedFraction || 0}
                    onChange={(e) => operate(j, Number(e.target.value))}
                  />
                </label>
              </div>
            ))}
          </>
        )}
        {tab === "assign" && (
          <>
            <p>
              Select only the moving boards, drawer box, front and handle.
              Stationary carcass panels remain unselected. Draw them using
              Board, Rectangle + Push/Pull, Circle, Offset and machining tools;
              this joint works on the same editable geometry as presets.
            </p>
            <strong>{selected.length} selected parts</strong>
            <div className="form-grid">
              <label>
                Joint
                <select
                  aria-label="Joint type"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="hinge">Revolute hinge</option>
                  <option value="slide">Linear slide</option>
                </select>
              </label>
              <label>
                Moving assembly
                <select
                  aria-label="Moving assembly"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="door">Door / moving part</option>
                  <option value="drawer">Drawer</option>
                </select>
              </label>
              {kind === "hinge" ? (
                <>
                  <label>
                    World hinge axis
                    <select
                      value={axis}
                      onChange={(e) => setAxis(Number(e.target.value))}
                    >
                      {["X", "Y", "Z"].map((n, i) => (
                        <option key={n} value={i}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Numeric
                    label="Opening angle · degrees"
                    value={angle}
                    onChange={setAngle}
                  />
                  {["X", "Y", "Z"].map((a, i) => (
                    <Numeric
                      key={a}
                      label={"Pivot " + a + " · mm"}
                      value={pivot[i]}
                      onChange={(v) =>
                        setPivot((p) => p.map((n, k) => (k === i ? v : n)))
                      }
                    />
                  ))}
                </>
              ) : (
                <>
                  <label>
                    World travel axis
                    <select
                      value={direction}
                      onChange={(e) => setDirection(Number(e.target.value))}
                    >
                      {["X", "Y", "Z"].map((n, i) => (
                        <option key={n} value={i}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Direction
                    <select
                      value={sign}
                      onChange={(e) => setSign(Number(e.target.value))}
                    >
                      <option value={-1}>Negative</option>
                      <option value={1}>Positive</option>
                    </select>
                  </label>
                  <Numeric
                    label="Travel · mm"
                    min={0}
                    value={travel}
                    onChange={setTravel}
                  />
                </>
              )}
            </div>
            {kind === "hinge" && (
              <div className="button-row">
                <button onClick={() => corner("left")}>Front left pivot</button>
                <button onClick={() => corner("right")}>
                  Front right pivot
                </button>
                <button onClick={() => corner("top")}>Front top pivot</button>
              </div>
            )}
            <p className="hint">
              Pivot shortcuts use world bounds. Enter the actual hinge
              coordinates for rotated or shaped parts. Attaching uses the
              current pose as closed.
            </p>
            <button
              className="primary"
              disabled={!selected.length}
              onClick={assign}
            >
              Attach joint to selected parts
            </button>
          </>
        )}
        {tab === "audit" && (
          <>
            <p>
              Check all visible and hidden model parts. Rectangular boards use
              oriented solid bounds; shaped closed solids receive a
              volume-intersection check. Non-solid imported meshes are flagged
              as envelope checks. Mounting hinges, runners and shelf pins are
              reference fittings; handles, legs and feet are included.
            </p>
            <button className="primary" disabled={busy} onClick={check}>
              {busy ? "Checking geometry…" : "Run complete clearance check"}
            </button>
            {issues &&
              (!issues.length ? (
                <p>
                  No intersections or blocked joint movements found in this
                  check.
                </p>
              ) : (
                issues.map((v, i) => (
                  <div className="furniture-section" key={i}>
                    <strong>
                      {v.phase} · {v.certainty}
                    </strong>
                    <p>{v.message}</p>
                    <button
                      onClick={() => {
                        s.set({ selection: [v.a, v.b].filter(Boolean) });
                        s.engine?.fit(true);
                        close();
                      }}
                    >
                      Inspect these parts
                    </button>
                  </div>
                ))
              ))}
            <p className="hint">
              This checks geometry and constrained movement. It does not
              calculate strength, deflection, hinge load capacity or
              gravity-driven dynamics.
            </p>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </div>
      <footer className="dialog-footer">
        <button onClick={close}>Done</button>
      </footer>
    </Dialog>
  );
}
