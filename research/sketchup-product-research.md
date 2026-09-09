# SketchUp and an Advanced Browser Modeling App

An independent browser application can combine approachable 3D modeling with structured architectural information, quantities, and project outputs. The practical first release should complete one small design workflow reliably. Matching the full SketchUp ecosystem and exceeding it across architecture, general modeling, rendering, and construction delivery is a substantially larger undertaking.

The recommended first workflow is **create a dimensioned room, arrange simple objects, revise dimensions and finishes, inspect quantities and indicative costs, save the project, reopen it, and export a usable result**. Architecture and interiors take priority; general modeling begins with editable primitives and grows into richer geometry tools later.

The deadline is **18:00 India Standard Time on 9 September 2026**. Research began at approximately 16:09; by report assembly, at 16:35, approximately 85 minutes remained. The remaining window includes any further requirements discussion, implementation, and verification. A modest prototype is plausible under tightly controlled scope. A production-ready professional CAD/BIM platform is not a credible same-day promise. The estimates below are engineering judgments, not results from an implemented benchmark.

The current published desktop release index includes SketchUp 2026.2, released on 19 May 2026. Its analysis and collaboration capabilities make older comparisons incomplete. This report uses the current official documentation and distinguishes desktop features, other SketchUp products, extensions, and experimental services.[^1]

The central product recommendation is to keep **design intent** in the project document. A wall should retain its dimensions, identity, material, and relationship to openings. The 3D mesh, plan view, quantities, and exports should be derived from that document. This is a proposed architecture, rather than a claim about SketchUp's internal implementation.

The proposed differentiation is integration and transparency: quantities explain what they include; edits update dependent information; unsupported operations are clearly identified; and saved files preserve editable parameters. These ideas have precedents in SketchUp extensions and competing products. Their combination must earn its value through a demonstrably better workflow, rather than a claim of market novelty.

## 1. SketchUp's modeling foundation

SketchUp's core interaction is drawing connected edges and faces, then modifying them directly. Closing a suitable boundary creates a face; drawing across an existing face can divide it. An application that only inserts and resizes boxes does not reproduce these behaviors.[^2]

| Capability | Existing behavior and product lesson |
| --- | --- |
| Lines and planar shapes | Edges, rectangles, circles, polygons, arcs, and freehand drawing provide construction geometry.[^3] |
| Face creation and splitting | Connected planar edges participate in surfaces; editing connectivity matters as much as displaying triangles.[^2] |
| Push/Pull | Extrudes a selected face or removes volume in supported configurations; supports numerical depth input.[^4] |
| Follow Me | Sweeps a profile along a path; useful for trim, rails, and rotational forms.[^3] |
| Offset | Produces an equidistant outline; important for thickness, borders, and architectural profiles.[^3] |
| Move, rotate, scale, mirror | Supports object and geometry transformations, copying, and arrays.[^3] |
| Solid operations | Outer shell, union, subtract, trim, intersect, and split support solid modeling.[^5] |
| Solid validity | Closed volume is a prerequisite; missing faces and leaking boundaries cause problems.[^5] |
| Inference | Axis directions, parallel/perpendicular alignment, faces, guide points, and midpoints guide placement.[^2] |
| Precision | Numerical measurements, distance and angle tools, and construction guides support accurate modeling.[^3] |
| Surface presentation | Softening, smoothing, and hiding edges help present curved or faceted geometry.[^3] |
| Sections and annotations | Section planes, text, labels, and dimensions support inspection and communication.[^3] |

**Engineering implications.** A full direct modeler needs a geometry representation that records adjacency, boundaries, orientation, and editing context. Its tools must handle incomplete drawings, cancellation, degenerate shapes, repeated operations, and undo. A triangulated render mesh alone does not preserve all of this information.

Snapping also needs its own interaction policy. Grid snapping is a useful first step, but a mature inference system must choose between nearby candidates, provide stable visual feedback, respect the active drawing plane, and support explicit direction locks. Otherwise a tool can look precise while placing points on the wrong surface.

For today's prototype, preserve dimensions on known object types and support a fixed ground plane. Call parameter changes “width,” “height,” and “depth”; do not label a height slider as a complete Push/Pull implementation. General face editing, automatic intersections, and robust arbitrary polygon operations belong after the initial workflow is working.

## 2. Organization, visualization, and interaction

Components distinguish a reusable definition from placed instances. Editing shared geometry updates those instances; changing an instance transform does not necessarily change its siblings. “Make unique” is a meaningful operation, not merely another copy command.[^6]

