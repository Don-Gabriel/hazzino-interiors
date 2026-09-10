// Server-only Gemini transport. Never import configuration into the browser.
export const DEMO_LIMITS = {
  requestsPerDay: 20,
  requestsPerMinute: 2,
  tokensPerDay: 60000,
  outputTokens: 3072,
  promptCharacters: 2000,
  reservationTokens: 6000,
};
export function geminiConfig(env) {
  const keys = [
    ...new Set(
      Array.from(
        { length: 5 },
        (_, i) =>
          env["GEMINI_API_KEY_" + (i + 1)] ||
          (i === 0 ? env.GEMINI_API_KEY : ""),
      ).filter((k) => k && !k.includes("YOUR_KEY")),
    ),
  ];
  return {
    keys,
    model: env.GEMINI_FURNITURE_MODEL || "gemini-3.5-flash-lite",
    enabled: env.GEMINI_FREE_TIER_CONFIRMED === "true",
  };
}
export function geminiStatus(env, ledger = {}) {
  const c = geminiConfig(env);
  return {
    configured: c.keys.length > 0,
    enabled: c.enabled,
    keyCount: c.keys.length,
    model: c.model,
    limits: DEMO_LIMITS,
    usage: ledger,
    billingVerified: false,
  };
}
export function reserveDemo(ledger = {}, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const next =
    ledger.day === day
      ? structuredClone(ledger)
      : { day, attempts: 0, reservedTokens: 0, actualTokens: 0, recent: [] };
  next.recent = (next.recent || []).filter((t) => now - t < 60000);
  if (
    next.attempts >= DEMO_LIMITS.requestsPerDay ||
    next.reservedTokens + DEMO_LIMITS.reservationTokens >
      DEMO_LIMITS.tokensPerDay ||
    next.recent.length >= DEMO_LIMITS.requestsPerMinute
  )
    throw Object.assign(
      Error(
        "Demo usage cap reached. No request was sent. Wait for the limit to reset.",
      ),
      { status: 429 },
    );
  next.attempts++;
  next.reservedTokens += DEMO_LIMITS.reservationTokens;
  next.recent.push(now);
  return next;
}
export async function verifyGeminiKeys(env, fetcher = fetch) {
  const c = geminiConfig(env),
    results = [];
  for (const [index, key] of c.keys.entries()) {
    try {
      const response = await fetcher(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(c.model),
        {
          headers: { "x-goog-api-key": key },
          signal: AbortSignal.timeout(10000),
        },
      );
      const data = response.ok ? await response.json() : {};
      results.push({
        slot: index + 1,
        valid: response.ok,
        status: response.status,
        inputTokenLimit: data.inputTokenLimit,
        outputTokenLimit: data.outputTokenLimit,
      });
    } catch {
      results.push({ slot: index + 1, valid: false, status: "unreachable" });
    }
  }
  return {
    keys: results,
    billingVerified: false,
    note: "Model access checked without text generation. Verify Free tier and active project quotas in Google AI Studio; API keys do not expose billing status.",
  };
}
const schema = {
  type: "OBJECT",
  properties: {
    type: {
      type: "STRING",
      enum: [
        "kitchen",
        "wardrobe",
        "desk",
        "tv",
        "loft",
        "shoe",
        "bookcase",
        "cabinet",
      ],
    },
    name: { type: "STRING" },
    width: { type: "NUMBER" },
    height: { type: "NUMBER" },
    depth: { type: "NUMBER" },
    thickness: { type: "NUMBER" },
    fronts: { type: "BOOLEAN" },
    frontStyle: { type: "STRING", enum: ["hinged", "sliding", "lift-up"] },
    material: {
      type: "STRING",
      enum: [
        "oak",
        "walnut",
        "plywood",
        "white",
        "sage",
        "metal",
        "marble",
        "particleboard",
      ],
    },
    frontMaterial: {
      type: "STRING",
      enum: [
        "oak",
        "walnut",
        "plywood",
        "white",
        "sage",
        "metal",
        "marble",
        "particleboard",
      ],
    },
    bays: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: {
            type: "STRING",
            enum: ["shelves", "hanging", "drawers", "mixed", "open"],
          },
          shelves: { type: "INTEGER" },
          drawers: { type: "INTEGER" },
          doors: { type: "INTEGER" },
        },
        required: ["type", "shelves", "drawers", "doors"],
      },
    },
    explanation: { type: "STRING" },
    omitted: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "type",
    "name",
    "width",
    "height",
    "depth",
    "explanation",
    "omitted",
  ],
};
export async function generateFurniturePlan(env, prompt, options = {}) {
  const result = await generateStructuredPlan(env, prompt, options);
  if (
    !schema.properties.type.enum.includes(result.plan.type) ||
    ["width", "height", "depth"].some((k) => !Number.isFinite(result.plan[k]))
  )
    throw Error("Gemini returned invalid furniture dimensions.");
  return result;
}

