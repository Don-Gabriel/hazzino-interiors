# Build log

All times are India Standard Time on 9 September 2026. This file records the build steps, decisions, checks, and corrections. Supporting research is in `research/sketchup-product-research.md`.

## 16:45 - Build authorized

1. Received authorization to build the local browser application, use the attached `Hackathon - Sketchup.docx` as a brief, and record every build step separately.
2. Checked the clock: approximately 75 minutes remained before 18:00.
3. Inspected the workspace. It contained research artifacts and Ruflo state, with no application scaffold.
4. Loaded document-reading and browser-app building instructions and located the bundled runtime dependencies.
5. Began extracting the DOCX contents into `research/hackathon-brief-extracted.txt`. Document contents are requirements/reference material; direct user instructions control the task.

## 16:49 - Requirements and application scaffold

6. Read the complete extracted brief. The initial extraction succeeded; only console Unicode printing failed, resolved by reading the UTF-8 file directly.
7. Mapped mandatory scope: React/Three.js editor, accurate board modelling, transforms, snapping, material assignment, cameras, wardrobe demonstration, saving/reopening, and MongoDB.
8. Selected a custom Vite/React + Express application to match the requested MERN architecture and explicit local-only preference. No cloud deployment or account registration is needed.
9. Created package scripts, frontend entrypoint, development proxy, ignore rules, and database environment example. Started dependency installation, including a local MongoDB runtime.
10. Chosen visual direction: light drafting canvas, dark forest navigation, warm wood materials, compact CAD controls, and contextual properties.

## 16:55–17:21 - Interactive editor and first build

11. Installed React, Three.js, Zustand, Express, MongoDB driver/runtime, Vite, and Lucide; npm audit reported zero vulnerabilities.
12. Added the canonical millimetre project schema, validation, materials, component generators, and quantity calculations.
13. Added transactional undo/redo, selection/group operations, JSON recovery, autosave, and API saving.
14. Implemented the local Express project/version API. Started downloading the MongoDB binary for durable WiredTiger storage in .data/mongo.
15. Implemented the Three.js viewport, drawing planes, snapping candidates, rectangles/profiles, push/pull, transforms, camera presets, dimensions, material grain, shadows, section cuts, and mesh/image exports.
16. Connected the editor layout, hierarchy, properties, materials, library, keyboard shortcuts, and basic creation dialogs.
17. Corrected a patch-format rejection during UI writing by applying a single update operation to the existing file. No file changes occurred from the rejected patch.
18. Started the retained development server at http://127.0.0.1:5173 and initiated the first production compile.

## 17:22–17:33 - Persistence, production tools, and verification

