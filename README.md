# Hazzino Studio

A working local browser modeller for architecture, interiors, and individually editable furniture boards. Built from the supplied furniture CAD hackathon brief, with room layouts, true rectangular openings, production quantities, material estimates, and design checkpoints.

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

Each edit writes browser recovery data. A MongoDB autosave runs every 30 seconds when connected. The Save button writes immediately. File → Open projects includes both database projects and browser recovery copies. Browser data is origin-specific: `127.0.0.1:5173`, `localhost:5173`, and `127.0.0.1:3001` have separate browser storage. MongoDB projects are shared between those local frontends. JSON export provides a portable backup.

## Main workflows

- **Manual modelling:** rectangles, lines, closed polygon profiles, boxes, cylinders, exact dimensions, push/pull, move, rotate, resize, duplicate, delete, group/ungroup, arrays and mirroring of symmetric solids.
- **Precision:** millimetres internally; mm/cm/m/in/ft properties; X/Y/Z constraints; grid snapping; endpoint, midpoint, edge, face-center and center snap cues; dimensions anchored to objects; standard orthographic and perspective cameras.
- **Architecture:** editable room envelopes, walls and floor, real rectangular door/window cutouts through local Y thickness, live quantity deductions, horizontal section clipping, shadows, X-ray and vector footprint plans.
- **Interiors and furniture:** parameterized wardrobe/bookcase; editable desk, sofa and chair assemblies; individual board IDs; wood grain and solid/glass/metal finishes; per-face box materials; layers, hide and lock.
- **Project lifecycle:** create, rename, duplicate, save, reopen, delete saved project, browser recovery, 80-action undo history, named MongoDB checkpoints and restoration.
- **Production:** board quantities, material rates, waste allowance, CSV, printable HTML estimates, SVG plan footprints, JSON, GLB, OBJ, STL and PNG exports.
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

Left drag orbits, right drag pans, and the wheel zooms. **F** fits the model. **V/L/R/P/E/M/Q/S/D** choose select/line/rectangle/profile/push-pull/move/rotate/resize/dimension. **Esc** cancels a drawing operation, **Enter** closes a profile, **X/Y/Z** constrain an axis, **Ctrl Z/Y** undo/redo, **Ctrl S** saves, and **Ctrl K** opens command search.

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

This is a functional hackathon prototype, not a complete professional CAD/BIM replacement. It has no native SKP/DWG/DXF/IFC import, arbitrary solid boolean kernel, general vertex/edge topology editor, freeform surface modelling, nested assemblies, cloud collaboration, authentication, photorealistic ray tracing, structural/code compliance engine, real AI/voice integration, or optimized sheet nesting. Closed profiles are planar and should be simple, non-self-intersecting polygons. Snapping uses visible solid bounding features, which can differ from the actual curved surface of a cylinder or the edges around an opening. Movement gizmos snap to grid; drawing inference provides object feature snaps.

The initial room area is template metadata; independently editing room walls does not maintain BIM-style room constraints. Section cuts clip the display without producing capped construction sections. SVG export is a footprint projection of visible boxes, not an associative drawing-sheet system. OBJ/STL export uses millimetres and Z-up; GLB uses metres and Y-up. Exported mesh formats do not preserve the editable project history; use JSON for editing roundtrips. Mirroring preserves symmetric box/cylinder shape, while asymmetric custom profiles require manual checking. Non-uniform scaling of rotated assemblies can approximate a shear with per-object transforms.

Material rates are editable planning assumptions. Estimates exclude labour, taxes, hardware, supplier pricing, optimized cutting/nesting and manufacturing validation. Collision checks compare bounding boxes and can report false positives on rotated or cut objects. Before fabrication, verify dimensions, clearances, hardware, edges and material specifications.

WebMCP tools are feature-detected and use the same store actions. No supported browser WebMCP validation interface was available in this session, so browser registration and execution are not claimed as tested. No automated interactive browser walkthrough or screenshot comparison was performed; verification used compilation, live HTTP/API checks and executable geometry/state tests.
