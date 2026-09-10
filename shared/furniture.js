import { entity, uid, clone } from "./model.js";
import { Vector3, Euler, Quaternion } from "three";

export const FURNITURE_TYPES = [
  ["kitchen", "Modular kitchen", "Base, wall and tall cabinets"],
  ["wardrobe", "Wardrobe", "Hanging, shelves and drawers"],
  ["desk", "Study / worktable", "Worktop, legs and storage"],
  ["tv", "TV unit", "Media storage and wall panel"],
  ["loft", "Loft", "Overhead storage"],
  ["shoe", "Shoe rack", "Shelves and closed storage"],
  ["bookcase", "Bookcase", "Open display and shelving"],
  ["cabinet", "Custom cabinet", "Build your own compartments"],
];
export const BAY_TYPES = [
  ["shelves", "Shelves"],
  ["hanging", "Hanging rail"],
  ["drawers", "Drawers"],
  ["mixed", "Drawers + upper storage"],
  ["open", "Open compartment"],
];
export const KITCHEN_MODULES = [
  ["base", "Base cabinet"],
  ["drawers", "Drawer cabinet"],
  ["sink", "Sink base"],
  ["hob", "Hob base"],
  ["open", "Open base"],
  ["tall", "Tall pantry"],
  ["wall", "Wall cabinet"],
];
const rad = (n) => (n * Math.PI) / 180;
const round = (n) => Math.round(n * 1000) / 1000;
const vec = (v, angle, origin) =>
  new Vector3(...v)
    .applyAxisAngle(new Vector3(0, 0, 1), rad(angle))
    .add(new Vector3(...origin))
    .toArray()
    .map(round);
