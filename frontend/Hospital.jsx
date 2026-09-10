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
  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("AI service unavailable. Check the local server."));
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((v) => setUsage(Array.isArray(v) ? v : []))
      .catch(() => {});
  }, []);
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
      setUsage((v) => [data.usage, ...v]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function apply(project) {
    s.commit("Generate hospital layout", (p) => {
      p.objects = project.objects;
      p.groups = project.groups;
      p.layers = project.layers;
      p.roomInfo = project.roomInfo;
      p.hospitalIntent = project.hospitalIntent;
      p.name = project.name;
    });
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
              `${config.configured ? "Gemini key configured" : "Gemini key needed in .env"} · ${config.model} · ${config.tier} tier (configured)`
            : "Checking Gemini connection…"}
        </p>
        <label>
          Describe your design — e.g. Create a wardrobe 1200 mm wide, 600 mm
          deep, 2100 mm high in the right corner
          <textarea
            aria-label="Hospital design command"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={4000}
            rows={3}
          />
        </label>
        <div className="hospital-actions">
          <button className="primary" disabled={busy} onClick={generate}>
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
              {result.plan.width / 1000} × {result.plan.depth / 1000} m ·{" "}
              {result.plan.beds} beds · {result.plan.corridor} mm circulation
              strip
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
                output tokens · paid-rate estimate $
                {result.usage.estimatedPaidUsd?.toFixed(6) ?? "unavailable"}
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
            {usage.length} recent successful requests ·{" "}
            {usage.reduce((n, v) => n + v.totalTokens, 0)} tokens. Manual
            modeling and local templates use zero Gemini tokens. Cost is a
            paid-rate projection, not an invoice.
          </p>
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
