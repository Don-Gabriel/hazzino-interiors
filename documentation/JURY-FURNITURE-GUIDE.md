# Hazzino Studio — jury build guide

Build date: 10 September 2026. This guide describes the furniture demonstration and its verified scope. It distinguishes tested features from external-service setup and professional-CAD gaps; it does not claim complete SketchUp parity or flawless behaviour for every possible model.

**Live app:** https://hazzino-interiors.hazzino-studio.workers.dev/

**Source:** https://github.com/Don-Gabriel/hazzino-interiors

**Cloud AI verification update (10 September, 3:53 pm IST):** AI generation on the public Cloudflare app is now verified. The prompt `Build a wardrobe 1800 mm wide, 600 mm deep and 2400 mm high.` returned a specification that was inserted as **62 editable objects** in the project **AI furniture · Jury verification**. Save was invoked. All five supplied keys passed model-access verification and are installed as Worker secrets; the owner confirmed all five projects are Free tier. A more complex generated design failed insertion with “Dimensions must be greater than zero”, and some longer responses were rejected as incomplete. Use the tested prompt for the demo; arbitrary instructions are not guaranteed to generate usable furniture. The earlier cloud HTTP 404 failure is no longer reproduced by the verified request.

### API tokens, fallback and demo limits

Usage snapshot: **10 September 2026, 3:52:51 pm IST**, shared Cloudflare ledger.

| Measure | Recorded value |
|---|---|
| Model | Gemini 3.5 Flash-Lite |
| Latest successful wardrobe input | 306 tokens |
| Latest successful wardrobe output | 183 tokens |
| Latest successful wardrobe total | 489 tokens |
| Actual tokens reported across cloud attempts | 6,823 tokens |
| Cloud attempts recorded | 7 |
| Conservative tokens reserved | 42,000 of 60,000 daily |
| Reservation per attempt | 6,000 tokens, including failed attempts |
| Remaining reservation allowance at snapshot | 18,000 tokens, equivalent to 3 attempts |
| Request caps | 2 per minute; nominally 20 per day, but the token reservation permits at most 10 attempts per day |
| Maximum response / prompt | 3,072 output tokens / 2,000 prompt characters |
| Credential slots | 5 server-side keys; latest success used slot 1 |

Actual usage and reserved budget are different figures. Reservations protect the demo allowance and are not a billing estimate. Earlier local generation used 283 input + 75 output = 358 tokens in a separate local ledger, excluded from the cloud total. Failed provider requests may not report token usage. The displayed actual total includes only provider-reported usage.

Keys provide fallback when the provider rejects or exhausts an eligible key; they do not multiply the application's shared daily budget. Key verification checks model access, not billing status, available project quota or a guarantee that generation will succeed. Free-tier status was confirmed by the owner; the API reports billingVerified=false because it cannot independently verify billing. No paid-tier switch is enabled by this build. Provider quotas still apply. The model's 1,048,576-token input context and 65,536-token output capability are context limits, **not** free usage allowances.

Validation for this release: 9 targeted tests and 6 Cloudflare integration tests passed; the earlier broader suite passed 112 tests. Browser verification confirms generation and insertion of the 62-part wardrobe. Remaining complex-generation failures are disclosed above.


## 1. What the app does

Hazzino is a browser-based furniture modeller. A design contains real editable board and mesh geometry, materials, assemblies and optional hinge/slide mechanisms. Presets and manual modelling share the same document, transformations, save format and quantity calculations.

The main product areas are modular kitchens, wardrobes, study/worktables, TV units, lofts, shoe racks, bookcases and general cabinets. A preset is a starting construction: its panels, shelves, fronts, handles and hardware become selectable objects. The app can also build furniture manually from dimensioned boards, rectangles, profiles and extrusions.

## 2. Recommended jury walkthrough

