import { wardrobe, validateProject } from '../shared/model.js';
import { Router } from "express";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import {
  generateHospital,
  hospitalPlan,
  validateHospital,
} from "../shared/hospital.js";

export function tokenCost(u = {}, model = "gemini-2.5-flash-lite") {
  const input = Number(u.promptTokenCount) || 0,
    output =
      (Number(u.candidatesTokenCount) || 0) +
      (Number(u.thoughtsTokenCount) || 0);
  const rates =
    model === "gemini-2.5-flash-lite"
      ? [0.1, 0.4]
      : model === "gemini-2.5-flash"
        ? [0.3, 2.5]
        : null;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: Number(u.totalTokenCount) || input + output,
    estimatedPaidUsd: rates
      ? (input * rates[0] + output * rates[1]) / 1e6
      : null,
  };
}
export async function requestPlan({
  key,
  model,
  prompt,
  current,
  fetcher = fetch,
}) {
  const schema = {
    type: "OBJECT",
    properties: {
      action: {type:"STRING",enum:["hospital","wardrobe"]}, placement:{type:"STRING",enum:["back-right","back-left","front-right","front-left","center"]}, name: { type: "STRING" },
      width: { type: "NUMBER" },
      depth: { type: "NUMBER" },
      height: { type: "NUMBER" },
      beds: { type: "INTEGER" },
      cabinets: { type: "BOOLEAN" },
      ivStands: { type: "BOOLEAN" },
      corridor: { type: "NUMBER" },
      explanation: { type: "STRING" },
    },
    required: [
      "name",
      "width",
      "depth",
      "height",
      "beds",
      "cabinets",
      "ivStands",
      "corridor",
      "explanation",
    ],
  };
  const response = await fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "For a wardrobe request return action wardrobe, width/depth/height as WARDROBE dimensions in mm (default1200/600/2100), placement back-right by default for right corner, back-left for left corner; beds2 cabinets true ivStands true corridor1200 are unused required fields. Otherwise action hospital. Translate the user request into an editable hospital patient room or ward plan. Dimensions in millimetres. Width/depth 3000..30000, height 2400..6000, beds 1..12 integer, central corridor 900..2400. Defaults 6000x5000x3000, 2 beds, cabinets and IV stands, corridor1200. Bed size1000x2100 placed in two columns around corridor with rows along depth. For comfortable fit allow width>=corridor+3300 and depth>=ceil(beds/2)*2400+600. Preserve explicit requested dimensions even if crowded, explain tradeoffs. Use current intent for what-if edits. Only these objects are supported; explain any omitted requested feature. These are configurable planning assumptions, never certify healthcare code compliance. Give a brief design rationale, not hidden reasoning.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  request: prompt,
                  currentIntent: current || null,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2,
          maxOutputTokens: 1800,
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Gemini quota reached. Check your Google AI Studio limits and try later."
        : `Gemini returned HTTP ${response.status}. Check the API key, model access and billing in Google AI Studio.`,
    );
  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("");
  if (!text)
    throw new Error(
      "Gemini did not return a design. Try a simpler room request.",
    );
  let plan;
  try {
    const raw=JSON.parse(text); if(raw.action==="wardrobe"){for(const k of ["width","depth","height"])if(!Number.isFinite(raw[k])||raw[k]<100||raw[k]>10000)throw Error("Invalid wardrobe dimensions");plan=raw;}else plan=hospitalPlan(raw);
  } catch {
    throw new Error(
      "Gemini returned an invalid plan. No design changes were applied. Try again with room dimensions and bed count.",
    );
  }
  return { plan, usage: tokenCost(data.usageMetadata, model) };
}
export function aiRouter(getDb, root) {
  const router = Router();
  let busy = false,
    starts = [];
  async function config() {
    let file = {};
    try {
      file = parseEnv(await readFile(`${root}/.env`, "utf8"));
    } catch {}
    return {
      key: file.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
      model:
        file.GEMINI_MODEL ||
        process.env.GEMINI_MODEL ||
        "gemini-2.5-flash-lite",
      tier: file.GEMINI_BILLING_TIER || "free",
    };
  }
  router.get("/status", async (req, res) => {
    const c = await config();
    res.json({
      configured: !!c.key && c.key !== "YOUR_KEY_HERE",
      model: c.model,
      tier: c.tier,
    });
  });
  router.get("/usage", async (req, res) => {
    const db = getDb();
    res.json(
      db
        ? await db
            .collection("ai_usage")
            .find({}, { projection: { _id: 0 } })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray()
        : [],
    );
  });
  router.post("/generate", async (req, res) => {
    const prompt = req.body.prompt;
    if (
      typeof prompt !== "string" ||
      prompt.trim().length < 3 ||
      prompt.length > 4000
    )
      return res
        .status(400)
        .json({
          error: "Enter a design request between 3 and 4000 characters.",
        });
    const c = await config();
    if (!c.key || c.key === "YOUR_KEY_HERE")
      return res
        .status(503)
        .json({
          error:
            "Add GEMINI_API_KEY to C:\\WorkSpace\\Hazzino\\.env, save the file, then Generate again. No restart needed.",
        });
    starts = starts.filter((t) => Date.now() - t < 60000);
    if (busy || starts.length >= 6)
      return res
        .status(429)
        .json({
          error:
            "Please wait: one generation at a time, maximum six per minute.",
        });
    busy = true;
    starts.push(Date.now());
    const start = Date.now();
    try {
      let current;
      try {
        current = req.body.current ? hospitalPlan(req.body.current) : undefined;
      } catch {
        return res
          .status(400)
          .json({ error: "Current hospital plan is invalid." });
      }
      const result = await requestPlan({
        key: c.key,
        model: c.model,
        prompt: prompt.trim(),
        current,
      });
      let project,validation; if(result.plan.action==="wardrobe"){project=validateProject(req.body.project);const room=project.roomInfo;if(!room)throw Error("Create a room envelope first so I can position the wardrobe.");const a=result.plan;if(a.width+40>room.width||a.depth+40>room.depth||a.height>room.height)throw Error("The requested wardrobe does not fit inside this room.");const place=a.placement||"back-right",x=place==="center"?0:(place.includes("left")?-1:1)*(room.width/2-a.width/2-20),y=place==="center"?0:(place.includes("front")?-1:1)*(room.depth/2-a.depth/2-20);const w=wardrobe({width:a.width,depth:a.depth,height:a.height,x,y});project.objects.push(...w.objects);project.groups.push(...w.groups);validateProject(project);validation={summary:"Wardrobe added with 20 mm wall clearance. Check surrounding furniture before use.",issues:[]};}else{project=generateHospital(result.plan);validation=validateHospital(project);}
      const usage = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        operation: result.plan.action === "wardrobe" ? "wardrobe-design" : "hospital-design",
        model: c.model,
        tier: c.tier,
        ...result.usage,
        latencyMs: Date.now() - start,
      };
      let persisted = false;
      try {
        if (getDb()) {
          await getDb()
            .collection("ai_usage")
            .insertOne({ ...usage });
          persisted = true;
        }
      } catch {}
      res.json({
        ...result,
        project,
        validation,
        usage: { ...usage, persisted },
      });
    } catch (e) {
      res
        .status(502)
        .json({
          error:
            e.name === "TimeoutError"
              ? "Gemini timed out. Retry when your connection is stable."
              : e.message,
        });
    } finally {
      busy = false;
    }
  });
  return router;
}
