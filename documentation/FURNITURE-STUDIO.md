# Furniture studio

Updated 10 September 2026. The requested delivery focus is furniture: kitchens, study/work tables, TV units, wardrobes, lofts, shoe racks and related cabinetry.

## Build an assembly

1. Click **Build furniture**, or choose a type from the **Furniture** menu.
2. Set the overall dimensions in millimetres. The preview renders the actual generated parts and supports orbit/zoom.
3. Configure compartments or kitchen modules. Width shares divide the available clear width after sides and dividers. Mixed compartments combine a lower drawer section with shelves or hanging above.
4. Choose hinged, two-track sliding or lift-up doors. The opening slider moves the actual fronts, handles and drawer boxes.
5. In Construction, set panel/back thickness, reveal, plinth, worktop dimensions, materials and handles. Placement sets X/Y, elevation and rotation.
6. Add the furniture to the project. Assembly mode selects the full unit. Object/Face mode selects individual parts for modelling or machining.

The presets include kitchen base/wall/tall cabinets, drawer cabinets, sink and hob units, open shelves, wardrobes, desks with optional pedestals, TV units with optional wall panels, lofts, shoe racks, bookcases and custom cabinets.

L/U kitchens add blind corner cabinets with 400 mm access fronts, fixed blind panels and worktop joints. A corner adds `base depth + 400 mm` to the main run. Returns include `worktop overhang + 50 mm` service clearance. Automatic wall units can be disabled when placing separate wall modules.

## Edit furniture and parts

Select a part or the whole assembly and choose **Edit furniture** in Entity Info. Reconfiguration regenerates the assembly, preserving IDs for matching part keys and its placement after whole-assembly translation/Z rotation. Reconfiguration replaces individual shape edits; Undo restores them.

The Outliner displays nested imported groups and generated furniture subassemblies. Whole-assembly copy/paste and duplication remap groups, furniture IDs, materials and front mechanisms. Copying only some parts creates independent parts rather than an incomplete parametric assembly. Hidden and locked parts remain part of quantities. Unlock fronts before opening or reconfiguring them.

Use **P** for Push/Pull and **F** for Offset. Click a face, move and click again, or drag to finish. Type a distance and press Enter; mm/cm/m/in/ft and fractional inches are supported. Insetting an offset face cuts a real recess or through-hole in its host panel. Follow Me sweeps a profile along connected line/arc geometry, including mitered and closed paths. Solid tools support union, subtract, intersect, trim and split.

## Panel machining

Select one panel in Object/Face mode and choose **Furniture → Panel drilling, pockets & grooves** or **Drill holes / cut pocket** in Entity Info.

- Drilling creates blind or through holes, up to 100 per operation. Shelf-pin and 35 mm hinge-cup presets fill editable measurements.
- Set the cut axis and positive/negative face. Offsets use the panel's local in-plane axes, measured from their minimum extents.
- Hole offsets locate the first centre. Rows/columns and spacing define the pattern.
- Pocket offsets locate the lower corner. A full-width narrow pocket creates a dado; a pocket at an edge creates a rebate.
- Cuts modify real manifold solids, retain furniture membership/front mechanisms and participate in Undo. Subsequent machining accumulates on the edited geometry.

Hardware is reference geometry. Drilling presets are editable starting values, not supplier-specific fabrication instructions.

## Production

Choose **Furniture → Cut list, drawings & sheet layout**. Scope can be the whole project or selected furniture/parts.

- Cut lists derive rectangular blank dimensions from current geometry, including resized or machined parts.
- Entity Info exposes thickness direction, edge-band count, grain locking and grain/cut-length direction.
- CSV includes assembly, part, material, quantity, dimensions, total edge-band length and machining notes.
- HTML exports include a hardware schedule and front/plan/side drawings with overall dimensions. Print the HTML to PDF in a browser.
- Sheet layout separates material and thickness, accounts for saw kerf and only rotates parts when grain locking is disabled. Oversized parts are reported rather than silently scaled. Export the result as SVG.

Drawings use orthographic part envelopes, not hidden-line manufacturing drawings. Blank sizes do not deduct edge-band thickness; drilling locations and joints still require workshop detailing. The nesting algorithm is a rectangular guillotine heuristic. Imported arbitrary meshes enter the cut list only after assigning panel fabrication settings. Existing generic material estimates use their earlier area-based pricing rules; the dedicated furniture cut list is the appropriate source for panel blanks and fittings.

## Models and persistence

The 3D model library includes all eight supplied SKP files converted through the installed SketchUp Ruby API. The conversion contains 104 editable parts and 13,988 triangles, plus embedded textures and per-face material groups. Hidden native entities and free edges are omitted; component instances are expanded into independent geometry. The converter is `scripts/sketchup_export.rb`; source SKP files are not modified.

Import GLB, self-contained glTF, OBJ, STL and PLY through File → Import 3D model. GLB/glTF use metres and Y-up by default; OBJ/STL/PLY default to millimetres. External glTF dependencies, Draco/KTX compression and OBJ MTL files are not currently loaded. Native SKP decoding is not implemented in the browser.

Every edit writes IndexedDB recovery. Connected projects autosave and can be checkpointed. JSON is the editable transfer format; GLB/OBJ/STL export geometry and materials with each format's limits. The public Cloudflare site stores projects in an anonymous browser workspace identified by a cookie. Clearing cookies or changing domain/browser creates a separate cloud workspace. Export/import JSON to transfer a project.

## Coverage boundaries

This is a functional furniture modeller with original Hazzino styling. It is not verified inch-by-inch parity with SketchUp 2026. Connected edge/face topology, native shared component instances, extension compatibility, DWG/DXF/IFC and native SKP round trips remain unimplemented. General inference and Push/Pull interactions cover a narrower scope than native SketchUp. Outer Shell currently behaves as union. Boolean edits do not preserve all original texture UVs or per-face materials. Non-uniform scaling of rotated assemblies can approximate shear, and regeneration after manual part edits rebuilds from the saved configuration.

Door/drawer movement is an editable preview mechanism; it does not enforce collision constraints or hardware kinematics. Presets use butt-jointed carcasses, applied backs, overlay fronts and a 13 mm drawer-runner side allowance. The app does not certify furniture structure or generate CNC postprocessor output.