1. Open the app. Use **File → New project** and name the design.
2. Click **Build furniture**, choose Wardrobe, and inspect dimensions, compartments and construction. Add the unit.
3. Change to **Object** selection mode in Entity Info. Select a shelf from **Window → Outliner**, change its height or position, then Undo.
4. Choose **Furniture → Hinges, slides & clearance**. Open the doors before extending an enclosed drawer. Retract the drawer before closing its obstructing doors. Inspect the reported obstruction if motion stops.
5. Open **Window → Materials**. Choose a swatch; create a separate colour using **Create new colour**, enter a hex value such as `#245ee8`, and press Enter. Activate Paint bucket and click a part.
6. Demonstrate manual modelling using the exact cabinet procedure in section 5. Rectangle previews should show four sides before the second click.
7. Demonstrate Offset, a recess, Follow Me or a boolean operation using the separate steps below.
8. Open **Furniture → Cut list, drawings & sheet layout**. Inspect the panel list, hardware schedule and sheet-layout warnings; export a report.
9. Save the project, reopen it from **File → Open projects**, and edit a part. Export JSON as an editable backup.
10. The AI demonstration is conditional on verified server keys and Free-tier setup. Use section 11; manual/preset modelling does not depend on Gemini.

## 3. Workspace and navigation

| Area | Use |
|---|---|
| Furniture menu / Build furniture | Create and reconfigure assemblies; access machining, motion and production |
| Draw menu / left toolbar | Lines, rectangles, arcs, circles, polygons, profiles and dimensioned solids |
| Tools menu / top toolbar | Select, paint, move, rotate, scale, Push/Pull, Offset, Follow Me and solid operations |
| Outliner | Select named parts, nested groups and internal components; show through Window → Outliner |
| Default Tray / Entity Info | Name, dimensions, position, rotation, finish, layer, fabrication and assembly actions |
| Materials | Swatches, custom colours, opacity, roughness and metalness |
| Scenes | Saved camera/display/visibility states and scene playback |
| Bottom viewport controls | Grid, snapping, edges, X-ray, shadows, section and drawing plane |
| Status bar | Active tool, inference type, operation guidance and validation errors |

At narrow widths the Outliner opens as an overlay. Close it to expose the canvas. Default Tray sections scroll independently. **Change finish** opens and scrolls to Materials.

Use Orbit (`O`) and drag to rotate the camera; Pan (`H`) and drag to translate the view; the mouse wheel zooms. **F3** frames the whole model. Camera offers front/back/left/right/top/bottom/isometric and perspective/parallel projection. Floor plan provides a top view. View styles include textured, shaded, monochrome, hidden line and wireframe. Colour is deliberately suppressed in monochrome/hidden-line styles.

## 4. Furniture presets

| Type | Principal configuration |
|---|---|
| Modular kitchen | Base, drawer, sink, hob, open, wall and tall modules; straight/L/U layout; worktops and cutouts |
| Wardrobe | Weighted bays, shelves, hanging rails, drawers and mixed storage; fronts and handles |
| Study / worktable | Worktop, legs, modesty panel and optional storage |
| TV unit | Storage bays, drawers and optional wall panel |
| Loft | Overhead elevation, compartments and lift-up or other fronts |
| Shoe rack | Shelves, compartments and closed storage |
| Bookcase | Open display and shelf configuration |
| Custom cabinet | General compartment construction |

Dimensions are millimetres. Configure overall width/depth/height, panel and back thickness, plinth, reveal, material and placement. Compartment width shares divide the clear width after structural panels. Invalid dimensions or impossible compartments are rejected with a message.

New assemblies and model-library insertions default to being placed beside existing furniture with 150 mm separation. New dimensioned solids now do this as well. Set precise centre coordinates afterwards for assembly or intentional boolean overlap. This placement is not a room-layout optimizer and does not guarantee fit inside room walls.

Choose **Edit selected furniture** to reconfigure a generated assembly. Reconfiguration rebuilds its parts and can replace individual shape edits. Undo restores the previous state. Existing saved furniture is preserved until edited; construction corrections are not silently applied to old models.

## 5. Build a cabinet manually

This example reproduces the supplied workflow using individual parts. Dimensions and positions below are X, Y, Z in millimetres; positions refer to object centres.

