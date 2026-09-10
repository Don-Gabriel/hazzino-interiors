# Furniture verification — 10 September 2026

## Clearance correction

- `npm test`: **100/100 passed**, including the original 91 checks and nine new clearance/manual-joint tests.
- `npm run test:cloudflare`: **6/6 passed locally and against the public correction release**. Deployment version is recorded in [CLOUDFLARE.md](CLOUDFLARE.md).
- Production build passed after the final interface changes.
- Motion tests cover all eight presets and three front styles at seven opening/closing fractions, rotated 37 degrees and translated away from the origin. They check physical panel/handle/leg intersections, unchanged dimensions and reversible closing.
- Additional tests cover L/U kitchen obstructions; enclosed drawers requiring both doors; extended drawers blocking door closure; left/right sliding access and inaccessible centre drawers; 9/18/25/50 mm enclosed fronts and required reveal/spacers; manual boards and extruded faces with hinges and slides; independent copied joints and Undo; rejected shear transforms; 150 mm insertion spacing; and actual solid intersection around a hole.
- Actual browser operation held an enclosed drawer at 0% with zero or one door open, extended it after both doors cleared, and blocked closing a door against the extended drawer. The complete audit of the 93-part corrected wardrobe reported no intersections or blocked opening paths.
- Through the actual joint dialog, attached a front-left hinge to a manually created 300 × 18 × 600 mm panel and opened it 90 degrees. `read_design` confirmed unchanged dimensions, the expected pivot and rigid pose.
- The browser rejected the inaccessible three-compartment sliding layout, disabled Add, and repaired it through **Use two sliding compartments**. Full opening then exposed the right drawers with the leaves stacked clear to the left.
- The public deployment also generated the corrected 93-part wardrobe, blocked a door closing against its extended drawer, and completed the audit with zero current/closed intersections and blocked opening paths. The isolated corrected demonstration was saved to Cloudflare, with no observed console errors or warnings.

These checks establish the tested geometric behaviour, not full physical simulation or every possible furniture configuration. See [clearance coverage and manual construction](CLEARANCE-AND-MANUAL-BUILD.md), including conservative moving-mesh envelopes, reference-fitting exclusions and supplier/structural limits.

## Automated checks

- `npm test`: 91 passing tests at the furniture release checkpoint, including rejection of malformed machining records before import/reporting.
- `npm run test:cloudflare`: six passing integration tests against the local Worker runtime and the public deployment, including the generated sliding wardrobe and a textured native cabinet round trip.
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
- On the public deployment, generated a 75-part sliding wardrobe, inspected its open preview, saved it to Cloudflare and calculated its 32-panel cut list and nine-sheet layout (72.8% area use, no oversized parts).
- On the same live site, machined eight through holes in a separate 600 × 400 × 18 mm board through the actual machining dialog. Saved and reloaded the 76-object project and verified that the wardrobe, mesh and hole record survived. This exercised the deployed WASM kernel and IndexedDB recovery. No console errors were observed.
- The in-app browser did not expose a download event for the HTML production-report button. Report generation and escaping are covered by automated checks; this browser session does not establish a completed file download.

These are functional checks, not certification of full SketchUp parity, manufacturing readiness or every possible combination of parameters. See [the furniture guide](FURNITURE-STUDIO.md) for scope and limitations. Live deployment results are recorded in [CLOUDFLARE.md](CLOUDFLARE.md).
