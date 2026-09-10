import { DurableObject } from "cloudflare:workers";
import { validateProject, MATERIALS } from "../shared/model.js";

const MAX_BYTES = 20 * 1024 * 1024;
const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

async function readJson(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw Object.assign(Error("Expected application/json"), { status: 415 });
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    throw Object.assign(Error("Project exceeds the 20 MB limit"), {
      status: 413,
    });
  const reader = request.body?.getReader();
  if (!reader)
    throw Object.assign(Error("Missing request body"), { status: 400 });
  const decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) {
      await reader.cancel();
      throw Object.assign(Error("Project exceeds the 20 MB limit"), {
        status: 413,
      });
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode());
  } catch {
    throw Object.assign(Error("Invalid JSON"), { status: 400 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const origin = request.headers.get("origin");
    if (
      (origin && origin !== url.origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return json({ error: "Cross-origin API access is not allowed" }, 403);
    if (url.pathname === "/api/materials" && request.method === "GET")
      return json(MATERIALS);

    const cookieName =
      url.protocol === "https:"
        ? "__Host-hazzino_workspace"
        : "hazzino_workspace";
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    let token = /^[a-f0-9]{64}$/.test(cookie || "") ? cookie : null;
    const isNew = !token;
    if (isNew && request.method !== "GET")
      return json(
        { error: "Reload Hazzino to connect your workspace before saving." },
        409,
      );
    if (isNew)
      token = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    const workspace = env.WORKSPACES.get(env.WORKSPACES.idFromName(token));
    const upstream = await workspace.fetch(request);
    const response = new Response(upstream.body, upstream);
    if (isNew)
      response.headers.append(
        "Set-Cookie",
        `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${url.protocol === "https:" ? "; Secure" : ""}`,
      );
    return response;
  },
};

// Each anonymous browser workspace receives its own SQLite database.
export class WorkspaceStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS documents (
      key TEXT PRIMARY KEY, kind TEXT NOT NULL, projectId TEXT NOT NULL,
      id TEXT NOT NULL, name TEXT NOT NULL, createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS document_project ON documents(projectId, kind);
    CREATE TABLE IF NOT EXISTS chunks (
      documentKey TEXT NOT NULL, sequence INTEGER NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY(documentKey, sequence)
    );`);
  }

  read(key) {
    if (
      !this.sql.exec("SELECT key FROM documents WHERE key = ?", key).toArray()
        .length
    )
      return null;
    return JSON.parse(
      this.sql
        .exec(
          "SELECT data FROM chunks WHERE documentKey = ? ORDER BY sequence",
          key,
        )
        .toArray()
        .map((v) => v.data)
        .join(""),
    );
  }

  write(key, kind, projectId, id, name, createdAt, project) {
    const data = JSON.stringify(project);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        "INSERT OR REPLACE INTO documents VALUES (?, ?, ?, ?, ?, ?, ?)",
        key,
        kind,
        projectId,
        id,
        name,
        createdAt,
        project.updatedAt,
      );
      this.sql.exec("DELETE FROM chunks WHERE documentKey = ?", key);
      // Small rows also support models larger than SQLite's individual row limit.
      for (let start = 0, index = 0; start < data.length; index++) {
        let end = Math.min(start + 32000, data.length);
        const code = data.charCodeAt(end - 1);
        if (end < data.length && code >= 0xd800 && code <= 0xdbff) end--;
        this.sql.exec(
          "INSERT INTO chunks VALUES (?, ?, ?)",
          key,
          index,
          data.slice(start, end),
        );
        start = end;
      }
    });
  }

  async fetch(request) {
    try {
      const url = new URL(request.url),
        method = request.method;
      if (url.pathname === "/api/health" && method === "GET")
        return json({
          ok: true,
          database: "Cloudflare",
          storage: "Workspace SQLite",
          workspaceMode: "browser",
        });
      if (url.pathname === "/api/ai/status" && method === "GET")
        return json({
          configured: false,
          model: "Gemini",
          tier: "unconfigured",
          message:
            "Gemini is not connected on this deployment. The built-in template remains available.",
        });
      if (url.pathname === "/api/ai/usage" && method === "GET") return json([]);
      if (url.pathname === "/api/ai/generate" && method === "POST")
        return json(
          {
            error:
              "Gemini is not connected on this deployment. Use the built-in template or the configured local app.",
          },
          503,
        );
      if (url.pathname === "/api/projects" && method === "GET")
        return json(
          this.sql
            .exec(
              "SELECT id, name, createdAt, updatedAt FROM documents WHERE kind = 'project' ORDER BY updatedAt DESC",
            )
            .toArray(),
        );

      const match = url.pathname.match(
        /^\/api\/projects\/([^/]+)(?:\/versions(?:\/([^/]+))?)?$/,
      );
      if (!match) return json({ error: "API route not found" }, 404);
      const id = decodeURIComponent(match[1]),
        versionId = match[2] && decodeURIComponent(match[2]);
      const versions = url.pathname.includes("/versions");
      if (id.length > 200) return json({ error: "Invalid project ID" }, 400);
      const key = "project:" + id;
      if (!versions && method === "PUT") {
        const project = validateProject(await readJson(request));
        if (project.id !== id)
          return json({ error: "Project ID mismatch" }, 400);
        project.updatedAt = new Date().toISOString();
        this.write(
          key,
          "project",
          id,
          id,
          project.name,
          String(project.createdAt || project.updatedAt),
          project,
        );
        return json({
          id,
          updatedAt: project.updatedAt,
          storageLabel: "Cloudflare",
        });
      }
      if (!versions && method === "GET") {
        const project = this.read(key);
        return project
          ? json(project)
          : json({ error: "Project not found" }, 404);
      }
      if (!versions && method === "DELETE") {
        this.ctx.storage.transactionSync(() => {
          this.sql.exec(
            "DELETE FROM chunks WHERE documentKey IN (SELECT key FROM documents WHERE projectId = ?)",
            id,
          );
          this.sql.exec("DELETE FROM documents WHERE projectId = ?", id);
        });
        return json({ ok: true });
      }
      if (versions && !versionId && method === "GET")
        return json(
          this.sql
            .exec(
              "SELECT id, name, createdAt FROM documents WHERE kind = 'version' AND projectId = ? ORDER BY createdAt DESC LIMIT 50",
              id,
            )
            .toArray(),
        );
      if (versions && !versionId && method === "POST") {
        const body = await readJson(request),
          project = this.read(key);
        if (!project) return json({ error: "Save your project first" }, 404);
        const version = {
          id: crypto.randomUUID(),
          name: String(body.name || "Design checkpoint").slice(0, 200),
          createdAt: new Date().toISOString(),
        };
        this.write(
          "version:" + id + ":" + version.id,
          "version",
          id,
          version.id,
          version.name,
          version.createdAt,
          project,
        );
        return json(version);
      }
      if (versions && versionId && method === "GET") {
        const project = this.read("version:" + id + ":" + versionId);
        return project
          ? json(project)
          : json({ error: "Version not found" }, 404);
      }
      return json({ error: "Method not allowed" }, 405);
    } catch (error) {
      return json(
        { error: error.message || "Request failed" },
        error.status || 422,
      );
    }
  }
}
