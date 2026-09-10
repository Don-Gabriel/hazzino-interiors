# Manual cabinet demonstration from the supplied brief

The source is the user's `Hackathon - Sketchup.docx`, particularly sections 3, 5, 19, 30 and 34. Its primary task is manual furniture modelling, exact geometry and project management; bonus features and suggested architecture are distinguished from mandatory qualification features.

## Exact demonstration

1. File → New project. Name the design. Set drawing plane **YZ** and Camera → **Right**. Draw a rectangle, then set its Y dimension to **600 mm**, Z dimension to **2100 mm**, centre Y to **300 mm** and centre Z to **1050 mm**. It remains a 2D face at X = 0.
2. Apply **Push/Pull 18 mm**. The board has dimensions **18 × 600 × 2100 mm** and centre **9, 300, 1050**. Name it Left side. Here the rectangle's 600 mm width becomes cabinet depth, and its extrusion becomes side-panel thickness.
3. Duplicate the board using **Ctrl D**. Name the copy Right side and set centre X to **1191 mm**. This gives a **1200 mm overall cabinet width**, with **1164 mm between the side panels**. Enter commits numeric fields; leaving the field also commits them.
4. Create the following independent boards using **Create dimensioned board** or Rectangle + Push/Pull. Dimensions and centre positions below are X, Y, Z in millimetres.

| Part | Dimensions | Centre position |
|---|---|---|
| Top | 1164, 600, 18 | 600, 300, 2091 |
| Bottom | 1164, 600, 18 | 600, 300, 9 |
| Middle divider | 18, 600, 2064 | 600, 300, 1050 |
| Left shelf | 573, 580, 18 | 304.5, 300, 1050 |
| Right shelf | 573, 580, 18 | 895.5, 300, 1050 |
| Left door | 597, 18, 2096 | 300, -11, 1050 |
| Right door | 597, 18, 2096 | 900, -11, 1050 |

5. To demonstrate component snapping, initially place Top at **750, 500, 2291**. Select it and choose **Tools → Move point to point (snap components)**, also available in the left toolbar. Click its corner **168, 200, 2300**, then the inner upper front corner of Left side at **18, 0, 2100**. Top lands at **600, 300, 2091**, keeping its dimensions. The cursor/status identifies the snap; X/Y/Z can constrain movement. Esc cancels without modifying the document. Undo/Redo restores/reapplies the completed move.
6. Select all nine boards and apply **Birch plywood** or a laminate. **Ctrl G** groups the wardrobe. In group selection mode, selecting a member selects the assembly; moving it preserves the relative positions of its boards.
7. Choose Camera → Isometric/Perspective and orbit, pan and zoom. Use Front/Right/Top for orthographic inspection. The cabinet is made of ordinary editable boards, not a preset or imported mesh.
8. Save, reload, open the named project through File → Open projects, select a shelf and change its Z position. Undo and save as needed. Export JSON for an editable portable copy.

For moving doors/drawers, attach manual joints using the separate [clearance and manual construction guide](CLEARANCE-AND-MANUAL-BUILD.md). This basic nine-board demonstration intentionally contains no drawer or back panel; the brief's required side/top/bottom/divider/shelf/door components are present.

## Verification and coverage

The automated suite now has **104 passing tests**. Four new tests exercise point-to-point movement using a real Three.js camera/raycaster, cancellation, axis constraints, endpoint priority, genuine 3D segment intersections, and the document's manual rectangle → 18 mm extrusion → duplicate → exact move → remaining boards → material → group → MongoDB save/reopen → edit/Undo sequence. Skew lines are not treated as intersections. The cabinet has no intersecting panel solids.

Browser verification also drew the YZ rectangle, entered 600/2100 mm, extruded 18 mm, duplicated and positioned the side, added the seven remaining editable boards, snapped the initially displaced top to the precise side-panel corner, applied plywood, grouped all nine boards and saved to MongoDB. The saved browser demonstration is **Hackathon document · Manual wardrobe**.

Required basic modelling, dimensions, selection, grid, camera views, transformations, duplication/deletion, grouping, basic snapping, materials and project operations are implemented. Face selection and box-edge inspection are available; independent topological vertex/edge editing remains a bonus gap. Drawing and point-to-point movement expose endpoint, midpoint, edge, centre, face, intersection and grid inference for supported geometry. Arbitrary imported mesh vertices do not yet have the same full feature inference as rectangular boards and line segments.

The local app is React/Three.js + Node/Express + MongoDB and is the deployment to use when demonstrating the brief's **MongoDB persistence** criterion. The public Cloudflare build uses Workers and SQLite Durable Objects; it is not MongoDB. Optional account authentication, native DXF/SKP parsing, full SketchUp topology/extension parity and voice modelling are not implemented. Geometry/clearance checks do not constitute structural or manufacturer-specific certification.
