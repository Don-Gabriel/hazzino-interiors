# SketchUp reference and Hazzino workspace

Updated 10 September 2026.

Hazzino now has a working desktop-style modelling workspace in its existing green and cream design. This is an initial implementation, not verified feature parity with SketchUp. The reference screenshot, the installed application and extension-provided tools require separate coverage checks.

## Implemented

- Nine application menus with 110 actionable command entries, shared with command search. Selection and history determine when commands are available.
- A modelling toolbar, tool rail, scene tabs, Outliner and a collapsible Default Tray. Layout preferences are saved on this device.
- Entity Info, Materials, Scenes, Styles, Shadows, Fog, Tags, Instructor and History panels.
- Circle profiles on all three drawing planes, followed by Push/Pull; paint bucket, object eraser, orbit and pan tools.
- Arc, 2 Point Arc, 3 Point Arc, Pie, Rotated Rectangle, regular Polygon and Freehand tools, with drawing instructions and options for segment count, polygon sides and clockwise sweeps. Arc segment counts are exact; arcs are editable polylines rather than native analytic curves.
- Closed profiles preserve their shape and orientation on XY/XZ/YZ planes. YZ profiles extrude along X. Freehand strokes simplify to at most 500 points and commit as a single undoable object. Entity Info shows curve length, segment count and physical dimensions.
- Project material edits for color, opacity, metalness and roughness, including box-face materials and locked-object protection. The material preview is a schematic CSS cube.
- Textured, shaded, monochrome, hidden-line and wireframe display; axes, edges, background, fog, lighting and field-of-view controls.
- Scene creation, renaming, updating, reordering, deletion and restoration of camera, projection, zoom, display, object visibility and tag visibility. The slideshow uses discrete cuts at 2.5-second intervals.
- Context menus for object and empty-viewport actions.

These controls expose or extend Hazzino's own model engine. They do not add SketchUp's native geometry kernel, extension runtime or file format.

## Verified

- All 56 automated tests passed, including real MongoDB API persistence, scene round trips, legacy perspective views, invalid import rejection, material edits, locked objects and menu command identities. Drawing checks cover arc endpoints and sweeps, exact segment counts, rotated rectangle geometry, polygon sides, profile orientation and extrusion on all three planes, freehand endpoint preservation, bounded polylines and undo/redo.
- `npm run build` passed after the final source formatting.
- Browser verification created a circle, extruded it, edited a material, saved two scenes, renamed a scene, and reopened the project from MongoDB. Selecting the second scene restored its wireframe display and parallel projection.
- A second browser pass created a 2 Point Arc, dragged a Freehand stroke, extruded a YZ Pie by 70 mm and created a seven-sided Polygon. Reading the saved MongoDB project confirmed the resulting objects and profile geometry.
- Keyboard navigation opened the View menu and moved focus into its Face style submenu.
- The Patient room recovery project that was open before testing was restored. `__workspace_qa__` and `__drawing_qa__` remain available as small persistence test projects.
- Changed source files pass the whitespace check. A repository-wide check also reports a pre-existing blank line at the end of `.env.example`.

## Installed SketchUp inspection

Computer control successfully identified and inspected the running SketchUp 2026 Windows application. The first pass recorded 131 first-level entries across File, Edit, View, Camera, Draw, Tools, Window, Extensions and Help. The machine-readable record is [sketchup-2026-observed-menus.json](sketchup-2026-observed-menus.json).

The counts are observations in an untitled document with no selection, and are not directly comparable to Hazzino's command count. Disabled entries and submenu headings are included. Context menus and selection-dependent states remain to be audited.

Visible tray headings included Entity Info, Materials, Components, Styles, Environments, Tags, Shadows, Scenes and Instructor. The installed Extensions menu exposed Extension Warehouse, Extension Manager, migration and developer entry points, Analysis Hub, AI Assistant, AI Render and Trimble Scan Essentials.

The next pass expanded Draw's Lines, Arcs, Shapes and Sandbox submenus, recording 12 entries. It enumerated all 26 names in the installed toolbar dialog and observed its Screen Tips and Large Icons options. The Materials Edit panel exposed color, texture, opacity, metalness, roughness, normal-map and ambient-occlusion-map controls. Those controls were disabled for the selected Default material, so their behavior has not been verified. These observations are recorded in [sketchup-2026-detail-audit.json](sketchup-2026-detail-audit.json).

The inspection did not modify the native SketchUp model or invoke extension services.

## SketchUp MCP connection

The user-provided server was added to the global Codex configuration:

```sh
codex mcp add sketchup --url https://api.sketchup.com/mcp/v1/sketchup/mcp
```

Trimble OAuth sign-in completed successfully. `codex mcp list --json` reports the server as enabled with OAuth authentication. After the restart, the tools are loaded: `list_skills`, `read_skill`, `build_model`, `save_model` and `usage_limit_reached`.

`list_skills` and `read_skill({name: "sketchup-sdk"})` succeed. Repeated reads of the other required baseline skills (`sketchup-clean-geometry`, `sketchup-components`, `sketchup-assembly-structure`, `sketchup-camera`, `sketchup-styles` and `sketchup-solid-cleanup`) fail with `Unexpected response type`. Sequential calls give the same error. The model tool requires reading all baseline guidance before its first operation, so no cloud model was built or exported. Native desktop inspection remains usable independently. The failure is not evidence that another restart or sign-in is needed.

Trimble describes the connector as creating and editing models in a cloud SketchUp session, with output that can be opened in desktop SketchUp. It is complementary to desktop computer control; it does not establish access to every local menu or dialog. Sources: [Trimble's connector announcement](https://news.trimble.com/2026-04-28-Trimble-Links-SketchUp-with-Anthropics-Claude,-Bringing-New-Conversational-AI-powered-Capabilities-to-3D-Modeling) and [Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Remaining coverage

The next reference pass needs to expand the remaining submenus and dialogs, inspect individual toolbar commands, and repeat inspection with edges, faces, groups, components and solids selected. Each feature needs an observed behavior and a corresponding Hazzino acceptance check before it can be marked complete.

Known major gaps include SketchUp-style connected edge/face topology and inference; native curve semantics and tangent inference; Follow Me; general solid booleans and intersections; component instances and nested editing; terrain/Sandbox tools; photo matching and two-point perspective; walking and camera positioning; environment and texture-map authoring; configurable shortcuts; arbitrary native section planes; native SKP import/export; LayOut, Warehouse, geolocation and collaboration integrations; and extension compatibility. Some existing Hazzino tools address narrower use cases, such as architectural openings, planar profiles and parametric furniture, without covering the corresponding general SketchUp behavior.

The user's next requirements explicitly include Offset, all tools shown in the supplied toolbar image, and SketchUp-equivalent Push/Pull pointer and interaction behavior. Offset is not implemented. Delivery is a web app, with reference `.skp` files in `skpfiles/` and the supplied [3D Warehouse collection](https://3dwarehouse.sketchup.com/collection/3ea90f0b-e9e3-4037-886e-b9a311a0b0d2/3D-Models). The requested deadline is 3 pm IST on 10 September 2026; full parity by that deadline has not been promised. The current instruction is to push to GitHub and publish on Cloudflare, then wait for the user's signal before further modelling changes.

The screenshot's additional toolbars also need an extension-by-extension inventory. Full visual and functional parity remains unverified.