1. Choose drawing plane **YZ** and Camera → Right.
2. Draw a rectangle. Set its Y dimension to 600, Z dimension to 2100, centre Y to 300 and centre Z to 1050. It is a face at X=0.
3. Apply Push/Pull **18 mm**. Name it Left side. The resulting dimensions are `18,600,2100`; centre is `9,300,1050`.
4. Duplicate with Ctrl D. Name the copy Right side and set centre X to 1191. Overall cabinet width is now 1200 with 1164 clear between sides.
5. Create these boards through Draw → Dimensioned board / cylinder, or Rectangle + Push/Pull. Enter each centre explicitly after creation.

| Part | Size X,Y,Z | Centre X,Y,Z |
|---|---|---|
| Top | 1164,600,18 | 600,300,2091 |
| Bottom | 1164,600,18 | 600,300,9 |
| Middle divider | 18,600,2064 | 600,300,1050 |
| Left shelf | 573,580,18 | 304.5,300,1050 |
| Right shelf | 573,580,18 | 895.5,300,1050 |
| Left door | 597,18,2096 | 300,-11,1050 |
| Right door | 597,18,2096 | 900,-11,1050 |

6. Select the nine parts, choose Birch plywood or another finish, then Ctrl G. Group mode selects the assembly; Object mode selects a part.
7. Save and reopen. Change a shelf's Z position and Undo to demonstrate continued editability.

The example deliberately has no back or drawers. Add these as separate solids if required. A saved portable version is `examples/manual-workflow-wardrobe.json`. Manual joint assignment is explained below.

## 6. Drawing, precision and snapping

| Tool | Interaction |
|---|---|
| Line (`L`) | Click start and end |
| Rectangle (`R`) | Click opposite corners; four-side preview follows the pointer |
| Rotated rectangle | First two points define an edge; third gives perpendicular width |
| Circle (`C`) / regular polygon | Click centre then radius; polygon uses configured side count |
| Centre arc / pie | Centre, start, end; direction is configurable |
| 2 Point Arc (`A`) | Start, end, then bulge |
| 3 Point Arc | Start, through point, end |
| Closed profile | Click vertices; click start or Enter to close |
| Freehand | Drag a stroke; simplification retains its major corners |
| Dimension (`D`) | Select two reference points; supported anchors follow geometry changes |

Select the intended XY, XZ or YZ drawing plane. F6 cycles it. A first snap on elevated geometry establishes the parallel drawing-plane elevation; subsequent rectangle points remain on that plane. Arbitrarily tilted automatic drawing planes are not implemented.

**F8** toggles snapping. Inference includes endpoints, midpoints, edges, face/box centres, faces, true segment intersections and the grid. Mesh/profile/import inference uses rendered feature edges. The status identifies the selected feature. Hidden objects are excluded from pointer snapping. Screen tolerance and overlapping projected features can affect which point wins; zoom in for precision.

**Move point to point** is the feature-snap movement tool: select the objects, pick a source point, then a destination point. It is in Tools, the left toolbar and Entity Info. Dimensions remain unchanged; Esc cancels; Undo reverses the finished move. X/Y/Z constrain the active movement. The ordinary Move gizmo uses grid snapping, not feature-to-feature alignment.

Numeric fields commit on Enter or leaving the field. Supported measurement inputs include mm, cm, m, inches, feet and fractional inches. Clear an unintended X/Y/Z constraint by toggling it again.

## 7. Editing real solids

**Push/Pull (`P`):** click a face and move/click again, or drag, or enter a distance. A flat face becomes a solid. Signed distances move solid faces outward/inward. Supported operations update geometry and quantities, not just a visual scale.

**Offset (`F`):** click a planar face, set distance and confirm. This creates an inner face and border. Push an inner subdivision inward to form a real recess or through-opening in its host. Invalid/self-intersecting offsets are rejected.

**Follow Me:** draw a separate flat profile and a connected line/arc path. Open Follow Me, choose the profile and tick the path segments. Enable centre alignment if the profile is not already perpendicular/positioned at the path start. Create sweep replaces the standalone profile with a closed solid; Keep path retains construction edges. A selected planar solid face can also supply the profile while retaining its host. Straight, mitered, closed and holed-profile sweeps have regression coverage. Disconnected paths, double-backs and invalid geometry produce errors. Rectangle profiles use the broad face on all three drawing planes.

