import express from "express";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProject, MATERIALS } from "../shared/model.js";
import { aiRouter } from "./ai.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
app.use(express.json({ limit: "20mb" }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    return res.status(403).json({ error: "Local application only" });
  next();
});
let db, client, mongo, dbError;
app.use(
  "/api/ai",
  aiRouter(() => db, root),
);
app.get("/api/health", (_req, res) =>
  res.json({
    ok: !!db,
    database: db ? "MongoDB" : dbError ? "unavailable" : "starting",
    storage: ".data/mongo",
    error: dbError,
  }),
);
app.use("/api", (req, res, next) => {
  if (req.path === "/materials") return next();
  if (!db)
    return res.status(503).json({
      error:
        dbError || "MongoDB is starting. Your browser keeps a local autosave.",
    });
  next();
});
app.get("/api/materials", (_req, res) => res.json(MATERIALS));
app.get("/api/projects", async (_req, res) =>
  res.json(
    await db
      .collection("projects")
      .find(
        {},
        {
          projection: {
            _id: 0,
            id: 1,
            name: 1,
            updatedAt: 1,
            createdAt: 1,
            thumbnail: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .toArray(),
  ),
);
app.get("/api/projects/:id", async (req, res) => {
  const p = await db
    .collection("projects")
    .findOne({ id: req.params.id }, { projection: { _id: 0 } });
  if (!p) return res.status(404).json({ error: "Project not found" });
  res.json(p);
});
app.put("/api/projects/:id", async (req, res) => {
  const p = validateProject(req.body);
  if (p.id !== req.params.id)
    return res.status(400).json({ error: "Project ID mismatch" });
  p.updatedAt = new Date().toISOString();
  await db.collection("projects").replaceOne({ id: p.id }, p, { upsert: true });
  res.json({ id: p.id, updatedAt: p.updatedAt });
});
app.delete("/api/projects/:id", async (req, res) => {
  await db.collection("projects").deleteOne({ id: req.params.id });
  await db.collection("versions").deleteMany({ projectId: req.params.id });
  res.json({ ok: true });
});
app.get("/api/projects/:id/versions", async (req, res) =>
  res.json(
    await db
      .collection("versions")
      .find(
        { projectId: req.params.id },
        { projection: { _id: 0, id: 1, name: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
  ),
);
app.post("/api/projects/:id/versions", async (req, res) => {
  const p = await db
    .collection("projects")
    .findOne({ id: req.params.id }, { projection: { _id: 0 } });
  if (!p) return res.status(404).json({ error: "Save your project first" });
  const v = {
    id: crypto.randomUUID(),
    projectId: p.id,
    name: String(req.body.name || "Design checkpoint").slice(0, 200),
    createdAt: new Date().toISOString(),
    project: p,
  };
  await db.collection("versions").insertOne(v);
  res.json({ id: v.id, name: v.name });
});
app.get("/api/projects/:id/versions/:version", async (req, res) => {
  const v = await db
    .collection("versions")
    .findOne({ projectId: req.params.id, id: req.params.version });
  if (!v) return res.status(404).json({ error: "Version not found" });
  res.json(v.project);
});
app.use(express.static(path.join(root, "dist")));
app.get("/{*splat}", (req, res) =>
  res.sendFile(path.join(root, "dist/index.html")),
);
app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(err.name === "SyntaxError" ? 400 : 422)
    .json({ error: err.message || "Request failed" });
});
const server = app.listen(Number(process.env.PORT) || 3001, "127.0.0.1", () =>
  console.log("Hazzino API: http://127.0.0.1:3001"),
);
try {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    await mkdir(path.join(root, ".data/mongo"), { recursive: true });
    mongo = await MongoMemoryServer.create({
      instance: {
        dbPath: path.join(root, ".data/mongo"),
        storageEngine: "wiredTiger",
        launchTimeout: 60000,
        args: ["--wiredTigerCacheSizeGB", "0.25"],
      },
      binary: { version: "8.2.6" },
    });
    uri = mongo.getUri();
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db("hazzino");
  await db.collection("projects").createIndex({ id: 1 }, { unique: true });
  await db.collection("versions").createIndex({ projectId: 1, createdAt: -1 });
  console.log(
    "MongoDB ready. Durable storage: " + path.join(root, ".data/mongo"),
  );
} catch (e) {
  dbError = e.message;
  console.error("MongoDB startup failed:", e.message);
}
async function stop() {
  server.close();
  await client?.close();
  await mongo?.stop({ doCleanup: false, force: false });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