const bay = (type = "shelves", shelves = 3) => ({
  type,
  shelves,
  drawers: type === "mixed" ? 2 : 3,
  drawerHeight: 600,
  upperType: "shelves",
  doors: 1,
  hinge: "left",
  weight: 1,
});
export function defaultFurnitureSpec(type = "wardrobe") {
  const sizes = {
    wardrobe: [1800, 600, 2400],
    desk: [1400, 650, 750],
    tv: [1800, 450, 500],
    loft: [1800, 600, 600],
    shoe: [1000, 350, 1100],
    bookcase: [900, 350, 1800],
    cabinet: [1200, 450, 900],
    kitchen: [3000, 580, 900],
  };
  if (!sizes[type]) throw Error("Unknown furniture type");
  const [width, depth, height] = sizes[type];
  return {
    version: 1,
    type,
    name: FURNITURE_TYPES.find((t) => t[0] === type)[1],
    width,
    depth,
    height,
    thickness: 18,
    backThickness: 6,
    plinth: ["loft", "bookcase", "desk"].includes(type)
      ? 0
      : type === "kitchen"
        ? 100
        : 80,
    reveal: 2,
    material: "oak",
    frontMaterial: "sage",
    backMaterial: "plywood",
    worktopMaterial: "marble",
    hardwareMaterial: "metal",
    handles: true,
    fronts: !["bookcase", "desk"].includes(type),
    open: 0,
    x: 0,
    y: 0,
    elevation: type === "loft" ? 2100 : 0,
    rotation: 0,
    worktopThickness: type === "desk" ? 25 : 20,
    worktopOverhang: 20,
    wallHeight: 720,
    wallDepth: 330,
    wallElevation: 1500,
    tallHeight: 2200,
    layout: "straight",
    wallUnits: true,
    deskStorage: true,
    tvPanel: false,
    frontStyle: type === "loft" ? "lift-up" : "hinged",
    bays:
      type === "wardrobe"
        ? [bay("hanging"), bay("mixed"), { ...bay("shelves"), hinge: "right" }]
        : type === "tv"
          ? [bay("drawers"), bay("open"), bay("shelves", 1)]
          : type === "loft"
            ? [bay("shelves", 0), bay("shelves", 0), bay("shelves", 0)]
            : [bay("shelves", type === "shoe" ? 5 : 4)],
    modules: [
      { type: "drawers", width: 600, run: 0 },
      { type: "sink", width: 900, run: 0 },
      { type: "hob", width: 900, run: 0 },
      { type: "base", width: 600, run: 0 },
    ],
  };
}
function number(v, name, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`${name} must be between ${min} and ${max} mm`);
}
export function validateFurnitureSpec(s) {
  if (!FURNITURE_TYPES.some((t) => t[0] === s.type))
    throw Error("Choose a furniture type");
  if (typeof s.name !== "string" || !s.name.trim() || s.name.length > 160)
    throw Error("Enter a furniture name (up to 160 characters)");
  for (const k of ["width", "height"]) number(s[k], k, 200, 12000);
  number(s.depth, "Depth", 180, 2000);
  number(s.thickness, "Board thickness", 9, 50);
  number(s.backThickness, "Back thickness", 3, 30);
  number(s.plinth, "Plinth", 0, 300);
  number(s.reveal, "Reveal gap", 1, 10);
  number(s.open, "Opening fraction", 0, 1);
  for (const k of ["x", "y", "elevation"]) number(s[k], k, -100000, 100000);
  number(s.rotation, "Rotation", -36000, 36000);
  number(s.worktopThickness, "Worktop thickness", 9, 100);
  number(s.worktopOverhang, "Worktop overhang", 0, 100);
  if (s.height - s.plinth < 4 * s.thickness + 60)
    throw Error("Increase the height or reduce the plinth / board thickness");
  if (!Array.isArray(s.bays) || s.bays.length < 1 || s.bays.length > 12)
    throw Error("Use 1–12 compartments");
  if (s.frontStyle && !["hinged", "sliding", "lift-up"].includes(s.frontStyle))
    throw Error("Invalid door mechanism");
  for (const b of s.bays) {
    if (!BAY_TYPES.some((t) => t[0] === b.type))
      throw Error("Unknown compartment type");
    for (const k of ["shelves", "drawers", "doors"]) {
      if (
        !Number.isInteger(b[k]) ||
        b[k] < 0 ||
        b[k] > (k === "doors" ? 2 : 12)
      )
        throw Error("Shelf/drawer counts must be 0–12; doors 0–2");
    }
    number(b.weight, "Compartment width share", 0.1, 10000);
    if (!["left", "right"].includes(b.hinge)) throw Error("Invalid hinge side");
    if (b.type === "mixed") {
      number(b.drawerHeight, "Lower drawer section", 180, 1800);
      if (!["shelves", "hanging", "open"].includes(b.upperType))
        throw Error("Invalid upper storage type");
    }
  }
  if (s.type === "kitchen") {
    for (const k of ["wallHeight", "wallDepth", "wallElevation", "tallHeight"])
      number(s[k], k, 180, 5000);
    if (!["straight", "L", "U"].includes(s.layout))
      throw Error("Unknown kitchen layout");
    if (!Array.isArray(s.modules) || !s.modules.length || s.modules.length > 30)
      throw Error("Use 1–30 kitchen modules");
    for (const m of s.modules) {
      if (!KITCHEN_MODULES.some((t) => t[0] === m.type))
        throw Error("Unknown kitchen module");
      number(m.width, "Module width", 300, 1800);
      if (!Number.isInteger(m.run) || m.run < 0 || m.run > 2)
        throw Error("Invalid kitchen run");
    }
    const runs = s.layout === "straight" ? 1 : s.layout === "L" ? 2 : 3;
    if (s.modules.some((m) => m.run >= runs))
      throw Error("Move modules into a run used by this layout");
    if (
      Array.from(
        { length: runs },
        (_, run) => !s.modules.some((m) => m.run === run && m.type !== "wall"),
      ).some(Boolean)
    )
      throw Error("Each kitchen run needs at least one base or tall module");
    if (s.wallDepth > s.depth)
      throw Error("Wall cabinets must not be deeper than the base cabinets");
    if (s.wallUnits && s.wallElevation < s.height + 200)
      throw Error("Leave at least 200 mm above the worktop for wall units");
    if (s.wallUnits && s.modules.some((m) => m.type === "wall"))
      throw Error(
        "Turn off matching wall cabinets before adding separate wall modules",
      );
  }
  return s;
}