**Solid operations:** place two closed solids in deliberate overlap and select them in order. For Subtract and Trim, the first is the target. Object mode avoids selecting an entire furniture assembly accidentally.

| Operation | Result |
|---|---|
| Union | Replaces operands with their combined solid |
| Subtract | Replaces operands with first minus the following solids |
| Intersect | Keeps shared volume; disjoint objects produce no solid |
| Trim | Replaces the target but retains cutters, by design |
| Split | Replaces two operands with intersection and non-empty remainders |
| Outer shell | Currently the same union operation; does not remove enclosed voids |

Operation tests verify source replacement, nested groups and Undo. A retained Trim cutter is not a duplicate-operation failure. Move or hide it to inspect the cut. Locked, open and non-manifold operands are unsuitable for solid operations.

Duplicate, array, group/ungroup, copy/paste, paste in place, erase, align, rotate and scale share Undo/Redo. Mirror is limited to uncut boxes and cylinders. Scale operations that would shear rotated panels or corrupt a multi-part joint assembly are rejected; use furniture configuration for resizing articulated furniture.

## 8. Materials, colours and organisation

Choose **Window → Materials**, or click Change finish in Entity Info. Clicking a swatch applies it to the selection and chooses it for painting. With no selection, choose a finish, activate Paint bucket (`B`), then click objects. Face selection paints individual box/import material groups; arbitrary topology editing is not provided.

To avoid recolouring every existing use of a finish, click **Create new colour**, then change its colour well or six-digit Hex colour field. A new independent swatch appears. Material overrides, custom colours and face assignments save with project JSON. Opacity, roughness and metalness are editable. Imported texture colours now receive the colour tint rather than forcing white. Wood-grain textures are regenerated when their base colour changes.

Set Entity Info → Layer for the selected unlocked parts. Tags can show/hide layers. Use Outliner and selection modes to control whether changes target an object, face or assembly. Locked objects are protected from ordinary material edits.

## 9. Hinges, slides and clearance

Choose **Furniture → Hinges, slides & clearance**. Individual door/drawer controls operate actual rigid parts with their attached handles. Enclosed drawers stop at obstructing doors; an extended drawer can stop a door from closing. The combined opening control opens doors before drawers and reverses that order when closing.

Two-track sliding fronts expose one side at a time. An inaccessible centre drawer is not forced through a leaf. The builder rejects the unsupported arrangement and offers a two-compartment alternative.

For manual mechanisms, select only moving parts (door plus handle, or drawer box/front/handle), choose **Attach to manual parts**, select hinge or slide, set world pivot/axis/angle or travel, then attach. The current pose becomes closed. The carcass must remain outside the moving selection.

Run **Check clearances → Run complete clearance check** after construction or edits. The audit examines current/closed poses and supported opening paths, including hidden parts. Static shaped solids use actual intersection volume where possible. Motion uses conservative oriented bounds sampled at up to 2 mm estimated vertex travel; shaped objects may stop early. Reference mounting fittings are excluded; physical handles, legs and feet participate.

These are geometric interference checks. They do not calculate gravity, strength, sag, load capacity, supplier-specific hinge linkages or manufacturing certification. Deliberate intersections remain possible during manual construction and booleans. See `CLEARANCE-AND-MANUAL-BUILD.md` for numerical tolerances and exclusions.

## 10. Machining, cut lists and exports

Select one panel and choose **Furniture → Panel drilling, pockets & grooves**. Set axis/face, local offsets, drill depth or through cut, pattern counts and spacing. Shelf-pin and 35 mm cup presets are editable starting values. Pockets can form dados, rebates and grooves. Cuts accumulate on the actual solid and participate in Undo.

**Cut list, drawings & sheet layout** derives blanks from current part dimensions. Configure fabrication direction, grain, edge banding and material. Export CSV, HTML reports/drawings or sheet SVG. Sheet layout respects material/thickness separation, grain locking and saw kerf; oversized parts are reported. The layout is a rectangular guillotine heuristic, not a global optimum or CNC toolpath generator. Drawings show orthographic envelopes; edge-band thickness is not automatically deducted from blank size.