| Feature family | What SketchUp already provides | Implication for the new app |
| --- | --- | --- |
| Groups and components | Separate reusable geometry and shared definitions.[^6] | Separate identity, definition, and instance transforms. |
| Tags and folders | Visibility organization, filtering, and folder-level control.[^7] | Visibility must not silently alter quantities or saved geometry. |
| Outliner and panels | Object hierarchy, entity information, materials, styles, scenes, and other modeless panels.[^8] | Selection in the viewport and object list must agree. |
| Scenes | Saved model views and selected properties.[^9] | A saved view is not a separate design alternative. |
| Materials | Colors, textures, transparency, PBR properties, and environment-responsive appearance.[^10] | Separate visual appearance from material quantities and pricing. |
| Texture creation | AI-assisted creation of metalness, roughness, normal, and ambient-occlusion maps.[^11] | “AI materials” alone would not differentiate the product. |
| Visual presentation | Styles, material settings, shadows, and environment workflows.[^8][^10] | Begin with readable edges and restrained real-time shading. |
| Site context | Geolocation and terrain provide environmental context for design.[^12] | Local coordinates should remain distinct from geographic coordinates. |
| Photo matching | Camera alignment helps model against suitable photographs.[^13] | A reference image is not automatic reconstruction. |

The useful early interface is a large central viewport, a compact tool strip, an object list, and a property inspector. The selected object should expose editable dimensions and relevant material fields. Camera controls and modeling controls must not compete for the same drag action. Escape cancels an operation, Delete removes a selection, and undo reverses a committed edit.

Prefer consistent selection and numeric input over a large decorative toolbar. A perspective camera is helpful for spatial understanding, while a top orthographic view makes room layout easier. Dimension labels must state their unit. Distances should retain their numerical values when the display unit changes.

A basic browser viewport is technically accessible through existing libraries, but graphics quality is not proof of modeling quality. A realistic-looking room can still have overlapping walls, inaccurate quantities, lost object identities, and broken persistence. The acceptance checks later in this report therefore focus on editing and data integrity.

## 3. Documentation, interoperability, and project delivery

SketchUp's documentation workflow includes LayOut. It supports document setup, model viewports, raster/vector/hybrid rendering choices, dimensions, and export or printing. A screenshot export is useful for review, but it is a different deliverable from a scaled, coordinated drawing sheet.[^14][^15][^16]

| Output or exchange | Established capability | Boundary to preserve |
| --- | --- | --- |
| LayOut sheets | Document pages and configurable model viewport rendering.[^14] | Page scale, viewport scale, and model dimensions are distinct. |
| Dimensions | Dimension formatting, units, and scale handling.[^15] | Visible labels must correspond to model measurements. |
| PDF and images | LayOut exports PDFs and image files.[^16] | Raster images do not provide editable CAD geometry. |
| DWG/DXF | CAD import/export with supported and unsupported entity types.[^17] | Compatibility is entity-specific, not a binary checkbox. |
| IFC | IFC2x3/IFC4 workflows carry geometry and classification information.[^18] | BIM relationships and properties need explicit mapping. |
| GLB | Current SketchUp documentation describes GLB import/export.[^19] | A useful visual bridge, without guaranteed editable parameter history. |
| Revit | Revit Importer is available through specified subscriptions and Windows.[^20] | Native RVT is a substantial integration dependency. |
| Point clouds | Scan Essentials supports modeling with scan context under eligible plans.[^21] | Scan viewing is different from reliable scan reconstruction. |
| Reports | Generate Report aggregates object attributes and exports CSV.[^22] | Quantities and estimates already exist in the baseline ecosystem. |

A realistic longer-term architectural workflow runs from reference data through modeling, documentation, quantity review, client feedback, and revision. Manufacturing introduces further needs: exact solids, tolerances, part organization, fabrication drawings, and machine-specific outputs. These are related workflows, but one small release should not imply complete support for both.

For today, use a native project JSON file for editable data and CSV for any quantity schedule. PNG export can support a visual handoff. GLB is the best next candidate if the basic workflow passes early, since both Three.js and current SketchUp provide relevant tooling.[^19][^23]

The project JSON must be the authoritative editable file. It should include a schema version, units, object identifiers, dimensions, transforms, materials, and applicable relationships. Import should validate its structure before replacing an open project. A screenshot or a GLB cannot be assumed to restore every application-specific parameter.

## 4. Current product family and recent features

The current subscription documentation lists Free, Go, Pro, Pro Scan, Pro Civil Contractor, Pro Advanced Workflows, and Studio. Older comparisons containing only Go, Pro, and Studio are incomplete. Exact availability must be checked against the relevant platform and subscription, rather than inferred from a feature's existence.[^24]

Pro includes desktop modeling, LayOut, web and iPad access, Trimble Connect, Extension Warehouse, professional interchange, and Live Component access. Advanced Workflows adds Scan Essentials, Revit Importer, and Trimble Site Contractor. Specialized capabilities should not be described as universally bundled into every SketchUp edition.[^25][^26]

3D Warehouse is another major part of the baseline: users can search models and materials, browse manufacturer catalogs and collections, and filter by properties such as polygon count and file size. It also supports reference-image search. Replacing this ecosystem involves asset discovery and curation as well as geometry tools; a small starter library is the appropriate first step.[^57]

SketchUp 2026.0 introduced additional model-sharing and review workflows, visualization adjustments, and LayOut drafting improvements. SketchUp 2026.1 added AI-related services, preference migration, guide-point improvements, and PDF import on Windows.[^27][^28]

