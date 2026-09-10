import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, wardrobe } from "../shared/model.js";
import { buildFurniture, defaultFurnitureSpec } from "../shared/furniture.js";
import { readFile } from "node:fs/promises";

const base = process.env.CLOUDFLARE_TEST_URL || "http://127.0.0.1:8787";
test("Both AI dialogs expose the same cloud configuration and budget without generating tokens", async () => {
  const a = await (await fetch(base + "/api/ai/status")).json();
  const b = await (await fetch(base + "/api/furniture-ai/status")).json();
  for (const key of [
    "configured",
    "enabled",
    "model",
    "keyCount",
    "limits",
    "usage",
  ])
    assert.deepEqual(a[key], b[key]);
  assert.ok(a.limits?.tokensPerDay);
  const usage = await fetch(base + "/api/ai/usage");
  assert.equal(usage.status, 200);
  assert.ok(Array.isArray(await usage.json()));
  const invalid = await fetch(base + "/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "" }),
  });
  assert.equal(invalid.status, 400);
});
async function browserWorkspace() {
  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).database, "Cloudflare");
  const setCookie = health.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  if (base.startsWith("https:")) assert.match(setCookie, /Secure/);
  const cookie = setCookie.split(";")[0];
  return async (path, method = "GET", body, headers = {}) => {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  };
}

test("Cloudflare serves the app, deep links and JSON API errors", async () => {
  for (const path of ["/", "/design/example"]) {
    const response = await fetch(base + path, {
      headers: { "Sec-Fetch-Mode": "navigate" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(await response.text(), /Hazzino/);
  }
  const call = await browserWorkspace();
  assert.equal((await call("/missing")).status, 404);
});

test("Cloudflare persists editable models and independent checkpoints", async () => {
  const call = await browserWorkspace(),
    p = blankProject("Cloud persistence QA");
  const model = wardrobe();
  p.objects = model.objects;
  p.groups = model.groups;
  let version;
  try {
    const saved = await call("/projects/" + p.id, "PUT", p);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.storageLabel, "Cloudflare");
    assert.deepEqual(
      (await call("/projects/" + p.id)).body.objects,
      JSON.parse(JSON.stringify(p.objects)),
    );
    version = await call("/projects/" + p.id + "/versions", "POST", {
      name: "Before edit",
    });
    assert.equal(version.status, 200);
    p.objects[0].size[2] = 2400;
    assert.equal((await call("/projects/" + p.id, "PUT", p)).status, 200);
    assert.equal(
      (await call("/projects/" + p.id)).body.objects[0].size[2],
      2400,
    );
    assert.equal(
      (await call("/projects/" + p.id + "/versions/" + version.body.id)).body
        .objects[0].size[2],
      2100,
    );
    assert.equal((await call("/projects")).body.length, 1);
    assert.equal(
      (await call("/projects/" + p.id + "/versions")).body[0].name,
      "Before edit",
    );
  } finally {
    assert.equal((await call("/projects/" + p.id, "DELETE")).status, 200);
  }
  assert.equal((await call("/projects/" + p.id)).status, 404);
  assert.equal(
    (await call("/projects/" + p.id + "/versions/" + version.body.id)).status,
    404,
  );
});

test("A second browser cannot read, overwrite or delete another workspace", async () => {
  const a = await browserWorkspace(),
    b = await browserWorkspace(),
    p = blankProject("Workspace A");
  try {
    assert.equal((await a("/projects/" + p.id, "PUT", p)).status, 200);
    assert.equal((await b("/projects/" + p.id)).status, 404);
    assert.deepEqual((await b("/projects")).body, []);
    assert.equal(
      (await b("/projects/" + p.id, "PUT", { ...p, name: "Workspace B" }))
        .status,
      200,
    );
    assert.equal((await a("/projects/" + p.id)).body.name, "Workspace A");
    await b("/projects/" + p.id, "DELETE");
    assert.equal((await a("/projects/" + p.id)).status, 200);
  } finally {
    await a("/projects/" + p.id, "DELETE");
    await b("/projects/" + p.id, "DELETE");
  }
});

test("Invalid or cross-origin writes preserve the saved model", async () => {
  const call = await browserWorkspace(),
    p = blankProject("Validation QA");
  try {
    await call("/projects/" + p.id, "PUT", p);
    assert.equal(
      (
        await call("/projects/" + p.id, "PUT", {
          ...p,
          objects: [{ id: "invalid" }],
        })
      ).status,
      422,
    );
    assert.equal(
      (await call("/projects/" + p.id, "PUT", { ...p, id: "different" }))
        .status,
      400,
    );
    assert.equal(
      (
        await call("/projects/" + p.id, "PUT", p, {
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/projects/" + p.id, "PUT", p, {
          "Content-Type": "text/plain",
        })
      ).status,
      415,
    );
    assert.equal((await call("/projects/" + p.id)).body.name, p.name);
    assert.equal(
      (await fetch(base + "/api/projects/" + p.id, { method: "DELETE" }))
        .status,
      409,
    );
  } finally {
    await call("/projects/" + p.id, "DELETE");
  }
});

test("Large Unicode project data survives chunk storage and checkpoints", async () => {
  const call = await browserWorkspace(),
    p = blankProject("Large project QA");
  p.referenceNotes = "x".repeat(31000) + "🏠é".repeat(300000);
  try {
    assert.equal((await call("/projects/" + p.id, "PUT", p)).status, 200);
    assert.equal(
      (await call("/projects/" + p.id)).body.referenceNotes,
      p.referenceNotes,
    );
    const v = await call("/projects/" + p.id + "/versions", "POST", {
      name: "Large snapshot",
    });
    assert.equal(v.status, 200);
    assert.equal(
      (await call("/projects/" + p.id + "/versions/" + v.body.id)).body
        .referenceNotes,
      p.referenceNotes,
    );
  } finally {
    await call("/projects/" + p.id, "DELETE");
  }
});
test("Cloudflare round-trips furniture configurations, moving fronts and textured native samples", async () => {
  const call = await browserWorkspace(),
    p = {
      ...blankProject("Furniture cloud QA"),
      ...buildFurniture({
        ...defaultFurnitureSpec("wardrobe"),
        frontStyle: "sliding",
        open: 1,
      }),
    };
  try {
    assert.equal((await call("/projects/" + p.id, "PUT", p)).status, 200);
    assert.deepEqual(
      (await call("/projects/" + p.id)).body.objects,
      JSON.parse(JSON.stringify(p.objects)),
    );
    assert.deepEqual((await call("/projects/" + p.id)).body.groups, p.groups);
  } finally {
    await call("/projects/" + p.id, "DELETE");
  }
  const sample = JSON.parse(
    await readFile(
      new URL(
        "../public/models/cooktop-base-cabinet-251001.hazzino.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  sample.id = crypto.randomUUID();
  sample.name = "Textured cabinet cloud QA";
  try {
    assert.equal(
      (await call("/projects/" + sample.id, "PUT", sample)).status,
      200,
    );
    const reopened = (await call("/projects/" + sample.id)).body;
    assert.deepEqual(reopened.materials, sample.materials);
    assert.deepEqual(reopened.objects, sample.objects);
  } finally {
    await call("/projects/" + sample.id, "DELETE");
  }
});
