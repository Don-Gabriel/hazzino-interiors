# Verification record

Verified on 9 September 2026, before the 18:00 India time target.

## Executed checks

The Node test suite contains **30 passing tests**. It covers:

- Exact board size, 18 mm extrusion from the original plane, opposite-face preservation, rotated normals, invalid extrusion rejection.
- Wardrobe outer dimensions, independently identified panels, shelf count, invalid cabinet sizes, clear room dimensions.
- Board and profile area/volume, resized profile mesh bounds, hidden parts in estimates, rotated box features and world-bound alignment.
- Rectangular openings: removed mesh volume, quantity agreement, ray passage through holes, collision beside a hole, rejection of overlap/full removal, omission of internal partition faces in exported geometry.
- Associative dimension endpoints following resized and moved objects.
- Project JSON roundtrip, invalid coordinates/dimensions, degenerate profiles, malformed references, atomic edits, undo/redo and locked-object deletion protection.
- CSV escaping and HTML/SVG output escaping.
- Real local MongoDB health, project write, read, edit, checkpoint creation/read, listing, delete and 404 after deletion. Tests use unique temporary project IDs and clean up those projects only.
- Cross-origin API write rejection.
- WebMCP tool contracts against a simulated registration interface: valid input reaches the common editor state; invalid input fails before mutation. This does **not** establish browser support or browser registration.

## Live application checks

- Development URL `http://127.0.0.1:5173/` returned HTTP 200.
- Express health reported `{ok:true,database:"MongoDB"}`.
- Both demonstration projects were saved to MongoDB and portable JSON files.
- The saved wardrobe still contained 16 parts after source-triggered API/MongoDB restarts; the disk-backed WiredTiger files were present under `.data/mongo`.
- Vite production compilation succeeded repeatedly as the editor and export features were integrated.
- Dependencies were installed with a lockfile; npm audit reported zero vulnerabilities at installation.

## Validation boundaries

An automated interactive browser walkthrough, screenshots, and pixel/layout comparisons were not performed. The selected Sites workflow permits those only when explicitly requested. The existing local preview was opened for the user and its stable tab recorded; geometry, API and state verification were performed independently of UI automation.

There was no supported browser WebMCP testing interface. Registration is feature-detected; browser execution remains unverified.

No fabrication, structural, building-code, photorealistic-rendering, large-model performance or third-party CAD roundtrip certification is claimed. SVG is a box-footprint projection, and estimates use editable assumptions. See `FEATURE-COVERAGE.md` and the README for the full scope and limits.