SketchUp 2026.2 adds Analysis Hub with Advanced Shadows. Annual Illuminance, Daylight Factor, Underlit/Overlit, Direct Sun, and Date & Time analyses are described as Labs features in the release notes. These experimental modes should not be treated as equivalent to a fully established production feature.[^1]

| Area | Existing functionality | What a stronger implementation would need |
| --- | --- | --- |
| AI Render | Viewport and prompt-based imagery with local image refinement tools.[^29] | Explicit separation of visual suggestions from geometric changes. |
| AI Assistant | In-app help and object generation from text or images.[^30] | Reliable, inspectable edits to structured project objects. |
| Claude connector | Generates SKP files and supports conversational iterations; its v1 documentation says it cannot edit or render an existing SKP file.[^31] | Editing an existing native document with validated changes and undo. |
| Collaboration | Sharing, comments, real-time viewing, and model version workflows.[^32] | Clear authorship, permissions, and conflict handling for actual co-editing. |
| iPad scanning | Scan-to-Design uses LiDAR-based outputs and is marked Labs.[^33] | Device-specific capture, accuracy assessment, and editable reconstruction. |

Real-time viewing is not evidence of simultaneous, conflict-safe geometry authoring. Similarly, generating a 3D asset is not evidence of dimensional or construction correctness. These distinctions matter when defining competitive goals.

One documentation inconsistency is particularly relevant: broader overview pages can describe narrower historical subscription availability than recently updated dedicated product pages. This report favors the specific current eligibility pages. It does not reproduce prices, since pricing is not necessary to choose an implementation strategy.

## 5. Extensions and competing products

The competitive baseline is SketchUp plus its ecosystem. Several attractive “new” features are already available through extensions. The following are vendor-documented capabilities; their existence is established, but vendor performance and accuracy claims have not been independently benchmarked here.

| Product | Existing capabilities | Lesson |
| --- | --- | --- |
| Profile Builder | Parametric profiles, assemblies, retained editable openings, and path-based objects.[^34] | Editable walls and assemblies are valuable but established. |
| Quantifier Pro | Length, area, volume, weight, cost reports, and Excel-linked pricing workflows.[^35] | Live quantities and costing need a better user experience to differentiate. |
| OpenCutList | Cut lists, estimates, cutting diagrams, labels, exploded views, and fabrication exports.[^36] | A furniture workflow must eventually address parts and material orientation. |
| PlusDesignBuild | Integrated modeling, estimating, connected plans, scheduling, and procurement-related workflows.[^37] | “End to end” needs an explicit competitive comparison. |
| Sefaira | Building performance analysis through SketchUp-connected workflows.[^38] | Energy or daylight features need real analysis foundations. |
| V-Ray for SketchUp | Photorealistic rendering and animation workflows.[^58] | Real-time viewport shading is an initial presentation layer, not full rendering parity. |
| Rhino and Grasshopper | Broad geometry tools, algorithmic modeling, analysis, and extensibility.[^39] | Procedural geometry and advanced surfaces are separate product investments. |
| Shapr3D | Direct modeling combined with history-based parametric tools.[^40] | Immediate manipulation can coexist with editable design history. |
| Blender Geometry Nodes | Node-based operations on meshes, curves, point clouds, volumes, and instances.[^41] | Procedural systems are powerful but add interaction complexity. |
| Revit schedules | Model-derived schedules and material takeoffs support quantification.[^42] | Model and schedule consistency is an established professional expectation. |

The most defensible initial proposition is therefore **an accessible browser workflow that connects a small set of modeling operations to understandable downstream results**. It should reduce setup and make model consequences visible, with fewer disconnected representations of the same project.

Potential distinguishing qualities include explicit quantity rules, change-by-change quantity differences, per-object provenance, reversible batch edits, and a portable editable document. These are proposed advantages to validate, not claims that no competing product offers them.

Market confidence remains limited: this is a technical and product capability assessment, not customer discovery. Before investing in the full platform, observe architects or interior designers completing one real task and record where time is lost. A few practical workflow trials will be more informative than assuming that a larger feature count creates a better product.

## 6. Added features and feasibility

The categories below are engineering recommendations. “Today candidate” means a restricted implementation is plausible after the basic editor exists; it does not mean every row can fit into the same deadline. “Later” describes practically buildable software, with additional design and verification work.