export async function generateStructuredPlan(
  env,
  prompt,
  {
    reserve,
    record,
    fetcher = fetch,
    responseSchema = schema,
    systemInstruction,
    content,
  } = {},
) {
  const c = geminiConfig(env);
  if (
    typeof prompt !== "string" ||
    prompt.trim().length < 3 ||
    prompt.length > DEMO_LIMITS.promptCharacters
  )
    throw Object.assign(Error("Enter 3–2000 characters."), { status: 400 });
  if (!c.keys.length || !c.enabled)
    throw Object.assign(
      Error(
        "Add GEMINI_API_KEY_1 through GEMINI_API_KEY_5 to .env. Confirm every key belongs to a Free tier project, then set GEMINI_FREE_TIER_CONFIRMED=true.",
      ),
      { status: 503 },
    );
  if (!["gemini-2.5-flash-lite", "gemini-3.5-flash-lite"].includes(c.model))
    throw Error(
      "Demo mode only allows supported Flash-Lite models; no automatic paid-model fallback.",
    );
  for (const [index, key] of c.keys.entries()) {
    await reserve();
    let response;
    try {
      response = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    systemInstruction ||
                    "Translate furniture requests into millimetre specifications. Preserve explicitly requested dimensions. Supported furniture: wardrobe, desk, tv unit, loft, shoe rack, bookcase, cabinet, straight modular kitchen. Width and height 200..12000, depth 180..2000, thickness9..50. Bays1..12, shelves/drawers0..12, doors0..2. Use 2 doors for internal mixed drawer bays. Default dimensions: wardrobe1800x600x2400, desk1400x650x750, tv1800x450x500, loft1800x600x600, shoe1000x350x1100, bookcase900x350x1800, cabinet1200x450x900, kitchen3000x580x900 (width x depth x height). Kitchen uses 4 modules: drawers,sink,hob,base. List every unsupported request in omitted; never claim it was built. Return a concise rationale. Do not output code.",
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      (content || prompt) +
                      "\nReturn a compact specification: explanation at most 40 words, only requested compartments, no repeated entries.",
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.1,
              maxOutputTokens: DEMO_LIMITS.outputTokens,
              thinkingConfig: c.model.startsWith("gemini-3")
                ? { thinkingLevel: "minimal" }
                : { thinkingBudget: 0 },
            },
          }),
        },
      );
    } catch {
      throw Error(
        "Gemini connection timed out. Stopped to avoid duplicate billable retries.",
      );
    }
    if (!response.ok) {
      if (response.status === 429)
        throw Object.assign(
          Error(
            "Google project quota reached. Stopped: changing keys does not increase a project quota.",
          ),
          { status: 429 },
        );
      if (
        [400, 401, 403, 500, 502, 503].includes(response.status) &&
        index < c.keys.length - 1
      )
        continue;
      let detail = "";
      try {
        const failure = await response.json();
        detail =
          typeof failure.error?.message === "string"
            ? failure.error.message
            : "";
        for (const secret of c.keys)
          detail = detail.split(secret).join("[redacted]");
      } catch {}
      throw Error(
        "Gemini returned HTTP " +
          response.status +
          (detail ? ": " + detail.slice(0, 800) : ". Check key verification."),
      );
    }
    const data = await response.json();
    const usage = {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens:
        (data.usageMetadata?.candidatesTokenCount || 0) +
        (data.usageMetadata?.thoughtsTokenCount || 0),
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      slot: index + 1,
      model: c.model,
    };
    await record(usage);
    if (data.candidates?.[0]?.finishReason !== "STOP")
      throw Error("Gemini response was incomplete. No furniture was added.");
    let plan;
    try {
      plan = JSON.parse(
        data.candidates[0].content.parts
          .filter((p) => !p.thought)
          .map((p) => p.text || "")
          .join(""),
      );
    } catch {
      throw Error("Gemini returned invalid JSON. No furniture was added.");
    }
    return { plan, usage };
  }
}
