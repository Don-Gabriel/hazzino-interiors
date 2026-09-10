// Values shared by the renderer, saved scenes and project import validation.
export const DISPLAY_DEFAULTS = {
  displayStyle: "textured",
  gridVisible: true,
  axesVisible: true,
  edges: true,
  edgeOpacity: 0.45,
  shadows: true,
  xray: false,
  section: false,
  sectionHeight: 1500,
  background: "#eef0ec",
  fogEnabled: false,
  fogNear: 22000,
  fogFar: 65000,
  sunAzimuth: 235,
  sunElevation: 55,
  sunIntensity: 3.2,
  exposure: 1.25,
  fieldOfView: 42,
};
export const DISPLAY_STYLES = [
  ["textured", "Shaded with textures"],
  ["shaded", "Shaded"],
  ["monochrome", "Monochrome"],
  ["hidden-line", "Hidden line"],
  ["wireframe", "Wireframe"],
];
const finiteVector = (v) =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export function validateDisplay(display) {
  if (!display || typeof display !== "object" || Array.isArray(display))
    throw Error("Invalid scene display settings");
  for (const [key, value] of Object.entries(display)) {
    if (!(key in DISPLAY_DEFAULTS))
      throw Error("Unknown display setting: " + key);
    if (typeof value !== typeof DISPLAY_DEFAULTS[key])
      throw Error("Invalid display setting: " + key);
    if (typeof value === "number" && !Number.isFinite(value))
      throw Error("Invalid display number: " + key);
  }
  const d = { ...DISPLAY_DEFAULTS, ...display };
  if (
    !DISPLAY_STYLES.some(([id]) => id === d.displayStyle) ||
    !/^#[0-9a-f]{6}$/i.test(d.background)
  )
    throw Error("Invalid display style or background");
  if (
    d.fogNear < 0 ||
    d.fogFar <= d.fogNear ||
    d.edgeOpacity < 0 ||
    d.edgeOpacity > 1 ||
    d.sunElevation < 1 ||
    d.sunElevation > 90 ||
    d.sunAzimuth < 0 ||
    d.sunAzimuth > 360 ||
    d.sunIntensity < 0 ||
    d.sunIntensity > 10 ||
    d.exposure < 0.1 ||
    d.exposure > 4 ||
    d.fieldOfView < 10 ||
    d.fieldOfView > 100
  )
    throw Error("Display setting is outside its supported range");
  return d;
}
export function validateViews(views) {
  const ids = new Set();
  for (const v of views) {
    if (
      !v ||
      typeof v.id !== "string" ||
      ids.has(v.id) ||
      typeof v.name !== "string" ||
      !v.name.trim() ||
      v.name.length > 200 ||
      !finiteVector(v.position) ||
      !finiteVector(v.target) ||
      (v.up != null && (!finiteVector(v.up) || v.up.every((n) => n === 0))) ||
      (v.orthographic != null && typeof v.orthographic !== "boolean") ||
      (v.span != null && (!Number.isFinite(v.span) || v.span <= 0)) ||
      (v.zoom != null && (!Number.isFinite(v.zoom) || v.zoom <= 0)) ||
      (v.fov != null && (!Number.isFinite(v.fov) || v.fov < 10 || v.fov > 100))
    )
      throw Error("Invalid saved scene camera");
    ids.add(v.id);
    if (v.display) validateDisplay(v.display);
    if (
      v.visibility &&
      (!Array.isArray(v.visibility) ||
        v.visibility.some(
          (o) =>
            !o || typeof o.id !== "string" || typeof o.visible !== "boolean",
        ))
    )
      throw Error("Invalid scene object visibility");
    if (
      v.layers &&
      (!Array.isArray(v.layers) ||
        v.layers.some(
          (l) =>
            !l || typeof l.id !== "string" || typeof l.visible !== "boolean",
        ))
    )
      throw Error("Invalid scene tag visibility");
  }
}
