import React from "react";
import { useEditor } from "./store.js";
import { DRAWING_TOOLS, ARC_TOOLS } from "../shared/drawing.js";

function Glyph({ size = 18, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}
export const ArcIcon = (props) => (
  <Glyph {...props}>
    <path d="M4 19A15 15 0 0 1 19 4M4 15v4h4" />
    <circle cx="19" cy="4" r="1" />
  </Glyph>
);
export const TwoPointArcIcon = (props) => (
  <Glyph {...props}>
    <path d="M3 18a9 12 0 0 1 18 0" />
    <circle cx="3" cy="18" r="1.5" />
    <circle cx="21" cy="18" r="1.5" />
  </Glyph>
);
export const ThreePointArcIcon = (props) => (
  <Glyph {...props}>
    <path d="M3 18a9 12 0 0 1 18 0" />
    <circle cx="3" cy="18" r="1.5" />
    <circle cx="12" cy="6" r="1.5" />
    <circle cx="21" cy="18" r="1.5" />
  </Glyph>
);
export const PieIcon = (props) => (
  <Glyph {...props}>
    <path d="M4 20V4a16 16 0 0 1 16 16Z" />
  </Glyph>
);
export const RotatedRectangleIcon = (props) => (
  <Glyph {...props}>
    <path d="m3 12 13-8 5 8-13 8Z" />
    <path d="m6 10 2 3-3 2" />
  </Glyph>
);
export const PolygonIcon = (props) => (
  <Glyph {...props}>
    <path d="m7 3 10 0 5 9-5 9H7L2 12Z" />
  </Glyph>
);
export const FreehandIcon = (props) => (
  <Glyph {...props}>
    <path d="M3 18c8-20 18-18 9-8S4 22 11 20s13-14 9-14" />
  </Glyph>
);

export const DRAWING_INSTRUCTIONS = {
  freehand: [
    "Freehand",
    "Drag on the drawing plane and release to finish one curve. Freehand follows your stroke without grid snapping.",
  ],
  "rotated-rectangle": [
    "Rotated Rectangle",
    "Click the first corner, the end of the first edge, then set the width.",
  ],
  "regular-polygon": [
    "Polygon",
    "Choose the number of sides. Click the center, then a vertex to set radius and rotation.",
  ],
  arc: [
    "Arc",
    "Click the center, the start point, then the end direction. The radius stays fixed.",
  ],
  "arc-2point": [
    "2 Point Arc",
    "Click the start, the end, then a point on the curve to set its bulge.",
  ],
  "arc-3point": [
    "3 Point Arc",
    "Click the start, a point the arc passes through, then the end.",
  ],
  pie: [
    "Pie",
    "Click the center, the start point, then the end direction. Push / Pull extrudes the sector.",
  ],
};
export const extraDrawingTools = [
  ["freehand", FreehandIcon, "Freehand", ""],
  ["arc", ArcIcon, "Arc", ""],
  ["arc-2point", TwoPointArcIcon, "2 Point Arc", "A"],
  ["arc-3point", ThreePointArcIcon, "3 Point Arc", ""],
  ["pie", PieIcon, "Pie", ""],
  ["rotated-rectangle", RotatedRectangleIcon, "Rotated Rectangle", ""],
  ["regular-polygon", PolygonIcon, "Polygon", ""],
];
export function DrawingOptions() {
  const s = useEditor();
  if (!DRAWING_TOOLS.includes(s.tool)) return null;
  const instructions = DRAWING_INSTRUCTIONS[s.tool];
  const curve = s.tool === "circle" || ARC_TOOLS.includes(s.tool);
  return (
    <section className="drawing-tool-options" aria-label="Drawing options">
      <div className="drawing-option-fields">
        <strong>
          {instructions?.[0] ||
            (s.tool === "polygon"
              ? "Closed profile"
              : s.tool[0].toUpperCase() + s.tool.slice(1))}
        </strong>
        {curve && (
          <label>
            Segments{" "}
            <select
              aria-label="Curve segments"
              value={
                ARC_TOOLS.includes(s.tool) ? s.arcSegments : s.curveSegments
              }
              onChange={(e) =>
                s.set({
                  [ARC_TOOLS.includes(s.tool)
                    ? "arcSegments"
                    : "curveSegments"]: Number(e.target.value),
                })
              }
            >
              {Array.from(
                { length: ARC_TOOLS.includes(s.tool) ? 95 : 85 },
                (_, i) => i + (ARC_TOOLS.includes(s.tool) ? 2 : 12),
              ).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {s.tool === "regular-polygon" && (
          <label>
            Sides{" "}
            <select
              aria-label="Polygon sides"
              value={s.polygonSides}
              onChange={(e) => s.set({ polygonSides: Number(e.target.value) })}
            >
              {Array.from({ length: 94 }, (_, i) => i + 3).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {["arc", "pie"].includes(s.tool) && (
          <label>
            <input
              type="checkbox"
              checked={s.arcClockwise}
              onChange={(e) => s.set({ arcClockwise: e.target.checked })}
            />{" "}
            Clockwise
          </label>
        )}
        <button
          onClick={() => {
            s.engine?.cancelDraw();
            s.set({ tool: "select" });
          }}
        >
          Cancel <kbd>Esc</kbd>
        </button>
      </div>
      {instructions && <p>{instructions[1]}</p>}
    </section>
  );
}
