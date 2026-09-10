# Clearance and manual furniture assembly

The September 10 correction replaces unconstrained front previews with rigid hinge and slide joints. Panel dimensions stay constant during movement. The correction applies to all eight furniture families and hinged, sliding and lift-up configurations.

## Door and drawer operation

Use **Furniture → Hinges, slides & clearance → Operate joints**. Each door and drawer can open independently. An enclosed drawer remains at its starting position if its requested opening path intersects either door. Both doors must clear the drawer box, front and handle. A door stops against an extended drawer; retract the drawer before closing it.

The furniture opening slider opens doors during its first 55% and extends drawers during its remaining 45%. Reducing it retracts drawers before closing fronts. Parts rotate around the hinge axis or translate along the slide; they are never stretched by opening.

Two-track sliding fronts expose one side at a time. Select left or right access; both leaves can also be controlled individually. A central drawer spanning both possible openings may never fit through either opening. The builder rejects such a configuration and offers **Use two sliding compartments**. It does not solve an impossible layout by moving a drawer through a door.

New enclosed drawer geometry has narrower inset fronts, clearance behind door handles, and runner spacer boards when thicker fronts require them. Hinged fronts pivot at their front edge. Double doors reject insufficient reveal for the swept thickness; for example, a 50 mm front needs more separation than an 18 mm front. Desk modesty panels and cabinet feet were also corrected to remove intersections with legs and plinths.

## Inspect the complete project

Choose **Check clearances → Run complete clearance check**. The check examines current and closed poses, generated furniture opening paths and manually assigned joint opening paths. Hidden parts participate. Results select the affected parts for inspection.

Rectangular panels use oriented solid bounds, so rotation is respected. Static candidates involving shaped closed solids are confirmed using actual intersection volume; a peg passing through a real hole is distinguished from one intersecting the surrounding panel. An imported mesh without a usable closed solid is explicitly reported as an envelope check.

Motion checks use conservative oriented envelopes, sampled at no more than 2 mm of estimated vertex travel, with a 0.05 mm inset on each box envelope to avoid reporting touching surfaces as penetration. Shaped moving objects can stop early. Very thin features and arbitrary non-solid imports are not certified by this discrete check. The static solid check reports intersection volume above 0.01 cubic millimetres. This is geometric interference checking, not a guarantee of all manufacturing tolerances.

Physical handles, legs, feet and hanging rails participate. Mounting hinges, runners, track reference geometry and shelf pins are excluded because their simplified mounting geometry intentionally intersects its support. Supplier-specific fitting envelopes, hinge linkage details, fastener engagement, minimum service gaps, material strength, deflection, load capacity and gravity dynamics are not calculated.

Manual modelling still permits deliberate intersections needed for booleans and construction. Run the clearance audit after editing or placing parts. New furniture and library/model imports default to placement beside existing geometry with a 150 mm gap; disable this option for exact supplied coordinates. Existing project placements are preserved.

## Build the same mechanisms manually

1. Create dimensioned boards or draw a Rectangle/closed profile and Push/Pull it to thickness. Build the carcass, dividers, shelves, door leaves and drawer box as separate editable solids. Circle and cylinder tools can form handles and rails.
2. Enter exact dimensions and positions in Entity Info. Offset, Push/Pull, solid tools and panel machining produce actual recesses, holes and grooves.
3. Select only the parts that move together: for example, a door plus handle, or a drawer front, sides, back, bottom and handle. Leave the carcass unselected.
4. Open **Hinges, slides & clearance → Attach to manual parts**. Choose a revolute hinge or linear slide and whether it is a door or drawer. Set the actual world hinge axis/pivot and angle, or travel axis/direction/distance. Pivot shortcuts use world bounds; enter measured hinge coordinates for rotated parts.
5. Attach the joint. The current pose becomes closed. Use individual Open/Close controls and check clearances. The same obstruction checks apply to manually created boards and extrusions as to presets.
6. Save or export JSON to retain editable geometry and joints. Whole-assembly copies have independent joints; Undo restores joint assignment and movement. Mesh exports retain the current geometry but do not preserve editable joint behaviour.
7. Produce the cut list and sheet layout from actual panel dimensions. Fabrication settings, grain, banding and machining notes remain available on manual parts.

Gizmo scaling that would shear rotated boards, or scale a multi-part mechanism without rebuilding its clearances, is rejected. Edit furniture dimensions through its configuration, or size individual manual boards before attaching joints.

## Existing saved models

Projects are not silently regenerated or repositioned. Old moving fronts receive obstruction checks, and saved sliding-leaf travel metadata is repaired when operating the furniture. Construction fixes such as narrower enclosed drawer fronts and new hinge pivots require **Edit furniture** and regeneration. Regeneration replaces individual geometry edits; Undo restores them. An old invalid assembly can remain blocked until its layout is corrected.

This guide describes the implemented furniture workflow. It does not establish complete SketchUp parity or that every arbitrary furniture design is ready for fabrication.