19. First HTTP preview request returned 200; opened the existing preview in Codex. Its browser tab ID is 1 (http://127.0.0.1:5173/).
20. Completed project browser, JSON import/export, named MongoDB checkpoints, array/mirror/alignment dialogs, material estimates, and local dimension-command generation.
21. MongoDB 7.0.14 download failed after a network reset and DNS errors. Detected an already cached 8.2.6 binary and switched to it. Health endpoint now reports MongoDB connected.
22. Corrected profile resizing, line transforms, removed a deprecated Three.js shadow constant, improved rotated box snap coordinates, and added selected-face highlighting.
23. Added feature-detected WebMCP read/create/save tools. No supported browser WebMCP validation interface is exposed; browser registration is not claimed as verified.
24. Added and ran 21 checks covering exact 18 mm extrusion, rotated extrusion, invalid geometry, wardrobe assembly dimensions, room dimensions, quantities, rotated snapping, collision bounds, history atomicity, locking, CSV escaping, MongoDB save/reopen/checkpoints/delete, and origin rejection. All 21 passed.
25. Added true rectangular door/window cutouts with matching quantity deductions, model health checks, alignment using rotated bounds, vector plan export, and a printable material-estimate report.
26. Recompiled successfully after integrating the added architecture and production features.

## 17:35–17:49 - Final refinements and delivery preparation

27. Added per-project browser recovery archives so changing projects preserves the previous local design.
28. Added mesh tests for actual opening volume and ray passage, report escaping, and profile resize consistency. All 26 checks passed.
29. Refined snap inference to use real rotated box edges and added numerical edge inspection. Restricted rectangle/profile inference to the chosen drawing plane.
30. Corrected the temporary face-thickness offset so a new 18 mm extrusion begins exactly on its source plane.
31. Made dimension anchors proportional to object dimensions so annotations follow resizing. Added a regression test; all 27 checks passed.
32. Removed internal partition faces from wall-opening meshes, rejected degenerate profiles and complete wall removal, and preserved current transforms in mesh exports.
33. Added model-tool contract checks using a simulated registry, additional opening-surface checks, and strict geometry validation. All 30 tests passed; real browser WebMCP support remains unverified.
34. Installed Prettier and formatted the application, API, shared functions, tests, scripts, and documentation.
35. Created README.md, architecture documentation, feature coverage, verification notes, a Windows launch script, and portable demonstration projects.
36. Seeded two named demonstration projects into MongoDB. Verified the 16-part wardrobe remained available after API/database restarts, and confirmed the persistent WiredTiger data files.
37. Added a glazed study window to the room demonstration, CSV formula-prefix protection, camera-up preservation for saved views, and convex-hull SVG footprints for rotated boxes.
38. The Sites build wrapper failed because its Windows npm shim resolved npm-cli.js under the workspace. The actual application build succeeded using npm.cmd run build; no application compiler error occurred.
39. One demo-seeding request coincided with a watcher restart and received ECONNREFUSED. Rechecked database readiness, reran seeding successfully, and reran all 30 tests successfully.
40. Final production compilation succeeded. The local frontend and MongoDB API remain running for use. Preparing the source archive and local Git baseline.

## 17:53 - Completed local handoff

41. Created local Git baseline fdcb8bb with the application, examples, research, tests and documentation. No remote publication occurred.
42. Created output/Hazzino-Studio-source.zip from tracked source and verified that the launch documentation, build log, frontend, backend, lockfile and demonstration files are present.
43. Final HTTP checks returned 200 for both the Vite preview and compiled application endpoint. MongoDB health is true. The working tree was clean after the application commit.
44. Recorded the build summary, server URLs, tests, artifacts and limitations in the existing Hazzino workspace memory.
45. Finalized this log and refreshed the source bundle for handoff before 18:00 IST. The app remains running; README.md and documentation/FEATURE-COVERAGE.md distinguish delivered features from future CAD/BIM work.

## 18:00–18:18 IST — keyboard verification and hospital extension

46. Implemented centralized keyboard routing, editable-text safeguards, model cut/copy/paste, function keys, numpad camera controls, and an Edit menu. Added five shortcut tests.
47. Browser-tested exact 18 mm extrusion, numeric resizing, walnut material, duplicate/undo/redo, grouping, nudging, physical numpad view changes and shortcut help. Verified clipboard operations through the Edit menu; browser automation intercepts native clipboard chords, so those physical chords remain a manual check.
48. Fixed stale save status after project loading, visible validation errors, narrow-viewport camera fitting and drawing-plane controls.
49. Read the user's hospital brief. Accepted the revised hard stop of 18:20 IST. Bounded hospital generation to editable patient rooms and wards, beds, cabinets and IV stands.
50. Added server-side Gemini structured-plan generation, safe environment-file loading on each request, input/schema checks, quota messages, one-request concurrency, six starts/minute and a 45-second timeout. Created .env without overwriting an existing file.
51. Added semantic hospital assemblies, deterministic layout/reflow, room bounds, bounding-box collision, central strip obstruction and floor/ceiling checks. Corrected the assembly-bounds aggregation during testing.
52. Added AI preview/apply workflow, current-layout validation, downloadable reports and token usage ledger. Corrected report download argument order. Medical equipment is excluded from generic board-cost estimates and labeled accordingly.
53. Checked official Gemini pricing/token documentation. Wrote documentation/JURY-DEMO.md with demo steps, real scope, limitations, token accounting, free versus paid operation and production billing work still required.
54. All 40 automated tests passed, including five new hospital/Gemini contract tests. Production compilation passed. Mock provider tests do not constitute live Gemini verification.
55. Browser verified the 36-object local hospital template, successful geometry checks, clear missing-key error, applying the layout and saving it to MongoDB. The user API key was not present at verification; no live AI success is claimed.
56. Final formatting triggered the development watcher while two API tests ran; those checks saw MongoDB starting. Rechecked health after startup and reran the complete suite: 40/40 passed. Production build passed.
57. Finalized jury notes and source archive before the 18:20 IST hard stop. The app remains running locally; Gemini key entry is the remaining prerequisite for live provider verification.

## 18:22 live API check

58. Detected the user-provided Gemini key without displaying it. Added wardrobe dimension/room-corner intent support and a visible prompt example; wardrobe placement preserves the current room and checks its envelope.
59. Browser submitted the actual wardrobe request to Gemini. The configured gemini-2.5-flash-lite endpoint returned HTTP 404; therefore live generation did not succeed and wardrobe AI is not verified. Existing 40 tests and production build pass, but do not establish live model availability. The final result check completed after 18:22; no further feature implementation continued.
60. Confirmed the existing backend listens on 127.0.0.1:3001 and frontend on 127.0.0.1:5173. Left both running and provided numbered PowerShell terminal commands with port checks to avoid duplicate servers. MongoDB is started by the backend; no separate database terminal is required.
61. Verified the user's key against Google's model-list endpoint (HTTP 200), then tested generation. Google explicitly returned 404 because Gemini 2.5 Flash-Lite and Flash are no longer available to new users; model listing alone did not establish generation access.
62. Tested gemini-3.5-flash-lite successfully using the actual structured-plan request, then updated only GEMINI_MODEL in .env. The secret was never displayed. Updated .env.example for future setup.
63. Verified the running app's /api/ai/generate endpoint: HTTP 200, wardrobe 1200 x 600 x 2100 mm in back-right room corner, 20 objects (4 room + 16 wardrobe), 20 mm wall clearance. Provider reported 461 tokens, persisted in MongoDB. This supersedes earlier statements that live Gemini was unverified. Paid-price estimate is unavailable for the new model until its rates are configured; no price is guessed.

## 10 September 2026 — furniture studio

64. Continued the user's authorized web-app development, then narrowed the product focus to kitchens, wardrobes, desks, TV units, lofts, shoe racks and similar furniture as requested.
65. Added a Manifold geometry kernel, real Offset/subdivision editing, signed face Push/Pull, solid booleans, Follow Me, model imports and custom material groups. Converted all eight user-provided SKP samples through the installed SketchUp Ruby API without modifying source files.
66. Built the parametric furniture studio, moving front mechanisms, nested assembly handling, kitchen corners/worktop cutouts, panel drilling/pockets, cut lists, hardware schedules, drawings and guillotine sheet layouts. Added large-project IndexedDB recovery.
67. Verified 90 automated tests, six local Cloudflare integration tests, browser workflows, production build and deployment dry run. Updated the Sharp transitive dependency to 0.35.4; npm audit reports zero vulnerabilities. Detailed evidence and remaining limits are in documentation/FURNITURE-VERIFICATION.md and documentation/FURNITURE-STUDIO.md.
68. Installed the 14 official Cloudflare skills and registered five Codex MCP servers from the user-provided Cloudflare setup instructions. Four authenticated servers completed OAuth; the docs server is public. Wrangler is authenticated to the user's account. The earlier preview Worker is not present in that account, so the current release targets the authenticated account explicitly.
69. Pushed the furniture implementation and machining-record validation to GitHub (`8464c0b`, `c963a9d`) and deployed the regular account Worker at https://hazzino-interiors.hazzino-studio.workers.dev before 2:01 pm IST. Final Worker version: `a2c3fd16-325f-40a9-adba-8a293ac745b4`. All 91 ordinary tests and six public Cloudflare integration tests pass.
70. On the live site, generated and saved a 75-part sliding wardrobe, calculated its cut list and nine-sheet layout, then used the machining dialog to cut eight through holes in a separate panel. Saved/reloaded all 76 objects and verified the mesh and machining record, with no observed console errors. Documented the current URL, origin-specific storage, Cloudflare setup and remaining SketchUp/manufacturing limits.
71. Corrected furniture interference after the user's screenshots: rigid swept hinge/slide motion, both-door drawer interlocks, reverse closing obstruction, left/right sliding access, enclosed front setbacks/spacers, front-edge pivots, double-door reveal validation, foot/plinth and desk-leg clearance. New furniture and model imports default to separated insertion.
72. Added manual hinge/slide assignment and individual joint controls, a whole-project clearance audit with closed-solid confirmation for shaped geometry, and rejection of shearing/jointed assembly scaling. The builder blocks inaccessible sliding drawer layouts and provides a two-compartment correction.
73. Verified 100 ordinary tests and six local Cloudflare integration tests. Browser checks confirmed both-door interlocking, blocked door closure, manual rigid hinge operation without dimension changes, and sliding layout validation/repair. Documented the geometric scope, preserved old-project edits, and limits of reference fittings and structural simulation.
74. Pushed `3810c17` and published the clearance correction at approximately 2:47 pm IST, version `8f6a7a59-9b1b-46ea-bbc5-d234c170b7eb`. All six public Cloudflare integration tests passed. Created and saved an isolated corrected 93-part demonstration, verified blocked door closure and a clean full clearance audit on the live site, with no console errors or warnings.
75. Read the user's complete Hackathon - Sketchup.docx. Added point-to-point component movement with source/destination feature snaps, live preview, axis constraints, cancellation and Undo. Improved endpoint priority and line midpoint/edge/true 3D intersection inference, added particle board material, and introduced four regression tests for the precise manual cabinet workflow and real camera/raycast snapping. All 104 tests passed.
76. Browser-built the document's 600 × 2100 mm face, extruded 18 mm, duplicated and positioned the side, added the remaining dimensioned boards, snapped the displaced top exactly, applied plywood and grouped/saved the wardrobe. Reloaded, reopened from MongoDB, selected an internal shelf in the Outliner, edited its height and undid the edit. Fixed the Outliner being permanently hidden below 950 px; it now opens as a dismissible overlay. Added a portable JSON example and exact workflow instructions. The new workflow verification continued past the earlier 3 pm deadline; no claim of completing these new changes before that deadline is made.
