import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, wardrobe, uid } from "../shared/model.js";
const base = "http://127.0.0.1:3001/api";
async function call(path, method = "GET", body) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
test("MongoDB create → reopen → edit → checkpoint → restore read → delete", async () => {
  const health = await call("/health");
  assert.equal(health.body.database, "MongoDB");
  const p = blankProject("__test__ " + uid()),
    w = wardrobe();
  p.objects = w.objects;
  p.groups = w.groups;
  try {
    assert.equal((await call("/projects/" + p.id, "PUT", p)).status, 200);
    const got = await call("/projects/" + p.id);
    assert.deepEqual(got.body.objects, p.objects);
    const version = await call("/projects/" + p.id + "/versions", "POST", {
      name: "Original",
    });
    assert.equal(version.status, 200);
    p.objects[0].size[2] = 2400;
    assert.equal((await call("/projects/" + p.id, "PUT", p)).status, 200);
    assert.equal(
      (await call("/projects/" + p.id)).body.objects[0].size[2],
      2400,
    );
    const checkpoint = await call(
      "/projects/" + p.id + "/versions/" + version.body.id,
    );
    assert.equal(checkpoint.body.objects[0].size[2], 2100);
    const listed = await call("/projects");
    assert.ok(listed.body.some((q) => q.id === p.id));
  } finally {
    assert.equal((await call("/projects/" + p.id, "DELETE")).status, 200);
  }
  assert.equal((await call("/projects/" + p.id)).status, 404);
});
test("API rejects invalid project and cross-origin writes", async () => {
  const p = blankProject();
  p.objects = [{ id: "invalid" }];
  assert.equal((await call("/projects/" + p.id, "PUT", p)).status, 422);
  const r = await fetch(base + "/projects/" + p.id, {
    method: "PUT",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(p),
  });
  assert.equal(r.status, 403);
});
