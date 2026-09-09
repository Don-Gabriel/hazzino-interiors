import { mkdir, writeFile } from "node:fs/promises";
import { demoProject, blankProject, wardrobe } from "../shared/model.js";
await mkdir("examples", { recursive: true });
const home = demoProject();
home.id = "hazzino-oak-house-demo";
const cabinet = blankProject("Wardrobe · Hackathon demonstration");
cabinet.id = "hazzino-wardrobe-demo";
const w = wardrobe();
cabinet.objects = w.objects;
cabinet.groups = w.groups;
for (const [name, p] of [
  ["oak-house", home],
  ["wardrobe", cabinet],
]) {
  await writeFile(
    "examples/" + name + ".hazzino.json",
    JSON.stringify(p, null, 2),
  );
  const r = await fetch("http://127.0.0.1:3001/api/projects/" + p.id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  if (!r.ok) throw Error(await r.text());
  console.log("Saved demonstration: " + p.name);
}
