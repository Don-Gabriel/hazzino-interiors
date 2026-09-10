import React, { useState, useEffect } from "react";
import { Dialog } from "./Dialogs.jsx";
import { useEditor } from "./store.js";
import {
  defaultFurnitureSpec,
  buildFurniture,
  validateFurnitureSpec,
} from "../shared/furniture.js";
import { placeBeside } from "../shared/motion.js";
export function AiFurniture({ close }) {
  const s = useEditor(),
    [prompt, setPrompt] = useState(""),
    [status, setStatus] = useState(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/furniture-ai/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setError("AI service unavailable"));
  }, []);
  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/furniture-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      const spec = defaultFurnitureSpec(d.plan.type);
      for (const k of [
        "name",
        "width",
        "depth",
        "height",
        "thickness",
        "fronts",
        "frontStyle",
        "material",
        "frontMaterial",
      ])
        if (d.plan[k] != null) spec[k] = d.plan[k];
      if (d.plan.bays?.length)
        spec.bays = d.plan.bays.map((b, i) => ({
          ...defaultFurnitureSpec("cabinet").bays[0],
          ...b,
          hinge: i % 2 ? "right" : "left",
          internalDrawers: b.type === "mixed",
        }));
      if (spec.type === "kitchen")
        spec.modules = spec.modules.map((m) => ({
          ...m,
          width: (m.width * spec.width) / 3000,
        }));
      validateFurnitureSpec(spec);
      const items = buildFurniture(spec);
      setResult({ ...d, spec, parts: items.objects.length });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function add() {
    try {
      const current = useEditor.getState(),
        items = buildFurniture(result.spec);
      placeBeside(items, current.project.objects);
      if (current.add(items, "AI furniture · " + result.spec.name)) {
        close();
        setTimeout(() => current.engine?.fit(true), 50);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Dialog
      title="AI furniture designer"
      subtitle="Describe furniture and dimensions. Review the specification, then add editable boards and hardware."
      onClose={close}
    >
      <div className="dialog-content form-grid">
        <p>
          {status?.configured
            ? `${status.keyCount} key slots configured · ${status.model}`
            : "Waiting for server API keys in .env"}
        </p>
        <textarea
          aria-label="Furniture instructions"
          rows={4}
          maxLength={2000}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Build a 1800 mm wide wardrobe, 2400 high and 600 deep, with hanging space, shelves and internal drawers."
        />
        <button
          className="primary"
          disabled={busy || prompt.trim().length < 3}
          onClick={generate}
        >
          {busy ? "Generating specification…" : "Generate furniture"}
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch("/api/furniture-ai/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              const d = await r.json();
              if (!r.ok) throw Error(d.error);
              setError(
                d.keys
                  .map(
                    (k) =>
                      `Key ${k.slot}: ${k.valid ? "valid" : "unavailable"}; context ${k.inputTokenLimit || "unknown"}, output ${k.outputTokenLimit || "unknown"}`,
                  )
                  .join(" · ") || "No keys configured",
              );
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Verify key access
        </button>
        <p className="hint">
          Demo caps: 2 attempts/minute, 20/day, 60,000 reserved tokens/day,
          3,072 output tokens/request. Five keys share these caps. Free tier
          must be confirmed in Google AI Studio; the app cannot verify billing.
        </p>
        {error && <p role="status">{error}</p>}
        {result && (
          <div>
            <h3>{result.spec.name}</h3>
            <p>
              {result.spec.width} × {result.spec.depth} × {result.spec.height}{" "}
              mm · {result.parts} editable parts
            </p>
            <p>{result.plan.explanation}</p>
            {result.plan.omitted?.length > 0 && (
              <p>Not included: {result.plan.omitted.join("; ")}</p>
            )}
            <p>
              Tokens: {result.usage.inputTokens} input +{" "}
              {result.usage.outputTokens} output · key {result.usage.slot}
            </p>
            <button className="primary" onClick={add}>
              Add furniture to design
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