| Proposed addition | First useful implementation | Assessment |
| --- | --- | --- |
| Structured room objects | Length, width, height, floor, four walls, and room name | Today candidate; highest architectural value |
| Live room metrics | Internal floor area, perimeter, and clear volume | Today candidate; simple formulas with explicit conventions |
| Indicative finish costing | Quantity multiplied by a user-supplied unit rate | Today candidate; limited items and disclosed exclusions |
| Editable primitives | Boxes and cylinders with numerical dimensions | Today candidate; general-modeling foundation |
| Material presets | Local color/roughness presets attached to object IDs | Today candidate; avoid a large external asset library |
| Quantity-to-model selection | Selecting a schedule row highlights its object | Stretch; requires stable identifiers |
| Design alternatives | Duplicate a project snapshot and compare key totals | Stretch; do not confuse camera scenes with alternatives |
| Hosted doors/windows | Opening parameters tied to a particular wall | Later or tightly restricted stretch; geometry and quantity effects must agree |
| Change-impact report | Before/after dimensions, quantities, and affected objects | Later; strong integration opportunity |
| Model health checks | Invalid dimensions, missing references, duplicates, open solids | Basic checks today; general geometry diagnostics later |
| Reliable AI editing | Convert requests to validated commands with preview and undo | Later; depends on a functioning command system and a model provider |
| Reference plan tracing | Import an image, calibrate scale, and trace manually | Later; preferable to claiming automatic accurate reconstruction |
| Smart assemblies | Parameterized cabinets, stairs, roofs, and wall build-ups | Later; implement and test each object family separately |
| Coordinated drawings | Plans/sections with linked dimensions and revision state | Later; hidden-line extraction and annotation persistence add difficulty |
| Clash and clearance review | Bounding-box candidates, followed by geometry checks | Later; approximate intersections are not validated clearances |
| Embodied-carbon scenarios | Quantity times a sourced material factor with stated scope | Later; factor provenance, units, and system boundaries are essential |
| Collaborative editing | Shared project operations, permissions, conflict policy | Later; synchronization libraries do not solve CAD conflicts automatically |
| Fabrication support | Parts, grain, kerf, nesting, tolerances, machine exports | Later; substantial workflow and validation requirements |

The best near-term combination is **structured rooms + live metrics + simple user-entered costing + persistence**. Its value can be demonstrated through a change: increase a room's length, see its geometry and floor area update, revise the finish rate, then reopen the saved project with identical values.

Do not include paid cloud dependencies in today's critical path. AI rendering, object generation, automatic plan reconstruction, and cloud collaboration introduce credentials, latency, service behavior, and additional failure modes. Their integration can be evaluated after the local application has a reliable document model.

## 7. The proposed first-build contract

The first build should be a **single-user local browser prototype**, running from a documented local command, with no account requirement. Its completion criterion is one reproducible project workflow. This is a proposed scope for subsequent implementation; the research deliverable does not itself implement the app.

| Required capability | Acceptance condition |
| --- | --- |
| Start and navigate | App launches locally; orbit, pan, zoom, and reset view work. |
| Create a room | Numeric length, width, and height create a floor and four walls. |
| Edit room dimensions | Geometry and metrics update together; invalid inputs are rejected. |
| Place a simple object | Add a box; select, move, resize, duplicate, and delete it. |
| See a top view | Orthographic plan view and perspective view show the same document. |
| Organize basic objects | Object list and viewport selection stay synchronized. |
| Apply a finish | A small local material palette changes the intended object. |
| Inspect metrics | Floor area, perimeter, and room volume use documented conventions. |
| Enter a unit rate | A limited finish subtotal updates from the model quantity. |
| Undo and redo | A committed dimension, transform, or deletion operation is reversible. |
| Save and reopen | Export and import native project JSON without losing editable values. |
| Export a result | Quantity CSV or viewport PNG can be opened outside the app. |

Even this is an ambitious target for the remaining time from an empty application workspace. If implementation starts late or encounters setup problems, reduce the contract to one parametric room, a few simple objects, metrics, save/reopen, and one export. The reduced result must be described as a prototype, not a finished CAD package.

Exclude general face-level Push/Pull, arbitrary polygon splitting, robust freeform booleans, full sketch constraints, multi-storey BIM relationships, native SKP/RVT/DWG compatibility, production drawing sets, manufacturing accuracy certification, and multi-user collaboration from today's commitment.

Doors and windows should only be included if they are actual openings with matching geometry and quantity deductions. If represented as visual placeholders, label them as such and do not deduct them from construction quantities. For a credible first version it is better to defer openings than produce contradictory model and estimate data.

The interface should show only working tools. Each unfinished feature belongs in a roadmap document or clearly identified preview area. A click-through screen with inactive toolbar icons is not evidence that the feature exists.

## 8. Architecture and data model

Use a TypeScript application with a lightweight UI layer and Three.js rendering. A React/Vite setup is a reasonable implementation choice, but the exact framework is less important than separating project data from rendering. Three.js provides extrusion geometry, object transform controls, and glTF export; application-specific editing logic still has to be built.[^43][^44][^23]

**Recommended data flow:** input -> validated command -> project document -> geometry, views, quantities, and serialization. Every meaningful change passes through this path. The viewport should not become the only place where the project's state exists.

| Layer | Responsibility |
| --- | --- |
| Project document | Schema version, canonical units, entity IDs, parameters, relationships, materials, and saved views |
| Command layer | Create, edit, transform, duplicate, delete, undo/redo, and input validation |
| Geometry adapters | Generate render meshes from known objects; later support a solid-modeling kernel |
| View layer | Cameras, selection highlights, navigation, gizmos, and dimension annotations |
| Quantity engine | Pure calculations from parameters and documented inclusion rules |
| Persistence | Validate, serialize, save, restore, and migrate document versions |
| Export adapters | Project JSON, CSV, PNG, and later GLB, drawing, and BIM adapters |

