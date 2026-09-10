# Hazzino Studio

A browser furniture design studio for modular kitchens, wardrobes, study/work tables, TV units, lofts, shoe racks, bookcases and custom cabinets. Furniture is made of individually editable geometry, with live configuration previews, moving doors and drawers, panel machining and production reports.

Start with **Build furniture** in the header, or the **Furniture** menu. See [the furniture guide](documentation/FURNITURE-STUDIO.md) for construction options, modelling, imports and production workflows. The interface follows the supplied SketchUp reference in Hazzino's green and cream style; full SketchUp parity is not claimed.

The web app also has a Cloudflare deployment with cloud project storage and checkpoints. See [Cloudflare deployment](documentation/CLOUDFLARE.md) for publishing, testing and storage details, and [the SketchUp feature audit](documentation/SKETCHUP-WORKSPACE.md) for the current implementation and remaining gaps.

## Open the application

The development app runs at **http://127.0.0.1:5173/**. The Node API runs at **http://127.0.0.1:3001/**.

From this directory:

```powershell
npm ci
npm run dev
```

Alternatively, double-click `Start-Hazzino.cmd`. Do not start a second copy while the existing server is running.

For the compiled application:

```powershell
npm run build
npm start
```

Then open **http://127.0.0.1:3001/**. Node.js 22.12 or newer is recommended. A WebGL-capable browser with hardware acceleration is required. The layout is optimized for desktop; smaller screens retain the viewport and properties but hide the model library sidebar.

## Database and recovery

The API starts a real local MongoDB 8.2.6 process using the `mongodb-memory-server` binary manager. Despite that package name, this application explicitly uses **WiredTiger disk storage**, not an ephemeral test database. Data lives in `.data/mongo`, survives graceful server restarts, and is never deliberately cleaned during shutdown. The first launch may download the MongoDB binary from MongoDB's official distribution host. This machine already has the binary cached.

For an existing MongoDB installation, copy `.env.example` to `.env`, uncomment `MONGODB_URI`, and provide your connection URI. Both launch scripts load `.env`. The API binds to `127.0.0.1`; the application intentionally has one local workspace and no cloud account system.

Each edit writes browser recovery to IndexedDB, including large embedded textures; legacy localStorage projects remain readable. Autosave runs every 30 seconds when connected. The Save button writes immediately. File → Open projects includes both database projects and browser recovery copies. Browser data is origin-specific: `127.0.0.1:5173`, `localhost:5173`, and the public site have separate recovery storage. MongoDB projects are shared between local frontends. JSON export provides a portable backup.

## Main workflows

- **Manual modelling:** rectangles, lines, closed polygon profiles, boxes, cylinders, exact dimensions, push/pull, move, rotate, resize, duplicate, delete, group/ungroup, arrays and mirroring of symmetric solids.
- **Precision:** millimetres internally; mm/cm/m/in/ft properties; X/Y/Z constraints; grid snapping; endpoint, midpoint, edge, face-center and center snap cues; dimensions anchored to objects; standard orthographic and perspective cameras.
- **Architecture:** editable room envelopes, walls and floor, real rectangular door/window cutouts through local Y thickness, live quantity deductions, horizontal section clipping, shadows, X-ray and vector footprint plans.
- **Furniture studio:** eight configurable furniture types; straight/L/U kitchens with blind corners and real sink/hob worktop cutouts; weighted compartments, shelves, hanging rails, mixed upper storage and drawers; hinged, sliding and lift-up fronts; worktops, plinths, backs, handles and fittings. Reopen a selected furniture assembly to change its dimensions and construction.
- **Solid modelling:** real face Offset, signed Push/Pull, mitered Follow Me sweeps and Manifold solid union/subtract/intersect/trim/split. Offset subdivisions support raised details, recesses and through holes. Tool cursors and numeric input work directly in the viewport.
- **Panel machining:** through/blind hole arrays, shelf-pin and hinge-cup presets, rectangular pockets, dados and edge rebates, with actual solid geometry and machining notes in the cut list.
- **Model imports:** GLB, self-contained glTF, OBJ, STL and PLY; embedded GLB textures and material groups. The 3D model library contains all eight supplied SKP samples converted with SketchUp's Ruby API, retaining 104 editable parts and 13,988 triangles.
- **Project lifecycle:** create, rename, duplicate, save, reopen, delete saved project, browser recovery, 80-action undo history, named MongoDB checkpoints and restoration.
- **Production:** cut lists from current part dimensions, edge-band and grain settings, hardware schedules, front/plan/side part-envelope drawings, material/thickness-separated guillotine sheet layouts, CSV, printable HTML reports and SVG layouts. JSON, GLB, OBJ, STL and PNG exports remain available.
- **Assistance:** local named-dimension commands such as `wardrobe width 1800 height 2100 depth 600 shelves 4`; geometric health checks. The command parser is deterministic and does not claim to be an AI model.

