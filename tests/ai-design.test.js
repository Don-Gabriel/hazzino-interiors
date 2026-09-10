import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateDesign } from "../shared/ai-design.js";
import { hospitalPlan, generateHospital } from "../shared/hospital.js";
import { validateProject } from "../shared/model.js";

const env = {
  GEMINI_API_KEY_1: "test-only",
  GEMINI_FREE_TIER_CONFIRMED: "true",
};
const reply = (plan, finishReason = "STOP") =>
  Response.json({
    candidates: [
      { finishReason, content: { parts: [{ text: JSON.stringify(plan) }] } },
    ],
    usageMetadata: {
      promptTokenCount: 200,
      candidatesTokenCount: 80,
      totalTokenCount: 280,
    },
  });
const plan = { ...hospitalPlan({}), action: "hospital" };

test("Design Studio generates validated editable room geometry and records actual usage", async () => {
  let reserved = 0,
    recorded,
    request;
  const result = await generateDesign(
    env,
    { prompt: "Create a 6m by 5m room with two beds" },
    {
      reserve: async () => reserved++,
      record: async (u) => (recorded = u),
      fetcher: async (_, options) => {
        request = JSON.parse(options.body);
        return reply(plan);
      },
    },
  );
  assert.equal(reserved, 1);
  assert.equal(recorded.totalTokens, 280);
  assert.equal(result.plan.beds, 2);
  assert.ok(result.project.objects.length > 20);
  assert.equal(validateProject(result.project).roomInfo.width, 6000);
  assert.deepEqual(
    request.generationConfig.responseSchema.properties.action.enum,
    ["hospital", "wardrobe"],
  );
  assert.match(request.systemInstruction.parts[0].text, /patient room/);
});

test("Design Studio keeps current room intent for what-if requests", async () => {
  let request;
  const result = await generateDesign(
    env,
    {
      prompt: "Fit four beds",
      current: { ...plan, privateNotes: "not-for-provider" },
    },
    {
      reserve: async () => {},
      record: async () => {},
      fetcher: async (_, o) => {
        request = JSON.parse(o.body);
        return reply({ ...plan, beds: 4 });
      },
    },
  );
  assert.match(request.contents[0].parts[0].text, /currentIntent/);
  assert.doesNotMatch(request.contents[0].parts[0].text, /not-for-provider/);
  assert.equal(result.project.hospitalIntent.beds, 4);
});

test("Wardrobe placement preserves existing objects and input project", async () => {
  const project = generateHospital({});
  const original = structuredClone(project);
  const result = await generateDesign(
    env,
    { prompt: "Add a wardrobe in the right corner", project },
    {
      reserve: async () => {},
      record: async () => {},
      fetcher: async () =>
        reply({
          ...plan,
          action: "wardrobe",
          width: 1200,
          depth: 600,
          height: 2100,
          placement: "back-right",
        }),
    },
  );
  assert.deepEqual(project, original);
  assert.ok(result.project.objects.length > original.objects.length);
  validateProject(result.project);
});

test("Incomplete plans record their tokens but cannot change a design", async () => {
  let recorded;
  await assert.rejects(
    generateDesign(
      env,
      { prompt: "Create a room" },
      {
        reserve: async () => {},
        record: async (u) => (recorded = u),
        fetcher: async () => reply(plan, "MAX_TOKENS"),
      },
    ),
    /incomplete/,
  );
  assert.equal(recorded.totalTokens, 280);
});

test("Both cloud AI dialogs route to one budget and enforce its cap", async () => {
  const base = new URL("../cloudflare/worker.js", import.meta.url);
  let source = await readFile(base, "utf8");
  const mock =
    "data:text/javascript," +
    encodeURIComponent(
      "export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }",
    );
  source = source
    .replace('"cloudflare:workers"', JSON.stringify(mock))
    .replaceAll(
      /from "(\.\.[^"]+)"/g,
      (_, path) => `from ${JSON.stringify(new URL(path, base).href)}`,
    );
  const { default: worker, WorkspaceStore } = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
  const records = new Map();
  const ctx = {
    storage: {
      sql: { exec: () => ({ toArray: () => [] }) },
      get: async (k) => records.get(k),
      put: async (k, v) => records.set(k, structuredClone(v)),
    },
  };
  const store = new WorkspaceStore(ctx, env);
  const destinations = [];
  const bindings = {
    ...env,
    WORKSPACES: {
      idFromName: (id) => {
        destinations.push(id);
        return id;
      },
      get: () => store,
    },
  };
  const request = (path, body) =>
    worker.fetch(
      new Request(
        "https://demo.example" + path,
        body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {},
      ),
      bindings,
    );
  for (const path of ["/api/ai/status", "/api/furniture-ai/status"]) {
    const status = await (await request(path)).json();
    assert.equal(status.configured, true);
    assert.equal(status.enabled, true);
  }
  assert.deepEqual([...new Set(destinations)], ["global-furniture-ai-budget"]);
  records.set("geminiUsage", {
    day: new Date().toISOString().slice(0, 10),
    attempts: 10,
    reservedTokens: 60000,
    actualTokens: 3000,
    recent: [],
  });
  for (const path of ["/api/ai/generate", "/api/furniture-ai/generate"]) {
    const result = await request(path, { prompt: "Create a room" });
    assert.equal(result.status, 429);
    assert.match((await result.json()).error, /cap/);
  }
  const r = await request("/api/ai/generate", { prompt: "" });
  assert.equal(r.status, 400);
  assert.deepEqual(await (await request("/api/ai/usage")).json(), []);
});
