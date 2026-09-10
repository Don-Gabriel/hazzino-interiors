import { generateStructuredPlan } from "./gemini-furniture.js";
import {
  generateHospital,
  hospitalPlan,
  validateHospital,
} from "./hospital.js";
import { validateProject, wardrobe } from "./model.js";

const schema = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: ["hospital", "wardrobe"] },
    placement: {
      type: "STRING",
      enum: ["back-right", "back-left", "front-right", "front-left", "center"],
    },
    name: { type: "STRING" },
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
    "action",
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

export async function generateDesign(env, body, hooks) {
  // Forward only validated planning fields, never the user's full project to Gemini.
  const current = body.current
    ? hospitalPlan(
        Object.fromEntries(
          [
            "name",
            "width",
            "depth",
            "height",
            "beds",
            "cabinets",
            "ivStands",
            "corridor",
          ]
            .filter((key) => Object.hasOwn(body.current, key))
            .map((key) => [key, body.current[key]]),
        ),
      )
    : null;
  const result = await generateStructuredPlan(env, body.prompt, {
    ...hooks,
    responseSchema: schema,
    systemInstruction:
      "Translate requests to patient room plans, or a wardrobe to place in an existing room. Return action hospital or wardrobe. Millimetres throughout. Hospital defaults: width6000 depth5000 height3000 beds2 cabinets true ivStands true corridor1200. Hospital limits: width/depth3000..30000 height2400..6000 beds1..12 integer corridor900..2400. Bed size1000x2100, two columns around central corridor; allow width>=corridor+3300 and depth>=ceil(beds/2)*2400+600 for comfort. Preserve explicit dimensions and explain crowding. Use currentIntent for what-if requests. Wardrobe defaults: width1200 depth600 height2100; placement back-right for right corner, back-left for left corner. For wardrobe, beds2 cabinets true ivStands true corridor1200 are unused schema fields. Only beds, bedside cabinets, IV stands and wardrobes are supported. Explain omitted requests and constraints in at most 40 words. This is a planning aid, never healthcare-code certification. Return compact JSON, no code.",
    content: JSON.stringify({ request: body.prompt, currentIntent: current }),
  });
  let project, validation;
  if (result.plan.action === "wardrobe") {
    const a = result.plan;
    for (const key of ["width", "depth", "height"])
      if (!Number.isFinite(a[key]) || a[key] < 100 || a[key] > 10000)
        throw Error("Invalid wardrobe dimensions. No changes were applied.");
    project = validateProject(structuredClone(body.project));
    const room = project.roomInfo;
    if (!room)
      throw Error(
        "Create a room envelope first so the wardrobe can be positioned.",
      );
    if (
      a.width + 40 > room.width ||
      a.depth + 40 > room.depth ||
      a.height > room.height
    )
      throw Error("The requested wardrobe does not fit inside this room.");
    const place = a.placement || "back-right";
    if (!schema.properties.placement.enum.includes(place))
      throw Error("Invalid wardrobe placement.");
    const x =
      place === "center"
        ? 0
        : (place.includes("left") ? -1 : 1) *
          (room.width / 2 - a.width / 2 - 20);
    const y =
      place === "center"
        ? 0
        : (place.includes("front") ? -1 : 1) *
          (room.depth / 2 - a.depth / 2 - 20);
    const assembly = wardrobe({
      width: a.width,
      depth: a.depth,
      height: a.height,
      x,
      y,
    });
    project.objects.push(...assembly.objects);
    project.groups.push(...assembly.groups);
    validateProject(project);
    validation = project.hospitalIntent
      ? validateHospital(project)
      : {
          summary:
            "Wardrobe placed with 20 mm wall clearance. Check surrounding furniture for obstructions.",
          issues: [],
        };
  } else if (result.plan.action === "hospital") {
    result.plan = { ...hospitalPlan(result.plan), action: "hospital" };
    project = generateHospital(result.plan);
    validation = validateHospital(project);
  } else
    throw Error(
      "Gemini returned an unsupported design action. No changes were applied.",
    );
  return { ...result, project, validation };
}
