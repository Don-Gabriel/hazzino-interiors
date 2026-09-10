import { Router } from "express";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import {
  geminiStatus,
  verifyGeminiKeys,
  generateFurniturePlan,
  reserveDemo,
} from "../shared/gemini-furniture.js";
export function furnitureAiRouter(root) {
  const router = Router();
  let busy = false;
  const config = async () => {
    try {
      return {
        ...process.env,
        ...parseEnv(await readFile(root + "/.env", "utf8")),
      };
    } catch {
      return process.env;
    }
  };
  const read = async () => {
    try {
      return JSON.parse(
        await readFile(root + "/.data/gemini-demo-usage.json", "utf8"),
      );
    } catch {
      return {};
    }
  };
  const save = async (l) => {
    await mkdir(root + "/.data", { recursive: true });
    await writeFile(root + "/.data/gemini-demo-usage.json", JSON.stringify(l));
  };
  router.get("/status", async (req, res) =>
    res.json(geminiStatus(await config(), await read())),
  );
  router.post("/verify", async (req, res) => {
    if (busy)
      return res.status(429).json({ error: "AI request already running" });
    busy = true;
    try {
      res.json(await verifyGeminiKeys(await config()));
    } catch {
      res.status(502).json({ error: "Key verification unavailable" });
    } finally {
      busy = false;
    }
  });
  router.post("/generate", async (req, res) => {
    if (busy)
      return res.status(429).json({ error: "AI request already running" });
    busy = true;
    try {
      let ledger = await read();
      const result = await generateFurniturePlan(
        await config(),
        req.body.prompt,
        {
          reserve: async () => {
            ledger = reserveDemo(ledger);
            await save(ledger);
          },
          record: async (usage) => {
            ledger.actualTokens =
              (ledger.actualTokens || 0) + usage.totalTokens;
            ledger.last = usage;
            await save(ledger);
          },
        },
      );
      res.json(result);
    } catch (e) {
      res.status(e.status || 502).json({ error: e.message });
    } finally {
      busy = false;
    }
  });
  return router;
}
