# Furniture verification — 10 September 2026

## Automated checks

- `npm test`: 90 passing tests at the furniture release checkpoint.
- `npm run test:cloudflare`: six passing integration tests against the local Worker runtime, including the generated sliding wardrobe and a textured native cabinet round trip.
- `npm run build`: passed; browser geometry kernel WASM is bundled as a static asset.
- `wrangler deploy --dry-run`: passed with the existing Worker/static-assets/Durable-Object configuration.
- `npm audit`: zero vulnerabilities after pinning Sharp 0.35.4 through an override. Both Manifold's optional image-processing dependency chain and Wrangler's Miniflare chain now resolve the patched version.

Tests cover all eight furniture presets, exact overall dimensions, rotated fronts, door/handle pivot relationships, drawer travel, reversible closing, lift-up and sliding mechanisms, mixed storage, standard-sheet back panels, non-overlapping kitchen module envelopes, cutout and machining volumes, invalid operation atomicity, copy/paste/remapping, reconfiguration, Undo, grain/kerf/material-aware nesting and report escaping.

The earlier modelling tests also cover face offsets with holes, host recesses and through-holes, rotated Push/Pull, Follow Me sweeps, solid booleans, imports with nested transforms/material groups, all eight native SKP exports, layers, locks, keyboard handling, scene persistence and live MongoDB operations. IndexedDB tests recover a project with a six-million-character embedded texture and migrate legacy localStorage projects.

## Browser checks

- Inserted the real textured Cooktop Base Cabinet from the model library and inspected the rendered cabinet, cooktop and materials. Saved it to MongoDB. The IndexedDB implementation removed the previous localStorage-size failure.
- Created an isolated `Furniture workshop QA` project, opened the wardrobe builder and inspected closed/open fronts in its live 3D preview.
- Added the wardrobe and checked the generated selection, assembly controls, cut list and sheet-layout result. An oversized back in the first version was caught; current generation splits backs into smaller panels and tests that they fit standard stock.
- Inspected an L-shaped kitchen preview with its automatically added blind corner, worktop joint and wall cabinets.
- Used the supported WebMCP board tool to add a 600 × 400 × 18 mm test panel. Through the actual machining dialog, cut eight through holes and verified the resulting mesh and machining record through `read_design`. Saved the project with `save_design`.
- Earlier browser checks exercised a 1,000 mm cube, a 100 mm face inset and a 300 mm recess cut into the host, plus drawing/camera/material/scene workflows documented in the workspace audit.

These are functional checks, not certification of full SketchUp parity, manufacturing readiness or every possible combination of parameters. See [the furniture guide](FURNITURE-STUDIO.md) for scope and limitations. Live deployment results are recorded in [CLOUDFLARE.md](CLOUDFLARE.md).