// Closed geometry is generated first. Front mechanisms keep their own pivot and
// closed transform, so opening a door never changes its fabrication dimensions.
export function buildFurniture(input, { id = uid(), previous = [] } = {}) {
  const s = clone(validateFurnitureSpec(input)),
    objects = [],
    groups = [{ id, name: s.name, furnitureSpec: s }],
    hardware = [];
  const prior = new Map(previous.map((o) => [o.partKey, o]));
  function group(key, name) {
    const gid = id + ":" + key;
    groups.push({ id: gid, name, parentId: id });
    return gid;
  }
  let frame = { origin: [0, 0, 0], angle: 0, group: id, key: "" };
  const globalAngle = s.rotation;
  function transform(point) {
    return vec(vec(point, frame.angle, frame.origin), globalAngle, [
      s.x,
      s.y,
      s.elevation,
    ]);
  }
  function add(
    key,
    name,
    size,
    position,
    role = "panel",
    material = s.material,
    options = {},
  ) {
    if (size.some((v) => !Number.isFinite(v) || v <= 0))
      throw Error(
        `${name} has no room: increase the cabinet dimensions or reduce the fittings`,
      );
    const fullKey = frame.key + key,
      old = prior.get(fullKey);
    const localRot = options.rotation || [0, 0, 0],
      q = new Quaternion()
        .setFromAxisAngle(new Vector3(0, 0, 1), rad(frame.angle + globalAngle))
        .multiply(
          new Quaternion().setFromEuler(new Euler(...localRot.map(rad))),
        );
    const e = new Euler().setFromQuaternion(q);
    const o = entity({
      id: old?.id || uid(),
      name,
      size: size.map(round),
      position: transform(position),
      rotation: [e.x, e.y, e.z].map((n) => round((n * 180) / Math.PI)),
      material,
      groupId: frame.group,
      furnitureId: id,
      partKey: fullKey,
      role,
      ...options,
    });
    // options.rotation is local, while every saved entity transform is world-space.
    o.rotation = [e.x, e.y, e.z].map((n) => round((n * 180) / Math.PI));
    if (role !== "hardware")
      o.fabrication = {
        thicknessAxis: options.thicknessAxis ?? size.indexOf(Math.min(...size)),
        edgeBanding:
          role === "back"
            ? 0
            : role === "shelf"
              ? 1
              : role === "door" || role === "drawer-front"
                ? 4
                : 2,
        grain: true,
      };
    if (options.mechanism) {
      o.mechanism = {
        ...options.mechanism,
        pivot: transform(options.mechanism.pivot || position),
        axis: new Vector3(...(options.mechanism.axis || [0, 0, 1]))
          .applyAxisAngle(new Vector3(0, 0, 1), rad(frame.angle + globalAngle))
          .normalize()
          .toArray(),
        direction: new Vector3(...(options.mechanism.direction || [0, -1, 0]))
          .applyAxisAngle(new Vector3(0, 0, 1), rad(frame.angle + globalAngle))
          .normalize()
          .toArray(),
        closedPosition: [...o.position],
        closedRotation: [...o.rotation],
      };
    }
    if (old) {
      o.visible = old.visible;
      o.locked = old.locked;
    }
    objects.push(o);
    return o;
  }
  function fitting(key, name, size, pos, mechanism) {
    return add(key, name, size, pos, "hardware", s.hardwareMaterial, {
      ...(mechanism ? { mechanism } : {}),
      hardwareType: name,
    });
  }
  function handle(key, x, y, z, mechanism, vertical = false) {
    if (s.handles)
      fitting(
        key,
        "Pull handle",
        vertical ? [12, 24, 128] : [128, 24, 12],
        [x, y - 12, z],
        mechanism,
      );
  }
  function door(key, left, right, bottom, top, y, hinge = "left") {
    if ((frame.frontStyle || s.frontStyle) === "lift-up") {
      const mechanism = {
        kind: "hinge",
        pivot: [(left + right) / 2, y, top],
        axis: [1, 0, 0],
        angle: -100,
      };
      add(
        key,
        "Lift-up door",
        [right - left, s.thickness, top - bottom],
        [(left + right) / 2, y, (bottom + top) / 2],
        "door",
        s.frontMaterial,
        { mechanism, thicknessAxis: 1 },
      );
      handle(
        key + "/handle",
        (left + right) / 2,
        y - s.thickness / 2,
        bottom + 45,
        mechanism,
      );
      for (const x of [left + 50, right - 50])
        fitting(
          key + "/lift" + x,
          "Lift-up hinge",
          [35, 45, 65],
          [x, y + 30, top - 40],
          mechanism,
        );
      return;
    }
    const w = right - left,
      h = top - bottom,
      pivot = [hinge === "left" ? left : right, y, bottom];
    const mechanism = {
      kind: "hinge",
      pivot,
      angle: hinge === "left" ? -100 : 100,
    };
    add(
      key,
      "Door",
      [w, s.thickness, h],
      [(left + right) / 2, y, (bottom + top) / 2],
      "door",
      s.frontMaterial,
      { mechanism, thicknessAxis: 1 },
    );
    handle(
      key + "/handle",
      hinge === "left" ? right - 45 : left + 45,
      y - s.thickness / 2,
      Math.min(top - 80, bottom + h * 0.7),
      mechanism,
      true,
    );
    const hinges = Math.max(2, Math.ceil(h / 750));
    for (let i = 0; i < hinges; i++)
      fitting(
        key + "/hinge" + i,
        "Concealed hinge",
        [32, 35, 50],
        [
          pivot[0] + (hinge === "left" ? 20 : -20),
          y + 25,
          bottom + 80 + (i * (h - 160)) / (hinges - 1),
        ],
        mechanism,
      );
  }
  function drawers(key, left, right, bottom, top, frontY, depth, count) {
    if (!count) throw Error("A drawer compartment needs at least one drawer");
    const pitch = (top - bottom) / count,
      dt = Math.min(15, s.thickness),
      gap = s.reveal,
      slide = 13,
      boxWidth = right - left - 2 * slide,
      boxDepth = Math.min(550, depth - 55),
      boxHeight = pitch - 50;
    if (pitch < 90 || boxWidth < 90 || boxDepth < 100)
      throw Error(
        "The drawer compartment is too small for the requested drawers",
      );
    for (let i = 0; i < count; i++) {
      const k = key + "/drawer" + i,
        z = bottom + i * pitch,
        mechanism = {
          kind: "slide",
          direction: [0, -1, 0],
          travel: boxDepth * 0.85,
        };
      add(
        k + "/front",
        "Drawer front",
        [right - left - 2 * gap, s.thickness, pitch - 2 * gap],
        [(left + right) / 2, frontY, z + pitch / 2],
        "drawer-front",
        s.frontMaterial,
        { mechanism, thicknessAxis: 1 },
      );
      const cy = frontY + s.thickness / 2 + boxDepth / 2 + 5,
        bx = (left + right) / 2,
        bz = z + 15 + boxHeight / 2;
      for (const sign of [-1, 1])
        add(
          k + "/side" + sign,
          "Drawer side",
          [dt, boxDepth, boxHeight],
          [bx + (sign * (boxWidth - dt)) / 2, cy, bz],
          "drawer",
          s.backMaterial,
          { mechanism, thicknessAxis: 0 },
        );
      for (const sign of [-1, 1])
        add(
          k + "/end" + sign,
          "Drawer end",
          [boxWidth - 2 * dt, dt, boxHeight],
          [bx, cy + (sign * (boxDepth - dt)) / 2, bz],
          "drawer",
          s.backMaterial,
          { mechanism, thicknessAxis: 1 },
        );
      add(
        k + "/bottom",
        "Drawer bottom",
        [boxWidth - 2 * dt, boxDepth - 2 * dt, s.backThickness],
        [bx, cy, z + 15 + s.backThickness / 2],
        "drawer",
        s.backMaterial,
        { mechanism, thicknessAxis: 2 },
      );
      handle(
        k + "/handle",
        bx,
        frontY - s.thickness / 2,
        z + pitch / 2,
        mechanism,
      );
      for (const sign of [-1, 1])
        fitting(
          k + "/runner" + sign,
          "Drawer runner",
          [10, boxDepth, 25],
          [bx + sign * (boxWidth / 2 + 6), cy, z + 30],
        );
    }
  }
  function cabinet({
    key,
    name,
    width,
    depth,
    height,
    plinth = s.plinth,
    bays = s.bays,
    origin = [0, 0, 0],
    angle = 0,
    fronts = s.fronts,
    cutout = null,
    worktop = false,
    blind = null,
  }) {
    const prevFrame = frame;
    frame = {
      key: key + "/",
      group: group(key, name),
      origin,
      angle,
      frontStyle: blind ? "hinged" : s.frontStyle,
    };
    const t = s.thickness,
      bt = s.backThickness,
      reveal = s.reveal;
    // All stated depths include the overlay front. The back is applied behind the carcass.
    const sliding = fronts && frame.frontStyle === "sliding",
      frontExtra = sliding ? 2 * t + 2 * reveal : 0;
    const frontAllowance =
      frontExtra +
      (bays.some(
        (b) =>
          ["drawers", "mixed"].includes(b.type) ||
          (fronts && b.type !== "open" && b.doors),
      )
        ? t + reveal
        : 0);
    const bodyDepth = depth - frontAllowance - bt,
      cy = (frontAllowance - bt) / 2,
      frontY = -depth / 2 + frontExtra + t / 2;
    const bodyHeight = height - plinth - (worktop ? s.worktopThickness : 0),
      z0 = plinth,
      z1 = z0 + bodyHeight;
    if (bodyDepth < 100 || bodyHeight < 80)
      throw Error("The cabinet is too shallow or short");
    for (const sign of [-1, 1])
      add(
        "side" + sign,
        "Side panel",
        [t, bodyDepth, bodyHeight],
        [(sign * (width - t)) / 2, cy, z0 + bodyHeight / 2],
        "panel",
        s.material,
        { thicknessAxis: 0 },
      );
    for (const [key, z] of [
      ["bottom", z0 + t / 2],
      ["top", z1 - t / 2],
    ]) {
      if (key === "top" && cutout) {
        for (const sign of [-1, 1])
          add(
            "stretcher" + sign,
            "Top stretcher",
            [width - 2 * t, 65, t],
            [0, cy + (sign * (bodyDepth - 65)) / 2, z],
            "panel",
            s.material,
            { thicknessAxis: 2 },
          );
      } else
        add(
          key,
          key === "top" ? "Top panel" : "Bottom panel",
          [width - 2 * t, bodyDepth, t],
          [0, cy, z],
          "panel",
          s.material,
          { thicknessAxis: 2 },
        );
    }
    if (plinth) {
      add(
        "plinth",
        "Recessed plinth",
        [width - 2 * t, t, plinth],
        [0, -depth / 2 + 65, plinth / 2],
        "panel",
        s.material,
        { thicknessAxis: 1 },
      );
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          fitting(
            "foot" + x + y,
            "Adjustable cabinet foot",
            [40, 40, plinth],
            [x * (width / 2 - 55), y * (depth / 2 - 65), plinth / 2],
          );
    }
    const usable = width - (bays.length + 1) * t,
      total = bays.reduce((a, b) => a + b.weight, 0);
    let left = -width / 2 + t;
    bays.forEach((b, i) => {
      const cw = (usable * b.weight) / total,
        right = left + cw,
        baseBottom = z0 + t,
        top = z1 - t,
        k = "bay" + i;
      let bottom = baseBottom,
        interior = b.type;
      if (cw < 120)
        throw Error("Each compartment needs at least 120 mm clear width");
      if (i)
        add(
          k + "/divider",
          "Vertical divider",
          [t, bodyDepth, bodyHeight - 2 * t],
          [left - t / 2, cy, (top + bottom) / 2],
          "panel",
          s.material,
          { thicknessAxis: 0 },
        );
      const backLeft = i ? left - t / 2 : -width / 2,
        backRight = i < bays.length - 1 ? right + t / 2 : width / 2,
        backCount = Math.ceil((backRight - backLeft) / 1200),
        backWidth = (backRight - backLeft) / backCount;
      for (let j = 0; j < backCount; j++)
        add(
          k + "/back" + j,
          "Back panel",
          [backWidth, bt, bodyHeight],
          [
            backLeft + (j + 0.5) * backWidth,
            depth / 2 - bt / 2,
            z0 + bodyHeight / 2,
          ],
          "back",
          s.backMaterial,
          { thicknessAxis: 1 },
        );
      if (b.type === "mixed") {
        if (top - bottom - b.drawerHeight < 250)
          throw Error("Leave at least 250 mm above the lower drawer section");
        drawers(
          k,
          left,
          right,
          bottom,
          bottom + b.drawerHeight,
          frontY,
          bodyDepth,
          b.drawers,
        );
        add(
          k + "/separator",
          "Storage divider shelf",
          [cw, bodyDepth, t],
          [(left + right) / 2, cy, bottom + b.drawerHeight + t / 2],
          "shelf",
          s.material,
          { thicknessAxis: 2 },
        );
        bottom += b.drawerHeight + t;
        interior = b.upperType;
      }
      if (interior === "shelves" || interior === "hanging") {
        const count = interior === "hanging" ? 1 : b.shelves;
        if (count && (top - bottom) / (count + 1) < t + 35)
          throw Error("Too many shelves for this compartment height");
        for (let j = 0; j < count; j++) {
          const z =
            interior === "hanging"
              ? top - 250
              : bottom + ((j + 1) * (top - bottom)) / (count + 1);
          if (z <= bottom + t)
            throw Error(
              "Hanging compartment needs at least 350 mm clear height",
            );
          add(
            k + "/shelf" + j,
            "Adjustable shelf",
            [cw - 2, bodyDepth - 20, t],
            [(left + right) / 2, cy + 10, z],
            "shelf",
            s.material,
            { thicknessAxis: 2 },
          );
          for (const x of [-1, 1])
            for (const y of [-1, 1])
              fitting(
                k + "/pin" + j + x + y,
                "Shelf support",
                [6, 8, 6],
                [
                  (left + right) / 2 + x * (cw / 2 - 4),
                  cy + y * (bodyDepth / 2 - 40),
                  z - t / 2 - 3,
                ],
              );
        }
        if (interior === "hanging")
          add(
            k + "/rail",
            "Hanging rail",
            [25, 25, cw - 8],
            [(left + right) / 2, cy, top - 310],
            "hardware",
            s.hardwareMaterial,
            {
              kind: "cylinder",
              rotation: [0, 90, 0],
              hardwareType: "Hanging rail",
            },
          );
      }
      if (b.type === "drawers")
        drawers(k, left, right, bottom, top, frontY, bodyDepth, b.drawers);
      else if (fronts && !sliding && interior !== "open" && b.doors) {
        const fl = left - t + reveal + (i ? t / 2 : 0),
          fr = right + t - reveal - (i < bays.length - 1 ? t / 2 : 0);
        const doorBottom =
          b.type === "mixed" ? bottom - t + reveal : z0 + reveal;
        if (b.doors === 2) {
          const mid = (fl + fr) / 2;
          door(
            k + "/doorL",
            fl,
            mid - reveal / 2,
            doorBottom,
            z1 - reveal,
            frontY,
            "left",
          );
          door(
            k + "/doorR",
            mid + reveal / 2,
            fr,
            doorBottom,
            z1 - reveal,
            frontY,
            "right",
          );
        } else
          door(k + "/door", fl, fr, doorBottom, z1 - reveal, frontY, b.hinge);
      }
      left = right + t;
    });
    if (blind)
      add(
        "blind-filler",
        "Blind corner front panel",
        [blind.width - 2 * reveal, t, bodyHeight - 2 * reveal],
        [
          ((blind.side === "right" ? 1 : -1) * (width - blind.width)) / 2,
          frontY,
          z0 + bodyHeight / 2,
        ],
        "panel",
        s.frontMaterial,
        { thicknessAxis: 1 },
      );
    if (sliding) {
      const overlap = 25,
        panelWidth = (width - 2 * reveal + overlap) / 2,
        panelHeight = bodyHeight - 2 * reveal;
      for (let i = 0; i < 2; i++) {
        const x =
            -width / 2 + reveal + panelWidth / 2 + i * (panelWidth - overlap),
          y = -depth / 2 + t / 2 + i * (t + reveal),
          mechanism = {
            kind: "slide",
            direction: [-1, 0, 0],
            travel: i ? panelWidth - overlap : 0,
          };
        add(
          "sliding" + i,
          "Sliding door",
          [panelWidth, t, panelHeight],
          [x, y, z0 + bodyHeight / 2],
          "door",
          s.frontMaterial,
          { mechanism, thicknessAxis: 1 },
        );
        if (s.handles)
          fitting(
            "sliding" + i + "/handle",
            "Recessed sliding pull",
            [12, 2, 128],
            [x + panelWidth / 2 - 40, y - t / 2, z0 + bodyHeight * 0.6],
            mechanism,
          );
      }
      for (const z of [z0 + 5, z1 - 5])
        fitting(
          "track" + z,
          "Sliding door track",
          [width - 2 * t, 2 * t + reveal, 8],
          [0, -depth / 2 + t + reveal / 2, z],
        );
    }
    if (worktop) {
      const over = s.worktopOverhang,
        tw = width,
        td = depth + over,
        w = tw / 2,
        d = td / 2;
      const opts = { thicknessAxis: 2 };
      if (cutout) {
        const holeW = Math.min(width - 150, cutout === "sink" ? 550 : 560),
          holeD = Math.min(depth - 160, cutout === "sink" ? 400 : 480);
        if (holeW < 180 || holeD < 180)
          throw Error("The sink/hob module is too small for a worktop cutout");
        Object.assign(opts, {
          kind: "profile",
          profile: [
            [-w, -d],
            [w, -d],
            [w, d],
            [-w, d],
          ],
          holes: [
            [
              [-holeW / 2, -holeD / 2],
              [-holeW / 2, holeD / 2],
              [holeW / 2, holeD / 2],
              [holeW / 2, -holeD / 2],
            ],
          ],
          cutout: { type: cutout, width: holeW, depth: holeD },
        });
      }
      add(
        "worktop",
        "Worktop" + (cutout ? " · " + cutout + " cutout" : ""),
        [tw, td, s.worktopThickness],
        [0, -over / 2, height - s.worktopThickness / 2],
        "worktop",
        s.worktopMaterial,
        opts,
      );
    }
    frame = prevFrame;
  }
  if (s.type === "kitchen") {
    const runs = s.layout === "straight" ? 1 : s.layout === "L" ? 2 : 3;
    const runWidths = Array.from({ length: runs }, (_, run) =>
      s.modules
        .filter((m) => m.run === run && m.type !== "wall")
        .reduce((a, m) => a + m.width, 0),
    );
    const cornerWidth = s.depth + 400,
      leftCorner = runs === 3 ? cornerWidth : 0,
      totalWidth = runWidths[0] + (runs - 1) * cornerWidth;
    // The front of a blind corner has an accessible 400 mm door and a fixed
    // panel behind the return. A service clearance keeps perpendicular fronts apart.
    const gap = s.depth + s.worktopOverhang + 50;
    for (let run = 0; run < runs; run++) {
      let cursor = 0,
        wallCursor = 0;
      s.modules.forEach((m, index) => {
        if (m.run !== run) return;
        const isWall = m.type === "wall",
          isTall = m.type === "tall",
          angle = run === 0 ? 0 : run === 1 ? -90 : 90;
        const along = (isWall ? wallCursor : cursor) + m.width / 2;
        const origin =
          run === 0
            ? [along - totalWidth / 2 + leftCorner, 0, 0]
            : run === 1
              ? [totalWidth / 2 - s.depth / 2, -gap - along + s.depth / 2, 0]
              : [-totalWidth / 2 + s.depth / 2, -gap - along + s.depth / 2, 0];
        const cfg = {
          ...bay(
            m.type === "drawers"
              ? "drawers"
              : m.type === "open"
                ? "open"
                : "shelves",
            m.type === "sink" ? 0 : isTall ? 5 : isWall ? 2 : 1,
          ),
          doors: m.width > 650 ? 2 : 1,
        };
        const cutout = ["sink", "hob"].includes(m.type) ? m.type : null;
        cabinet({
          key: "module" + index,
          name: `${run === 0 ? "Main" : run === 1 ? "Right" : "Left"} · ${KITCHEN_MODULES.find((t) => t[0] === m.type)[1]} ${m.width}`,
          width: m.width,
          depth: isWall ? s.wallDepth : s.depth,
          height: isWall ? s.wallHeight : isTall ? s.tallHeight : s.height,
          plinth: isWall ? 0 : s.plinth,
          bays: [cfg],
          origin: [origin[0], origin[1], isWall ? s.wallElevation : 0],
          angle,
          fronts: s.fronts,
          cutout,
          worktop: !isWall && !isTall,
        });
        if (s.wallUnits && !isWall && !isTall) {
          const displacement = (s.depth - s.wallDepth) / 2,
            wallOrigin = vec([0, displacement, s.wallElevation], angle, origin);
          cabinet({
            key: "wall" + index,
            name: "Wall cabinet " + m.width,
            width: m.width,
            depth: s.wallDepth,
            height: s.wallHeight,
            plinth: 0,
            bays: [{ ...bay("shelves", 2), doors: m.width > 650 ? 2 : 1 }],
            origin: wallOrigin,
            angle,
            fronts: s.fronts,
          });
        }
        if (isWall) wallCursor += m.width;
        else cursor += m.width;
      });
    }
    for (let corner = 1; corner < runs; corner++) {
      const side = corner === 1 ? "right" : "left",
        sign = side === "right" ? 1 : -1,
        origin = [(sign * (totalWidth - cornerWidth)) / 2, 0, 0],
        accessible = {
          ...bay("shelves", 1),
          weight: 400 - 1.5 * s.thickness,
          hinge: side === "right" ? "left" : "right",
        },
        blindBay = {
          ...bay("open", 0),
          weight: s.depth - 1.5 * s.thickness,
          doors: 0,
        },
        bays =
          side === "right" ? [accessible, blindBay] : [blindBay, accessible];
      cabinet({
        key: "corner" + side,
        name: "Blind corner · " + side,
        width: cornerWidth,
        depth: s.depth,
        height: s.height,
        bays,
        origin,
        worktop: true,
        blind: { side, width: s.depth },
      });
      add(
        "corner-joint" + side,
        "Corner worktop joint",
        [s.depth + s.worktopOverhang, 50, s.worktopThickness],
        [
          sign * (totalWidth / 2 - (s.depth + s.worktopOverhang) / 2),
          -s.depth / 2 - s.worktopOverhang - 25,
          s.height - s.worktopThickness / 2,
        ],
        "worktop",
        s.worktopMaterial,
        { thicknessAxis: 2 },
      );
      if (s.wallUnits)
        cabinet({
          key: "wall-corner" + side,
          name: "Wall corner · " + side,
          width: cornerWidth,
          depth: s.wallDepth,
          height: s.wallHeight,
          plinth: 0,
          bays,
          origin: [origin[0], (s.depth - s.wallDepth) / 2, s.wallElevation],
          blind: { side, width: s.depth },
        });
    }
  } else if (s.type === "desk") {
    const t = s.worktopThickness,
      z = s.height - t;
    add(
      "desktop",
      "Desktop",
      [s.width, s.depth, t],
      [0, 0, s.height - t / 2],
      "worktop",
      s.material,
      { thicknessAxis: 2 },
    );
    const pedestal = s.deskStorage ? Math.min(450, s.width * 0.32) : 0;
    if (s.width - pedestal < 550)
      throw Error(
        "Leave at least 550 mm of knee space beside the desk storage",
      );
    if (pedestal)
      cabinet({
        key: "pedestal",
        name: "Desk drawer pedestal",
        width: pedestal,
        depth: s.depth - 40,
        height: z,
        plinth: 60,
        bays: [bay("drawers")],
        origin: [-(s.width - pedestal) / 2, 20, 0],
      });
    for (const sign of [-1, 1])
      if (sign === 1 || !pedestal) {
        for (const y of [-1, 1])
          fitting(
            "leg" + sign + y,
            "Desk leg",
            [40, 40, z],
            [sign * (s.width / 2 - 45), y * (s.depth / 2 - 45), z / 2],
          );
      }
    add(
      "modesty",
      "Modesty panel",
      [s.width - pedestal - 90, s.thickness, 250],
      [pedestal / 2, s.depth / 2 - 45, z - 150],
      "panel",
      s.material,
      { thicknessAxis: 1 },
    );
  } else {
    cabinet({
      key: "carcass",
      name: "Cabinet assembly",
      width: s.width,
      depth: s.depth,
      height: s.height,
    });
    if (s.type === "tv" && s.tvPanel)
      add(
        "tv-panel",
        "TV wall panel",
        [s.width, s.thickness, 1200],
        [0, s.depth / 2 + s.thickness / 2, s.height + 650],
        "panel",
        s.frontMaterial,
        { thicknessAxis: 1 },
      );
  }
  for (const o of objects)
    if (o.role === "hardware")
      hardware.push({ id: o.id, name: o.hardwareType || o.name, size: o.size });
  const result = { objects, groups, hardware };
  setFurnitureOpen(result, id, s.open);
  return result;
}

