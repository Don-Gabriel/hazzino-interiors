import React, { useEffect, useState } from "react";
import { Dialog } from "./Dialogs.jsx";
import { useEditor, download } from "./store.js";
import { generateHospital, validateHospital } from "../shared/hospital.js";

export function Hospital({ close }) {
  const s = useEditor(),
    [prompt, setPrompt] = useState(
      "Create a 6m by 5m patient room with two beds, bedside cabinets, IV stands and a 1.2m central pathway.",
    ),
    [config, setConfig] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [usage, setUsage] = useState([]);
  function refreshUsage() {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() =>
        setError(
          "AI service unavailable. Check your connection and try again.",
        ),
      );
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((v) => setUsage(Array.isArray(v) ? v : []))
      .catch(() => {});
  }
  useEffect(refreshUsage, []);
  const report = validateHospital(s.project);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          current: s.project.hospitalIntent,
          project: s.project,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refreshUsage();
    }
  }
  function apply(project) {
    const applied = s.commit("Apply AI design", (p) => {
      p.objects = project.objects;
      p.groups = project.groups;
      p.layers = project.layers;
      p.roomInfo = project.roomInfo;
      p.hospitalIntent = project.hospitalIntent;
      p.name = project.name;
    });
    if (applied === false) {
      setError(
        "The generated design could not be applied. Check its dimensions.",
      );
      return;
    }
    s.set({ selection: [], modal: null });
    setTimeout(() => useEditor.getState().engine?.fit(), 100);
  }
  return (
    <Dialog
      title="AI Design Studio"
      subtitle="Describe a room or wardrobe, including dimensions and placement."
      onClose={() => !busy && close()}
      wide
    >
      <div className="hospital-panel">
        <p className="ai-connection">
          {config
            ? config.message ||
              `${config.configured ? "Gemini keys configured" : "Gemini keys not configured"} · ${config.model}${config.keyCount ? ` · ${config.keyCount} key slots` : ""}${config.enabled === false ? " · Free-tier confirmation required" : ""}`
            : "Checking Gemini connection…"}
        </p>
        <label>
          Describe your design — e.g. Create a wardrobe 1200 mm wide, 600 mm
          deep, 2100 mm high in the right corner
          <textarea
            aria-label="Hospital design command"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={config?.limits?.promptCharacters || 2000}
            rows={3}
          />
        </label>
        <div className="hospital-actions">
          <button
            className="primary"
            disabled={busy || !config?.configured || config?.enabled === false}
            onClick={generate}
          >
            {busy ? "Gemini is designing…" : "Generate with Gemini"}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              setPrompt(
                "Use the current room dimensions but fit four beds. Explain any space constraints.",
              )
            }
          >
            What if: four beds?
          </button>
          <button
            disabled={busy}
            onClick={() =>
              setResult({
                project: generateHospital({}),
                plan: generateHospital({}).hospitalIntent,
                validation: validateHospital(generateHospital({})),
                manual: true,
              })
            }
          >
            Preview local 2-bed template
          </button>
        </div>
        {error && (
          <p role="alert" className="ai-error">
            {error}
          </p>
        )}
        {result && (
          <div className="ai-result">
            <h3>
              {result.manual ? "Local template" : "Gemini design"} ·{" "}
              {result.plan.name}
            </h3>
            <p>
              {result.plan.action === "wardrobe" ? (
                `${result.plan.width} × ${result.plan.depth} × ${result.plan.height} mm · ${result.plan.placement || "back-right"}`
              ) : (
                <>
                  {result.plan.width / 1000} × {result.plan.depth / 1000} m ·{" "}
                  {result.plan.beds} beds · {result.plan.corridor} mm
                  circulation strip
                </>
              )}
            </p>
            <p>{result.plan.explanation}</p>
            <p>{result.validation.summary}</p>
            {result.validation.issues.map((v, i) => (
              <p key={i} className="ai-error">
                {v}
              </p>
            ))}
            {result.usage && (
              <p>
                {result.usage.inputTokens} input + {result.usage.outputTokens}{" "}
                output tokens · {result.usage.totalTokens} total
                {result.usage.slot ? ` · key ${result.usage.slot}` : ""}
              </p>
            )}
            <button className="primary" onClick={() => apply(result.project)}>
              Apply layout to current project (undoable)
            </button>
          </div>
        )}
        <div className="ai-result">
          <h3>Current layout checks</h3>
          <p>{report.summary}</p>
          {report.issues.map((v, i) => (
            <p key={i} className="ai-error">
              {v}
            </p>
          ))}
          <p>
            Checks use assembly bounding boxes, room boundaries, floor/ceiling
            and a configurable central strip. Planning aid; not a hospital-code
            certification or a complete accessible-route test.
          </p>
          {s.project.hospitalIntent && (
            <div className="hospital-actions">
              <button
                onClick={() =>
                  apply(generateHospital(s.project.hospitalIntent))
                }
              >
                Reflow current layout
              </button>
              <button
                onClick={() =>
                  download(
                    JSON.stringify(
                      { intent: s.project.hospitalIntent, ...report },
                      null,
                      2,
                    ),
                    "hospital-planning-report.json",
                    "application/json",
                  )
                }
              >
                Download validation report
              </button>
            </div>
          )}
        </div>
        <div className="ai-result">
          <h3>AI usage ledger</h3>
          <p>
            {usage.length} recent provider responses with usage ·{" "}
            {usage.reduce((n, v) => n + v.totalTokens, 0)} tokens. Manual
            modeling and local templates use zero Gemini tokens. Usage includes
            responses rejected as incomplete or invalid.
          </p>
          {config?.limits && (
            <p>
              Shared daily budget: {config.usage?.actualTokens || 0} reported
              tokens; {config.usage?.reservedTokens || 0} /{" "}
              {config.limits.tokensPerDay} reserved tokens;{" "}
              {config.usage?.attempts || 0} attempts. Each attempt reserves{" "}
              {config.limits.reservationTokens} tokens. Both AI dialogs share
              this budget. Billing status is owner-confirmed, not verified by
              the API.
            </p>
          )}
          <button
            onClick={() =>
              download(
                JSON.stringify(usage, null, 2),
                "ai-token-usage.json",
                "application/json",
              )
            }
          >
            Download token ledger
          </button>
        </div>
      </div>
    </Dialog>
  );
}