For the first room, store internal clear length and width, wall height, and wall thickness explicitly. Walls can be derived from that room definition. If individual wall editing is introduced later, the design must define whether the room or its walls own the boundary. Competing ownership would cause inconsistent updates.

Store coordinates and dimensions in one canonical unit, preferably meters, using ordinary double-precision numbers for application calculations. Convert for display and export. Snapping tolerance, numeric comparison tolerance, and displayed precision are different policies. A rounded dimension label must not silently round the stored geometry.

Store object identity independently from a render-mesh UUID. A regenerated mesh must remain associated with the same document object, quantity row, selection, and undo history. Material identity should also survive rebuilding a room.

Browser storage is useful for recovery, but IndexedDB and related storage are subject to browser storage management and possible quota failures. Explicit downloadable project files should remain available, and saving errors must be shown rather than silently ignored.[^45]

For later geometry workers, discard stale computation results when newer edits supersede them. Separate camera motion from document edits; avoid creating undo entries for every pointer movement. Commit a drag as a single edit and make cancellation restore the original state.

## 9. Geometry engines, interchange, and dependencies

The fastest route today is parameterized mesh generation. A box or room can be rebuilt from a small set of dimensions. Three.js documents that changing an ExtrudeGeometry parameter object after construction does not update the geometry automatically, so regeneration must be deliberate.[^43]

| Option | Suitable role | Recommendation |
| --- | --- | --- |
| Three.js | Rendering, navigation, picking, primitive/extruded meshes, transforms | Use for the initial viewport and controlled geometry. |
| Manifold | Robust solid operations on valid manifold meshes, with WebAssembly support | Evaluate after the core workflow; validate input conditions.[^46][^47] |
| Open CASCADE / OpenCascade.js | Surface and solid modeling with a browser-accessible WASM route | Candidate for richer CAD; allow time for integration and geometry tests.[^48][^49] |
| web-ifc | Reading and writing IFC in JavaScript/WASM | Useful future adapter; not a complete BIM authoring application.[^50] |
| IfcOpenShell | IFC processing, geometry, validation, and related utilities | Candidate for a later local service or server workflow.[^51] |
| SketchUp C API | Native SKP reading/writing with platform build requirements | Not a direct drop-in browser library; defer integration.[^52] |
| Yjs | Shared data types for collaboration | A future transport/state building block; define semantic conflict rules first.[^53] |

Manifold's documented guarantees depend on appropriate inputs. It does not make arbitrary imported meshes valid or remove the need to handle failures. Similarly, selecting a full CAD kernel does not automatically deliver a sketch solver, intuitive editing, persistent face references, or a robust undo system.[^47]

**Interchange priorities.** Native JSON preserves application parameters. CSV carries tabular quantities. PNG communicates a view. GLB carries visual scene data and materials, but is not a substitute for the application document. Its container should not be described as automatically compressing all geometry or textures; glTF compression capabilities are separate matters.[^54]

SVG or a restricted DXF exporter can later support simple plan linework. Full DWG and RVT support require an appropriate conversion route and representative compatibility tests. IFC needs explicit building hierarchy, placement, classification, and property mapping. STEP becomes relevant if exact solid modeling and manufacturing become central.

The examined repositories identify Three.js as MIT, Manifold's WASM package as Apache-2.0, OCCT as LGPL-2.1 with its stated exception, OpenCascade.js as LGPL-2.1, and web-ifc as MPL-2.0.[^55][^56][^48][^49][^50] Before distribution, check the actual pinned packages and their notices. Open-source availability is not evidence that a library is integration-free or that its license conditions can be ignored.

## 10. Verification and quantity conventions

The first release must demonstrate behavior with a small explicit example. Use a room with internal dimensions **5 m by 4 m**, height **3 m**, and separately recorded wall thickness. Its internal floor area is **20 square meters**, perimeter **18 m**, and clear room volume **60 cubic meters**. Internal wall-face area before openings is **54 square meters**. These calculations describe a geometric convention, not a complete construction takeoff.

Changing the internal length to 6 m must yield 24 square meters, 20 m perimeter, 72 cubic meters, and 60 square meters of internal wall-face area. Undo should restore the original values; redo should reproduce the changed values. Save and reopen must preserve whichever state was saved.

For an illustrative floor finish rate of 100 currency units per square meter, the 20-square-meter room has a finish-only subtotal of 2,000. At 24 square meters it is 2,400. These are deliberately invented test rates, not market prices. If a 10% waste factor is implemented, distinguish the geometric area from the purchasing quantity: 20 square meters becomes 22 square meters for the stated calculation.

| Test | Failure that must be detected |
| --- | --- |
| Numeric editing | Empty, negative, zero, non-numeric, or non-finite dimensions corrupt the scene. |
| Save/reopen | IDs, units, dimensions, materials, or quantities change unexpectedly. |
| Undo sequence | Create, resize, move, duplicate, and delete cannot be reversed consistently. |
| Selection | A schedule/list item points at a different object after regeneration. |
| View changes | Switching camera modes changes model coordinates or measurements. |
| Invalid import | Malformed JSON destroys the current unsaved document. |
| Export | File is empty, cannot be reopened, or contains stale totals. |
| Visibility | Hiding a wall silently removes it from a reported quantity. |
| Interaction | Orbiting accidentally moves an object or a drag creates hundreds of undo steps. |
| Persistence failure | Storage error is shown, with file download still available. |