export function setFurnitureOpen(project, id, fraction) {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw Error("Opening must be between 0 and 1");
  if (
    project.objects.some((o) => o.furnitureId === id && o.mechanism && o.locked)
  )
    throw Error("Unlock the furniture fronts before opening or closing them");
  for (const o of project.objects.filter(
    (o) => o.furnitureId === id && o.mechanism,
  )) {
    const m = o.mechanism;
    if (m.kind === "slide") {
      o.position = m.closedPosition.map(
        (n, i) => n + m.direction[i] * m.travel * fraction,
      );
      o.rotation = [...m.closedRotation];
    } else {
      const angle = m.angle * fraction;
      const turn = new Quaternion().setFromAxisAngle(
        new Vector3(...(m.axis || [0, 0, 1])),
        rad(angle),
      );
      o.position = new Vector3(...m.closedPosition)
        .sub(new Vector3(...m.pivot))
        .applyQuaternion(turn)
        .add(new Vector3(...m.pivot))
        .toArray();
      const q = turn.multiply(
        new Quaternion().setFromEuler(new Euler(...m.closedRotation.map(rad))),
      );
      const e = new Euler().setFromQuaternion(q);
      o.rotation = [e.x, e.y, e.z].map((n) => (n * 180) / Math.PI);
    }
  }
  const g = project.groups.find((g) => g.id === id);
  if (g?.furnitureSpec) g.furnitureSpec.open = fraction;
}
export function selectedFurniture(project, selection) {
  const ids = new Set(
    project.objects
      .filter((o) => selection.includes(o.id))
      .map((o) => o.furnitureId)
      .filter(Boolean),
  );
  return project.groups.filter((g) => ids.has(g.id) && g.furnitureSpec);
}
export function replaceFurniture(project, id, spec) {
  const before = project.objects.filter((o) => o.furnitureId === id);
  if (before.some((o) => o.locked))
    throw Error("Unlock this furniture before changing its configuration");
  const generated = buildFurniture(spec, { id, previous: before });
  const removed = new Set(before.map((o) => o.id)),
    oldGroups = new Set([id, ...before.map((o) => o.groupId)]);
  project.objects = project.objects.filter(
    (o) => !removed.has(o.id) && !removed.has(o.hostId),
  );
  project.groups = project.groups.filter((g) => !oldGroups.has(g.id));
  project.objects.push(...generated.objects);
  project.groups.push(...generated.groups);
  return generated.objects.map((o) => o.id);
}