## Demonstration

Open File → Open projects → **Wardrobe · Hackathon demonstration** or **The Oak House · Study**. Both are saved in MongoDB. Portable copies are in `examples/`.

For a manual demonstration from a blank project:

1. Choose **File → New project**.
2. Select the **XZ drawing plane** and a front camera view.
3. Press **R**, click two corners, and edit Width X to 600 mm and Height Z to 2100 mm. Keep the rectangle as a face.
4. In Push/Pull, enter **18 mm** and click the extrusion button.
5. Press **Ctrl D** to duplicate. Enter exact position or displacement in Properties. Use **M** and a handle for interactive placement.
6. Create and size more boards for the top, bottom, divider, shelves and doors. The Library wardrobe provides a completed reference.
7. Shift-select parts; **Ctrl G** groups them. Select the assembly in the tree to transform all parts together.
8. Apply a material, save, reload, and reopen from Projects.
9. Open Quantities or Export to produce the project JSON, mesh, image, or material estimate.

Left drag orbits when navigation is active, right drag pans, and the wheel zooms. **F3** fits the model. **Space/V, L, R, P, F, E, M, Q, S, D** choose select, line, rectangle, Push/Pull, Offset, eraser, move, rotate, resize and dimension. **Esc** cancels an operation, **Enter** closes a profile or confirms numeric modelling input, **X/Y/Z** constrain an axis, **Ctrl Z/Y** undo/redo, **Ctrl S** saves, and **Ctrl K** opens command search.

## Source layout

```text
frontend/       React editor, dialogs, Zustand store, Three.js engine, styles
backend/        Express API, MongoDB startup and project/version persistence
shared/         Project schema, generators, geometry operations, quantities, reports
tests/          Geometry, model, state transaction and real local API checks
examples/       Editable room and wardrobe demonstration projects
documentation/  Feature coverage, architecture, verification and limitations
scripts/        Demonstration seeding
BUILD_LOG.md    Chronological implementation and verification record
research/       Earlier SketchUp research and extracted hackathon brief
```

## Validation

With `npm run dev` running:

```powershell
npm test
npm run build
```

The test suite includes actual MongoDB save/reopen/checkpoint operations and cleans up only its own uniquely named test projects. It verifies dimensions, rotated extrusion and alignment, snapping coordinates, associative dimensions, opening mesh volume/raycasting, quantities, import rejection, report escaping, locks and undo/redo.

## Practical limits

This implementation is focused on furniture and is not a complete professional CAD/BIM replacement. It does not implement SketchUp's connected edge/face topology, shared component-definition editing, extension runtime, native SKP/DWG/DXF/IFC decoder, cloud collaboration or photorealistic ray tracing. The SKP sample library uses converted assets; a reviewed Ruby helper is included for conversion in installed SketchUp. Follow Me and boolean operations require suitable closed/manifold geometry. The Outer Shell command currently performs a union and does not remove enclosed voids. Sheet planning is a guillotine heuristic, not a globally optimal nesting solver. Closed profiles should be simple and non-self-intersecting. Movement gizmos snap to grid; drawing inference provides object feature snaps.

The initial room area is template metadata; independently editing room walls does not maintain BIM-style room constraints. Section cuts clip the display without producing capped construction sections. SVG export is a footprint projection of visible boxes, not an associative drawing-sheet system. OBJ/STL export uses millimetres and Z-up; GLB uses metres and Y-up. Exported mesh formats do not preserve the editable project history; use JSON for editing roundtrips. Mirroring preserves symmetric box/cylinder shape, while asymmetric custom profiles require manual checking. Non-uniform scaling of rotated assemblies can approximate a shear with per-object transforms.

Material rates are editable planning assumptions. Estimates exclude labour, taxes, hardware, supplier pricing, optimized cutting/nesting and manufacturing validation. Collision checks compare bounding boxes and can report false positives on rotated or cut objects. Before fabrication, verify dimensions, clearances, hardware, edges and material specifications.

WebMCP tools are feature-detected and use the same editor store. Browser checks exercised board creation, real Offset/recess operations, the textured SketchUp cabinet library, furniture preview/creation, front opening, production sheet calculation and database save. The automated suite also covers furniture dimensions, moving fronts, assembly copying/reconfiguration, machining, mesh imports, solid volumes and large IndexedDB recovery. See the feature guide for practical limitations.

## AI hospital extension

The earlier hospital extension remains available independently. See [the jury presentation](documentation/JURY-DEMO.md). Add `GEMINI_API_KEY` to the local root `.env` to enable its live generation. The file is reread on each AI request; local secrets are not published. The active product focus is furniture.