Project JSON preserves editable geometry, materials, groups, joints and scenes. GLB, OBJ and STL export the current geometry; they do not preserve editable joints/history. GLB uses metres/Y-up; OBJ/STL use millimetres/Z-up. Viewport image and plan exports are available through File/Camera controls.

Import GLB/self-contained glTF, OBJ, STL and PLY. The supplied eight SKP examples were converted through installed SketchUp into 104 parts and 13,988 triangles with materials. The browser does not decode arbitrary native SKP files. Compressed glTF dependencies, external glTF files and OBJ MTL loading are outside current import support.

## 11. Gemini instruction-to-furniture setup

Open **Furniture → AI · Build from instructions**. The service translates text into a bounded furniture specification. The existing deterministic generator builds and validates editable parts from it. Review dimensions, part count, explanation and omitted requests, then click **Add furniture to design**. Unsupported requests should be listed; the service is not an unrestricted natural-language CAD engine and cannot guarantee a perfect interpretation.

The AI supports the eight furniture types, overall dimensions, board thickness, selected materials, fronts and simple compartments. AI kitchen generation currently uses a straight four-module arrangement; use the Furniture builder for richer kitchen layouts. Do not present unverified AI interpretations as manufacturing-ready designs.

### Local keys

Edit **`C:\WorkSpace\Hazzino\.env`**, which is excluded from Git:

```dotenv
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
GEMINI_API_KEY_4=
GEMINI_API_KEY_5=
GEMINI_FURNITURE_MODEL=gemini-3.5-flash-lite
GEMINI_FREE_TIER_CONFIRMED=false
```

Use Google AI Studio to confirm that **every key's project is Free tier** before setting the last field to `true`. The field records the operator's assertion; it does not disable Google billing. Keys cannot reveal billing status to the app. Five keys in one project share project quotas. Current quotas must be inspected in AI Studio, not inferred from old published values.

Run `node scripts/configure-gemini.mjs` from the project root to verify access to the selected model and report its input/output context limits without generating text. The UI's Verify key access does the same. Local configuration is reread on each request. Neither route displays key values.

After verification, `node scripts/configure-gemini.mjs --publish` uploads only Gemini configuration as Cloudflare Worker secrets using Wrangler's existing authenticated account. Local `.env` is not automatically published with the app. This command rejects missing/unverified keys and requires Free-tier confirmation. Do not put API keys in frontend code or `VITE_` variables.

### Demo limits and fallback

The new furniture AI has one shared budget across all five keys: two upstream attempts/minute, a nominal twenty attempts/day, 60,000 reserved tokens/day, 2,000 prompt characters and 3,072 maximum output tokens. Each attempt reserves 6,000 tokens, including failed attempts; therefore the token reserve currently limits use to **ten attempts/day**. The earlier limit wins. UTC day boundaries reset the daily ledger. Local usage is stored in `.data/gemini-demo-usage.json`; the deployed app uses a single global Durable Object budget shared across browsers.

Actual returned input/output/total token counts and the successful slot are recorded. Attempts can fall back for invalid/unavailable keys or transient service responses, within the same caps. Google 429 quota errors stop the request; keys are not rotated to bypass project quota. Network timeouts stop to avoid duplicate retries. No paid-model fallback, search grounding, image generation or agent loop is used.

Zero charges require a genuinely Free-tier Google project. These local caps reduce exposure but cannot turn paid-tier requests into free requests, and they do not govern another application using the same keys. The separate legacy hospital AI extension is not the furniture demo and is not covered by this new token ledger.

