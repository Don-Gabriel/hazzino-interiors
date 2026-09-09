import test from "node:test";
import assert from "node:assert/strict";
import {
  hospitalPlan,
  generateHospital,
  validateHospital,
} from "../shared/hospital.js";
import { requestPlan, tokenCost } from "../backend/ai.js";
test("hospital template creates semantic assemblies with valid circulation", () => {
  const p = generateHospital({});
  assert.equal(
    p.groups.filter((g) => g.semanticType === "hospital-bed").length,
    2,
  );
  assert.equal(p.objects.length, 36);
  assert.deepEqual(validateHospital(p).issues, []);
});
test("hospital catches crowded room and moved assembly obstruction", () => {
  const p = generateHospital({ beds: 6 });
  assert.ok(validateHospital(p).issues.some((x) => x.includes("overlaps")));
  const q = generateHospital({});
  const id = q.groups.find((g) => g.semanticType === "hospital-bed").id;
  for (const o of q.objects.filter((o) => o.groupId === id))
    o.position[0] += 1150;
  assert.ok(validateHospital(q).issues.some((x) => x.includes("circulation")));
});
test("hospital rejects unsupported geometry ranges", () => {
  assert.throws(() => hospitalPlan({ beds: 1.5 }));
  assert.throws(() => hospitalPlan({ width: NaN }));
  assert.throws(() => hospitalPlan({ beds: 50 }));
});
test("Gemini structured plan contract and actual usage accounting", async () => {
  let body;
  const result = await requestPlan({
    key: "test-only",
    model: "gemini-2.5-flash-lite",
    prompt: "two beds",
    fetcher: async (url, options) => {
      body = JSON.parse(options.body);
      assert.equal(options.headers["x-goog-api-key"], "test-only");
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: JSON.stringify(hospitalPlan({})) }] },
            },
          ],
          usageMetadata: {
            promptTokenCount: 1000,
            candidatesTokenCount: 200,
            thoughtsTokenCount: 50,
            totalTokenCount: 1250,
          },
        }),
      };
    },
  });
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(result.plan.beds, 2);
  assert.equal(result.usage.outputTokens, 250);
  assert.equal(result.usage.estimatedPaidUsd, 0.0002);
});
test("Gemini rejects quota failures and malformed output", async () => {
  await assert.rejects(
    requestPlan({
      key: "test",
      model: "m",
      prompt: "a",
      fetcher: async () => ({ ok: false, status: 429 }),
    }),
    /quota/,
  );
  await assert.rejects(
    requestPlan({
      key: "test",
      model: "m",
      prompt: "a",
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "not json" }] } }],
        }),
      }),
    }),
    /invalid plan/,
  );
  assert.equal(tokenCost({}, "unknown").estimatedPaidUsd, null);
});