If hosted openings are added, test a 0.9 m by 2.1 m door: its rectangular area is 1.89 square meters. Only deduct it from the intended wall-face scope. Reject an opening larger than its host or placed beyond its boundary. Thickness, returns, frames, shared walls, and overlapping openings require additional conventions.

Basic verification should include a real browser walkthrough and reopening exported files, not just a successful build command. Record the test machine/browser and the actual scene used. No frame-rate, large-model capacity, geometry tolerance, or cross-browser reliability claim should be published until it has been measured.

## 11. Deadline plan and scope control

This schedule is an illustrative **75-minute implementation allocation**, not a guarantee. It requires immediate agreement on the narrow contract, functioning dependencies, and no substantial redesign. The final start time determines whether it fits before 18:00.

| Elapsed time | Work | Exit condition |
| --- | --- | --- |
| 0-10 minutes | Scaffold, viewport, cameras, and a minimal document | App runs and shows document-derived geometry. |
| 10-30 minutes | Parameterized room, box objects, selection, numeric edits | Create and revise the small example project. |
| 30-45 minutes | Command history, metrics, limited finish costing | Geometry, values, and undo remain consistent. |
| 45-55 minutes | Save/load and one export | Reopened file preserves editable state. |
| 55-75 minutes | Browser verification and fixes | Required example passes; limitations documented. |

Implement persistence early enough to expose state-model mistakes. The allocation groups work by emphasis; it does not mean saving should be bolted on after all modeling code is finished.

If only 45-60 minutes remain, use numeric object placement and dimensions, one room generator, one camera mode plus reset, metrics, project save/reopen, and one export. Defer transform gizmos, additional primitives, material libraries, and costing if they jeopardize persistence or the example workflow.

Drop stretch features in this order: AI; collaboration; native CAD imports; rendering polish; general booleans; hosted openings; design alternatives; additional assets. Preserve numerical editing, honest quantities, a usable local launch path, and save/reopen. If these cannot pass, label the result incomplete rather than counting interface elements as delivered features.

The underlying uncertainty is that the workspace had no application scaffold at the initial inspection. Library availability reduces the rendering work, but integration and debugging can consume most of a short deadline. More features become feasible through subsequent milestones, not by assuming all independent estimates can be added without integration cost.

## 12. Longer-term product direction

The platform should grow through complete workflows. A useful order is controlled conceptual modeling, architectural objects and documentation, interoperability and advanced geometry, then collaboration and specialized analysis. Each milestone should have a representative project and a measurable completion test.

| Milestone | Product capability | Evidence needed before claiming completion |
| --- | --- | --- |
| Concept editor | Rooms, primitives, reliable editing, quantities, files | Users complete a small interior layout and reopen it. |
| Architectural modeler | Hosted openings, connected walls, levels, roofs, stairs | Revisions preserve relationships and consistent quantities. |
| Documentation | Scaled plans, elevations, sections, schedules, annotations | Geometry revisions update the intended drawings without orphaned dimensions. |
| General CAD | Sketch constraints, richer solids, surfaces, robust operations | Representative geometric edge cases pass and failures preserve the document. |
| Interoperability | IFC and selected CAD/mesh adapters | Import/export fixtures verify geometry, units, identity, and supported metadata. |
| Review and collaboration | Comments, versions, permissions, shared editing | Concurrent conflicting edits have an explicit, tested resolution policy. |
| Assisted design | AI commands, rule checks, alternatives, change explanation | Suggested operations are inspectable, reversible, and geometrically validated. |
| Delivery tools | Cost assemblies, procurement, fabrication, performance analysis | Domain-specific conventions, external data, and output requirements are validated. |

An advanced AI assistant should operate on the same commands as the UI. “Make this room one meter longer” should resolve the target, validate units, preview affected information, and commit one undoable change. Generated code should not directly mutate arbitrary project state. If no model service is configured, the feature should say so rather than simulate successful AI work.

A future model-health panel can flag unresolved hosts, invalid dimensions, duplicate IDs, missing materials, and stale derived output. General non-manifold diagnostics and geometry repair require separate kernel-aware implementation. Building-code compliance, structural adequacy, and accurate energy modeling cannot be inferred from generic dimensional checks.

The most important unresolved choices for the full product are the primary paying user, the boundary between architecture and mechanical CAD, required import formats, drawing fidelity, supported hardware, collaboration needs, and acceptable external-service dependencies. They do not block the small local prototype, but they substantially affect the long-term architecture.

This assessment is grounded in official documentation and original project/vendor sources accessed on 9 September 2026. It does not claim hands-on testing of SketchUp 2026.2, private knowledge of SketchUp's code, independent validation of vendor marketing claims, or demonstrated performance of an application that has not yet been implemented. Build estimates and proposed differentiators are explicitly analytical judgments.

## Sources