Official references: [pricing](https://ai.google.dev/gemini-api/docs/pricing), [project rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## 12. Saving and technical architecture

The local app uses React, Three.js/WebGL, Zustand, Node/Express and MongoDB. `npm run dev` starts localhost:5173 and the API on 3001; without MONGODB_URI a local MongoDB process stores data in `.data/mongo`. Use this installation to demonstrate the supplied brief's MongoDB criterion.

The public deployment uses Cloudflare Workers with SQLite Durable Objects, not MongoDB. Each browser receives an anonymous workspace cookie. Changing browser/domain or clearing cookies can create a separate cloud workspace. Export JSON before transferring devices or clearing browser data.

IndexedDB provides local recovery; project saves and checkpoints provide explicit persistence. Watch the save status. File → Open projects reopens editable designs. Scenes save camera, display and visibility settings. Export JSON for a portable backup.

Geometry uses millimetres, Z-up and local part dimensions/transforms. Manifold provides closed-solid boolean operations. Joint motion and construction checks are separate from rendering, and presets/manual objects share the editor's validation and undo system. WebMCP feature detection exposes validated design reading, board creation and save tools in capable browsers.

## 13. Verification record and boundaries

On 10 September, after this correction pass, **`npm test` passed 112/112 tests**. Coverage includes API persistence/checkpoints, invalid writes, all eight furniture types, rigid fronts and interlocks, sliding/corner arrangements, machining, dimensions, manual cabinet assembly, point snapping, rectangle preview, arcs, offsets, boolean volumes/replacement, imports, recovery, scenes, materials, shortcuts and mock-tested Gemini fallback/limits. The production build completed successfully.

Browser evidence in this pass: created a separate custom swatch, entered `#245ee8`, activated Paint bucket, clicked the rectangle and observed its actual rendered surface change to blue. Earlier browser passes exercised the full manual cabinet sequence, exact snap movement, save/reopen/edit/Undo, furniture generation/opening, machining/offsets, library insertion and sheet calculation. Automated tests are broader than a single demonstration but do not establish exhaustive UI correctness.

All six cloud integration tests passed against the modelling release `9cd7ad1f-52d0-4aea-b672-c9d09d2a28dc`. Browser checks additionally verified layer reassignment, Change finish scrolling and the AI dialog's generation block before Free-tier confirmation. All five supplied keys subsequently passed real model-metadata requests (1,048,576 input / 65,536 output context limits); those are model context sizes, not free usage allowances. All five keys have now been installed as Cloudflare secrets. The subsequent Flash-Lite update passed all seven targeted regression tests and the production build.

Real Gemini generation is verified locally for the specific wardrobe request recorded above. Cloud generation remains unverified and failed with HTTP 404. Mock tests establish fallback/budget behaviour; they are not evidence that every possible model instruction is interpreted correctly or that billing can be verified by an API key. Final deployment/check results are recorded in `CLOUDFLARE.md` and the build log.

Remaining scope limits include connected SketchUp edge/face topology, shared native component definitions, extension compatibility, native SKP/DWG/DXF/IFC round trips, user accounts/collaboration, photorealistic ray tracing, arbitrary automatic tilted planes and full physical simulation. Colour adjustments in non-colour display styles are intentionally hidden. Gizmo move is grid-based; use point-to-point movement for feature alignment. Outer shell is union. No claim of complete SketchUp cloning or automatic fabrication certification is made.

## 14. Troubleshooting during the demonstration

| Symptom | Check |
|---|---|
| Colour appears unchanged | Switch to Shaded with textures/Shaded; check Object versus Face mode; unlock the part; select the intended swatch |
| A global finish changes many parts | Create new colour first, then apply it to the intended selection |
| A rectangle seems edge-on | Check drawing plane and camera; use Right for YZ, Front for XZ, Top for XY |
| Snapping picks the wrong feature | Enable F8, zoom in, clear unwanted axis constraint; use Move point to point rather than the gizmo |
| New board appears beside the model | Automatic separation is enabled; set exact centre coordinates or snap it into the assembly |
| Cutter remains after a boolean | Trim intentionally retains cutters; use Subtract to consume them |
| Follow Me is unavailable | Create a flat profile and connected line/arc path; select suitable inputs in the dialog |
| Door/drawer stops | Inspect the obstruction; open required doors or retract the drawer first |
| Part edits disappear after reconfiguration | Furniture regeneration replaces part shapes; Undo restores them |
| Cloud AI says unconfigured | Local .env keys must be verified and separately published as Worker secrets |
| AI stops on quota/budget | Read the status; do not rotate keys to evade Google project limits |
| Saved project is missing in another browser | Anonymous cloud workspaces differ; transfer with exported JSON |

For judging, use the documented workflows and recorded evidence. Report any failed step as a defect rather than describing it as a working feature.
