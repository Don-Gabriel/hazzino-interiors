import test from "node:test";
import assert from "node:assert/strict";
import { generateFurniturePlan } from "../shared/gemini-furniture.js";

test("provider errors retain useful detail while removing every configured credential", async () => {
  const keys = ["sensitive-key-one", "sensitive-key-two"];
  await assert.rejects(
    generateFurniturePlan(
      {
        GEMINI_API_KEY_1: keys[0],
        GEMINI_API_KEY_2: keys[1],
        GEMINI_FREE_TIER_CONFIRMED: "true",
      },
      "Build a wardrobe",
      {
        reserve: async () => {},
        record: async () => {},
        fetcher: async () =>
          Response.json(
            {
              error: { message: "Model unavailable for " + keys.join(" and ") },
            },
            { status: 404 },
          ),
      },
    ),
    (error) => {
      assert.match(error.message, /HTTP 404: Model unavailable/);
      keys.forEach((key) => assert.ok(!error.message.includes(key)));
      return true;
    },
  );
});

test("non-JSON provider failures remain bounded and do not echo HTML", async () => {
  await assert.rejects(
    generateFurniturePlan(
      { GEMINI_API_KEY_1: "secret", GEMINI_FREE_TIER_CONFIRMED: "true" },
      "Build a wardrobe",
      {
        reserve: async () => {},
        record: async () => {},
        fetcher: async () =>
          new Response("<html>upstream private diagnostic</html>", {
            status: 404,
          }),
      },
    ),
    /Gemini returned HTTP 404\. Check key verification\./,
  );
});