The numbered references serve as linked source notes. Dates are publication/update dates where shown; otherwise the source is undated and was accessed on 9 September 2026. Repository references describe the inspected documentation, not a pinned dependency release.

[^1]: Trimble. [SketchUp Desktop 2026.2](https://help.sketchup.com/en/sketchup-desktop-20262). 19 May 2026. Current features and Labs distinctions.
[^2]: Trimble. [Introducing Drawing Basics and Concepts](https://help.sketchup.com/en/sketchup/introducing-drawing-basics-and-concepts). Updated 21 August 2026. Connectivity and inference.
[^3]: Trimble. [Drawing Lines, Shapes, and 3D Objects](https://help.sketchup.com/en/sketchup/drawing-lines-shapes-and-3d-objects). Updated 21 August 2026. Core tool inventory.
[^4]: Trimble. [Pushing and Pulling Shapes into 3D](https://help.sketchup.com/en/sketchup/pushing-and-pulling-shapes-3d). Updated 21 August 2026. Extrusion and numerical input.
[^5]: Trimble. [Modeling Complex 3D Shapes with the Solid Tools](https://help.sketchup.com/en/sketchup/modeling-complex-3d-shapes-solid-tools). Updated 21 August 2026. Solids and operations.
[^6]: Trimble. [Components](https://help.sketchup.com/en/sketchup/components). Updated 21 August 2026. Definitions and instances.
[^7]: Trimble. [Controlling Visibility with Tags](https://help.sketchup.com/en/sketchup/controlling-visibility-tags). Updated 21 August 2026. Visibility and organization.
[^8]: Trimble. [Dialog Boxes and Trays](https://help.sketchup.com/en/sketchup/dialog-boxes-and-trays). Updated 21 August 2026. Model panels.
[^9]: Trimble. [Creating Scenes](https://help.sketchup.com/en/sketchup/creating-scenes). Accessed 9 September 2026. Saved views and properties.
[^10]: Trimble. [Materials, Textures, and Environments](https://help.sketchup.com/en/sketchup/adding-colors-and-textures-materials). Updated 21 August 2026. PBR and environments.
[^11]: Trimble. [Generate Textures](https://help.sketchup.com/en/sketchup/ai-materials). Updated 21 August 2026. AI texture-map generation.
[^12]: Trimble. [Geolocation and Terrain](https://help.sketchup.com/en/sketchup/modeling-terrain-and-other-rounded-shapes). Updated 21 August 2026. Site context.
[^13]: Trimble. [Photo Matching](https://help.sketchup.com/en/sketchup/matching-photo-model-or-model-photo). Updated 26 August 2026. Camera-aligned modeling references.
[^14]: Trimble. [Document Setup](https://help.sketchup.com/en/layout/document-setup). Updated August 2026. LayOut rendering and document settings.
[^15]: Trimble. [Marking Dimensions](https://help.sketchup.com/en/layout/marking-dimensions). Updated August 2026. Dimension scales and units.
[^16]: Trimble. [Exporting or Printing Your LayOut Document](https://help.sketchup.com/en/layout/exporting-or-printing-your-layout-document). Updated 27 August 2026. PDF, images, CAD, and printing.
[^17]: Trimble. [Importing and Exporting CAD Files](https://help.sketchup.com/en/sketchup/importing-and-exporting-cad-files). Updated 21 August 2026. DWG/DXF entity support.
[^18]: Trimble. [Importing and Exporting IFC Files](https://help.sketchup.com/en/importing-and-exporting-ifc-files). Updated 21 August 2026. IFC versions and properties.
[^19]: Trimble. [Working with GLTF Files](https://help.sketchup.com/en/sketchup/working-gltf-files). Updated 21 August 2026. GLB interchange.
[^20]: Trimble. [Importing a Revit File](https://help.sketchup.com/en/revit-interoperability/revit-to-sketchup). Updated 21 August 2026. Windows and subscription eligibility.
[^21]: Trimble. [Getting Scan Essentials](https://help.sketchup.com/en/scan-essentials-sketchup/getting-scan-essentials). Updated 21 August 2026. Eligibility and platform.
[^22]: Trimble. [Using SketchUp's Generate Report Service](https://help.sketchup.com/en/sketchup/generate-report). Accessed 9 September 2026. Attribute aggregation and CSV.
[^23]: Three.js contributors. [GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html). Undated. Export capabilities.
[^24]: Trimble. [Subscription Plans](https://help.sketchup.com/en/admin/subscriptions). Updated 7 September 2026. Product family.
[^25]: Trimble. [SketchUp Pro](https://help.sketchup.com/en/admin/sketchup-pro). Updated 21 August 2026. Included products.
[^26]: Trimble. [SketchUp Pro Advanced Workflows](https://help.sketchup.com/en/sketchup-pro-advanced-workflows). Updated 7 September 2026. Specialized workflows.
[^27]: Trimble. [SketchUp Desktop 2026.0](https://help.sketchup.com/en/release-notes/sketchup-desktop-20260). 7 October 2025. Release changes.
[^28]: Trimble. [SketchUp Desktop 2026.1](https://help.sketchup.com/en/sketchup-desktop-20261). 9 December 2025. AI and import changes.
[^29]: Trimble. [AI Render](https://help.sketchup.com/en/sketchup-ai-render). Updated 21 August 2026. Image generation and refinement.
[^30]: Trimble. [AI Assistant](https://help.sketchup.com/en/ai-assistant). Updated 1 September 2026. Help and object generation.
[^31]: Trimble. [SketchUp Connector for Claude](https://help.sketchup.com/en/sketchup-claude-connector). Updated 21 August 2026. File generation and v1 limitations.
[^32]: Trimble. [Connect and Collaborate](https://help.sketchup.com/en/connect-and-collaborate). Updated 7 September 2026. Sharing, viewing, comments, and versions.
[^33]: Trimble. [Scan-to-Design (SketchUp Labs)](https://help.sketchup.com/en/sketchup-ipad/scan-design-sketchup-labs). Updated 21 August 2026. iPad LiDAR workflow.
[^34]: mind.sight.studios. [Profile Builder features](https://profilebuilder4sketchup.com/features/). Undated. Parametric profiles and assemblies.
[^35]: mind.sight.studios. [Quantifier Pro](https://extensions.sketchup.com/extension/d957b024-d6ee-4534-a4d8-194b91ecf8e5/quantifier-pro). Accessed 9 September 2026. Quantity and cost reports.
[^36]: L'Air du Bois. [OpenCutList](https://extensions.sketchup.com/extension/00f0bf69-7a42-4295-9e1c-226080814e3e/0). Accessed 9 September 2026. Woodworking outputs.
[^37]: RubySketch. [PlusDesignBuild](https://plusspec.com/plusdesignbuild/). Undated. Integrated design and estimating workflows.
[^38]: Trimble. [Extending SketchUp](https://help.sketchup.com/en/extending-sketchup). Updated 21 August 2026. Sefaira and related products; dedicated product pages take precedence for eligibility.
[^39]: Robert McNeel & Associates. [Rhino Features](https://www.rhino3d.com/features/). Undated. Geometry, analysis, and Grasshopper.
[^40]: Shapr3D. [Direct vs Parametric](https://support.shapr3d.com/hc/en-us/articles/14030415438748-Direct-vs-Parametric). Updated 30 July 2024. Direct and history-based modeling.
[^41]: Blender Foundation. [Geometry Nodes Introduction](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/introduction.html). Undated. Procedural geometry.
[^42]: Autodesk. [Schedules](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-F50D6FF4-859E-43A2-A2F6-81C84A1BA0EB.htm). Revit 2025 documentation. Schedules and material takeoffs.
[^43]: Three.js contributors. [ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html). Undated. Geometry generation and parameter behavior.
[^44]: Three.js contributors. [TransformControls](https://threejs.org/docs/pages/TransformControls.html). Undated. Object transforms and snapping.
[^45]: MDN contributors. [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Accessed 9 September 2026. Browser persistence limits.
[^46]: Manifold contributors. [Manifold repository](https://github.com/elalish/manifold). Accessed 9 September 2026. Geometry and WASM implementation.
[^47]: Emmett Lalish and contributors. [Manifold Library](https://github.com/elalish/manifold/wiki/Manifold-Library). Accessed 9 September 2026. Validity conditions and robustness.
[^48]: Open Cascade SAS. [Open CASCADE Technology](https://github.com/Open-Cascade-SAS/OCCT). Accessed 9 September 2026. CAD services and licensing.
[^49]: OpenCascade.js contributors. [OpenCascade.js](https://github.com/donalffons/opencascade.js). Accessed 9 September 2026. JavaScript/WASM port and license.
[^50]: That Open Company. [web-ifc](https://github.com/ThatOpen/engine_web-ifc). Accessed 9 September 2026. IFC read/write and license.
[^51]: IfcOpenShell contributors. [IfcOpenShell documentation](https://docs.ifcopenshell.org/). Accessed 9 September 2026. IFC processing and validation.
[^52]: Trimble. [SketchUp C API](https://extensions.sketchup.com/developers/sketchup_c_api/sketchup/index.html). Generated May 2026. Native SKP integration requirements.
[^53]: Yjs contributors. [Yjs](https://github.com/yjs/yjs). Accessed 9 September 2026. Shared data types.
[^54]: Khronos Group. [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html). Accessed 9 September 2026. Scene and container format.
[^55]: Three.js contributors. [Three.js License](https://github.com/mrdoob/three.js/blob/dev/LICENSE). Accessed 9 September 2026. MIT license.
[^56]: Manifold contributors. [WASM package metadata](https://github.com/elalish/manifold/blob/master/bindings/wasm/package.json). Accessed 9 September 2026. Apache-2.0 package license.
[^57]: Trimble. [Searching for Models and Materials](https://help.sketchup.com/en/3d-warehouse/searching-and-downloading-models). Updated 21 August 2026. Warehouse search, catalogs, and filtering.
[^58]: Chaos. [Getting started with V-Ray for SketchUp](https://www.chaos.com/vray/sketchup/getting-started). Undated. Rendering and animation workflows.
