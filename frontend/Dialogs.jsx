import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  ArrowUpRight,
  Columns3,
  Download,
  FileJson,
  Box,
  Package,
  Camera,
  History,
  Search,
  FolderOpen,
  Trash2,
  Copy,
  Keyboard,
  Scissors,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useEditor, download, localProjects, localProject } from "./store.js";
import {
  entity,
  furniture,
  wardrobe,
  room,
  bom,
  csv,
  uid,
  clone,
  MATERIALS,
} from "../shared/model.js";
import { Numeric, IconButton, libraryItems, toolList } from "./App.jsx";
import { alignObjects, healthCheck } from "../shared/geometry.js";
import { quotationHTML, planSVG } from "../shared/reports.js";
import { shortcutGroups } from "./shortcuts.js";
import { Hospital } from "./Hospital.jsx";
import { WorkspaceSettings } from "./Workspace.jsx";
import { editorMenus, flattenCommands } from "./commands.js";
export function Dialog({ title, subtitle, children, onClose, wide = false }) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={"dialog " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        {children}
      </section>
    </div>
  );
}
export function Dialogs({ kind, close }) {
  if (kind === "workspace-settings") return <WorkspaceSettings close={close} />;
  if (kind === "hospital") return <Hospital close={close} />;
  if (kind === "health") return <HealthDialog close={close} />;
  if (kind === "opening") return <OpeningDialog close={close} />;
  if (kind === "projects") return <Projects close={close} />;
  if (kind === "bom") return <Quantities close={close} />;
  if (kind === "export") return <ExportDialog close={close} />;
  if (kind === "versions") return <Versions close={close} />;
  if (kind === "commands") return <Commands close={close} />;
  if (kind.startsWith("template:"))
    return <TemplateDialog type={kind.split(":")[1]} close={close} />;
  return <UtilityDialog kind={kind} close={close} />;
}
function OpeningDialog({ close }) {
  const [error, setError] = useState("");
  const s = useEditor(),
    o = s.project.objects.find((o) => s.selection.includes(o.id)),
    [v, setV] = useState({
      width: Math.min(900, o?.size[0] || 900),
      height: Math.min(2100, o?.size[2] || 2100),
      x: Math.max(0, ((o?.size[0] || 900) - 900) / 2),
      sill: 0,
    });
  if (!o)
    return (
      <Dialog title="Rectangular opening" onClose={close}>
        <div className="dialog-content">Select a box or wall first.</div>
      </Dialog>
    );
  return (
    <Dialog
      title="Create a door or window opening"
      subtitle={
        "Cut a real rectangular opening through " +
        o.name +
        ". Uses local X width, Y thickness and Z height."
      }
      onClose={close}
    >
      <div className="dialog-content">
        <div className="segmented">
          <button
            onClick={() =>
              setV({ ...v, height: Math.min(2100, o.size[2]), sill: 0 })
            }
          >
            Door
          </button>
          <button
            onClick={() =>
              setV({
                ...v,
                width: Math.min(1200, o.size[0]),
                height: Math.min(1200, o.size[2] / 2),
                x: 0,
                sill: Math.min(900, o.size[2] / 4),
              })
            }
          >
            Window
          </button>
        </div>
        <div className="form-grid">
          {[
            ["width", "Width"],
            ["height", "Height"],
            ["x", "From left edge"],
            ["sill", "Sill / from bottom"],
          ].map(([k, l]) => (
            <Numeric
              key={k}
              label={l + " · mm"}
              value={v[k]}
              min={["width", "height"].includes(k) ? 0.1 : 0}
              onChange={(n) => setV({ ...v, [k]: n })}
            />
          ))}
        </div>
        <p className="hint">
          Openings must fit inside the wall and must not overlap. Geometry and
          quantities are reduced together.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {o.openings?.map((a, i) => (
          <div className="version-row" key={a.id}>
            <Scissors size={15} />
            <span>
              Opening {i + 1}
              <small>
                {a.width} × {a.height} mm
              </small>
            </span>
            <IconButton
              icon={Trash2}
              label="Remove opening"
              onClick={() =>
                s.update(
                  o.id,
                  { openings: o.openings.filter((_, j) => j !== i) },
                  "Remove opening",
                )
              }
            />
          </div>
        ))}
      </div>
      <div className="dialog-footer">
        <button className="secondary" onClick={close}>
          Close
        </button>
        <button
          className="primary"
          onClick={() => {
            s.update(
              o.id,
              { openings: [...(o.openings || []), { id: uid(), ...v }] },
              "Cut rectangular opening",
            );
            if (useEditor.getState().status === "Cut rectangular opening")
              close();
            else setError(useEditor.getState().status);
          }}
        >
          Cut opening <Scissors size={15} />
        </button>
      </div>
    </Dialog>
  );
}
function HealthDialog({ close }) {
  const s = useEditor(),
    warnings = healthCheck(s.project);
  return (
    <Dialog
      title="Model checks"
      subtitle="Find thin parts, furniture below the floor, and intersecting bounding boxes. Rotated shapes may produce conservative overlap warnings."
      onClose={close}
    >
      <div className="dialog-content">
        {!warnings.length ? (
          <div className="empty-state">
            <CheckCircle2 size={40} />
            <h3>No issues found by these checks</h3>
            <p>
              These are geometric checks, not a structural or manufacturing
              certification.
            </p>
          </div>
        ) : (
          warnings.map((w, i) => (
            <button
              className="version-row full"
              key={i}
              onClick={() => {
                s.set({ selection: w.ids });
                close();
              }}
            >
              <AlertTriangle size={16} />
              <span style={{ textAlign: "left" }}>
                <strong>{w.message}</strong>
                <small>{w.type}</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
}
function TemplateDialog({ type, close }) {
  const s = useEditor(),
    [v, setV] = useState(
      type === "room"
        ? { width: 5000, depth: 4000, height: 2800, thickness: 150 }
        : {
            width: type === "shelf" ? 900 : 1200,
            depth: type === "shelf" ? 350 : 600,
            height: type === "shelf" ? 1800 : 2100,
            thickness: 18,
            shelves: 3,
            doors: type !== "shelf",
          },
    );
  const title = libraryItems.find((i) => i[0] === type)?.[1] || "Component";
  const [error, setError] = useState("");
  return (
    <Dialog
      title={"Create " + title.toLowerCase()}
      subtitle="Every component remains individually editable. Dimensions in millimetres."
      onClose={close}
    >
      <div className="dialog-content">
        <div className="template-preview">
          <Columns3 size={80} strokeWidth={0.7} />
        </div>
        {["wardrobe", "room", "shelf"].includes(type) && (
          <div className="form-grid">
            {["width", "depth", "height", "thickness"].map((k) => (
              <Numeric
                key={k}
                label={k}
                value={v[k]}
                min={1}
                onChange={(n) => setV({ ...v, [k]: n })}
              />
            ))}
            {type !== "room" && (
              <Numeric
                label="Shelf rows"
                value={v.shelves}
                min={0}
                onChange={(n) =>
                  setV({ ...v, shelves: Math.min(20, Math.round(n)) })
                }
              />
            )}
          </div>
        )}
        {type === "wardrobe" && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={v.doors}
              onChange={(e) => setV({ ...v, doors: e.target.checked })}
            />
            Include doors and handles
          </label>
        )}
        {type === "room" && (
          <p className="hint">
            The front is open for an unobstructed interior view. Walls sit
            outside the clear room dimensions.
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="dialog-footer">
        <button className="secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={() => {
            try {
              s.add(
                type === "shelf"
                  ? wardrobe({ ...v, doors: false })
                  : furniture(type, v),
                "Create " + title,
              );
              close();
              setTimeout(() => s.engine?.fit(), 50);
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <Plus size={15} /> Add to workspace
        </button>
      </div>
    </Dialog>
  );
}
function UtilityDialog({ kind, close }) {
  const s = useEditor(),
    [name, setName] = useState(
      kind === "layer" ? "New layer" : "Untitled design",
    ),
    [v, setV] = useState({
      width: 600,
      depth: 18,
      height: 2100,
      count: 3,
      x: 600,
      y: 0,
      z: 0,
    }),
    [axis, setAxis] = useState("X"),
    [align, setAlign] = useState("min"),
    [shape, setShape] = useState("box");
  const change = (k, n) => setV({ ...v, [k]: n });
  const title = {
    board: "Create a board or solid",
    new: "Start a new project",
    layer: "Add a layer",
    array: "Array duplication",
    align: "Align selection",
    mirror: "Mirror selection",
    settings: "Workspace preferences",
    help: "Make yourself at home",
  }[kind];
  async function apply() {
    if (kind === "new") {
      if (s.dirty) await s.save();
      s.newProject(name);
    }
    if (kind === "layer" && name.trim())
      s.commit("Add layer", (p) => {
        if (!p.layers.some((l) => l.id === name))
          p.layers.push({ id: name, visible: true });
      });
    if (kind === "board")
      s.add(
        [
          entity({
            name: shape === "cylinder" ? "Cylinder" : "Custom board",
            kind: shape,
            size: [v.width, v.depth, v.height],
            position: [0, 0, v.height / 2],
          }),
        ],
        "Create solid",
      );
    if (kind === "array") s.duplicate([v.x, v.y, v.z], Math.round(v.count));
    if (kind === "mirror") {
      const i = "XYZ".indexOf(axis),
        objs = s.project.objects.filter((o) => s.selection.includes(o.id));
      if (
        objs.some(
          (o) => !["box", "cylinder"].includes(o.kind) || o.openings?.length,
        )
      ) {
        s.notify(
          "Mirror supports uncut boxes and cylinders; use duplicate for other shapes.",
        );
        return;
      }
      s.add(
        objs.map((o) => ({
          ...clone(o),
          id: uid(),
          groupId: null,
          name: o.name + " mirrored",
          position: o.position.map((n, a) => (a === i ? -n : n)),
          rotation: o.rotation.map((n, a) => (a === i ? n : -n)),
        })),
        "Mirror across " + axis + "=0",
      );
    }
    if (kind === "align") {
      const objects = s.project.objects.filter((o) =>
        s.selection.includes(o.id),
      );
      const updates = alignObjects(objects, axis, align);
      s.commit("Align selection", (p) =>
        updates.forEach((u) => {
          const o = p.objects.find((o) => o.id === u.id);
          if (o && !o.locked) o.position = u.position;
        }),
      );
    }
    close();
  }
  return (
    <Dialog title={title} onClose={close}>
      <div className="dialog-content">
        {["new", "layer"].includes(kind) && (
          <label className="field-label">
            Name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {kind === "new" && (
          <p className="hint">
            The current project is saved first if the database is connected.
            Export a JSON backup before starting a new design when the database
            is offline.
          </p>
        )}
        {kind === "board" && (
          <>
            <div className="segmented">
              <button
                className={shape === "box" ? "active" : ""}
                onClick={() => setShape("box")}
              >
                Board / box
              </button>
              <button
                className={shape === "cylinder" ? "active" : ""}
                onClick={() => setShape("cylinder")}
              >
                Cylinder
              </button>
            </div>
            <div className="form-grid">
              {["width", "depth", "height"].map((k) => (
                <Numeric
                  key={k}
                  label={k + " (mm)"}
                  value={v[k]}
                  min={0.1}
                  onChange={(n) => change(k, n)}
                />
              ))}
            </div>
            <p className="hint">
              Z is vertical. Position refers to the object's centre. A 600 × 18
              × 2100 board starts standing on the ground.
            </p>
          </>
        )}
        {kind === "array" && (
          <>
            <Numeric
              label="Number of copies"
              value={v.count}
              min={1}
              onChange={(n) => change("count", Math.min(100, n))}
            />
            <h3 style={{ margin: "20px 0 12px" }}>Offset per copy · mm</h3>
            <div className="numeric-triple">
              {["x", "y", "z"].map((k) => (
                <Numeric
                  key={k}
                  label={k.toUpperCase()}
                  value={v[k]}
                  onChange={(n) => change(k, n)}
                />
              ))}
            </div>
          </>
        )}
        {["align", "mirror"].includes(kind) && (
          <>
            <label className="field-label">
              Axis
              <select value={axis} onChange={(e) => setAxis(e.target.value)}>
                {["X", "Y", "Z"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            {kind === "align" ? (
              <>
                <label className="field-label">
                  Align to first selected object
                  <select
                    value={align}
                    onChange={(e) => setAlign(e.target.value)}
                  >
                    <option value="min">Minimum face</option>
                    <option value="center">Centre</option>
                    <option value="max">Maximum face</option>
                  </select>
                </label>
                <p className="hint">
                  Aligns actual world bounding faces, including rotated boards.
                </p>
              </>
            ) : (
              <p className="hint">
                Creates copies across world {axis}=0. Uncut boxes and cylinders
                are supported.
              </p>
            )}
          </>
        )}
        {kind === "settings" && (
          <>
            <label className="field-label">
              Display units
              <select
                value={s.project.settings.unit}
                onChange={(e) =>
                  s.commit(
                    "Change display units",
                    (p) => (p.settings.unit = e.target.value),
                  )
                }
              >
                {["mm", "cm", "m", "in", "ft"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <Numeric
              label="Grid spacing · mm"
              value={s.project.settings.grid}
              min={10}
              onChange={(n) =>
                s.commit("Set grid spacing", (p) => (p.settings.grid = n))
              }
            />
            <div style={{ height: 12 }} />
            <Numeric
              label="Snap increment · mm"
              value={s.project.settings.snap}
              min={0.1}
              onChange={(n) =>
                s.commit("Set snap increment", (p) => (p.settings.snap = n))
              }
            />
            <div style={{ height: 12 }} />
            <Numeric
              label="Estimate waste · %"
              value={s.project.settings.waste}
              min={0}
              onChange={(n) =>
                s.commit("Set waste allowance", (p) => (p.settings.waste = n))
              }
            />
            <p className="hint">
              All coordinates are stored in millimetres. Recovery is written
              after each edit; MongoDB autosave runs every 30 seconds.
            </p>
          </>
        )}
        {kind === "help" && (
          <>
            <p className="help-lead">From a first line to the final board.</p>
            <ol className="help-steps">
              <li>
                Choose XZ for an upright drawing plane, or XY for the floor.
              </li>
              <li>
                Rectangle (R): click two corners. Enter exact dimensions in
                Properties.
              </li>
              <li>Push/Pull (E): select a face, enter 18 mm, and apply.</li>
              <li>
                Move (M), Rotate (Q), Resize (S): drag an axis handle or enter
                exact properties.
              </li>
              <li>
                Shift-click multiple parts. Ctrl G groups them. Select an
                assembly in the Model tree to move all its parts.
              </li>
              <li>
                Save the project. File → Open projects reopens the editable
                design.
              </li>
            </ol>
            {shortcutGroups.map((group) => (
              <section key={group.name} className="shortcut-section">
                <h3>{group.name}</h3>
                <div className="shortcut-grid">
                  {group.items.map(([key, label]) => (
                    <div key={key}>
                      <kbd>{key}</kbd>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <p className="hint">
              Left drag orbits; right drag pans; wheel zooms. Close profiles by
              clicking the start or pressing Enter. Face and edge editing beyond
              extrusion are not general CAD topology operations.
            </p>
          </>
        )}
      </div>
      <div className="dialog-footer">
        <button className="secondary" onClick={close}>
          {["help", "settings"].includes(kind) ? "Done" : "Cancel"}
        </button>
        {!["help", "settings"].includes(kind) && (
          <button className="primary" onClick={apply}>
            {kind === "new" ? "Create project" : "Apply"}{" "}
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
    </Dialog>
  );
}
function Projects({ close }) {
  const s = useEditor(),
    [projects, setProjects] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = () =>
    fetch("/api/projects")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setProjects(d);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <Dialog
      title="Your projects"
      subtitle="Stored in your local MongoDB database."
      onClose={close}
      wide
    >
      <div className="dialog-content">
        {loading && <p>Loading projects…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && !projects.length && (
          <div className="empty-state">
            <FolderOpen size={35} />
            <h3>No saved projects yet</h3>
            <p>Save your current design to keep it here.</p>
            <button
              className="primary"
              onClick={async () => {
                await s.save();
                refresh();
              }}
            >
              Save current project
            </button>
          </div>
        )}
        <details style={{ marginBottom: 20 }}>
          <summary style={{ cursor: "pointer", color: "#718a60" }}>
            Browser recovery copies ({localProjects().length})
          </summary>
          {localProjects().map((p) => (
            <div className="version-row" key={p.id}>
              <FileJson size={16} />
              <span>
                <strong>{p.name}</strong>
                <small>{new Date(p.updatedAt).toLocaleString()}</small>
              </span>
              <button
                className="secondary"
                onClick={() => {
                  try {
                    s.load(localProject(p.id));
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Recover
              </button>
            </div>
          ))}
        </details>
        <div className="projects-grid">
          {projects.map((p) => (
            <div className="project-card" key={p.id}>
              <div className="project-thumbnail">
                <Box size={55} strokeWidth={0.8} />
                <span>HAZZINO STUDIO</span>
              </div>
              <h3>{p.name}</h3>
              <p>{new Date(p.updatedAt).toLocaleString()}</p>
              <div>
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/projects/" + p.id);
                      const d = await r.json();
                      if (!r.ok) throw Error(d.error);
                      s.load(d);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Open design <ArrowUpRight size={14} />
                </button>
                <IconButton
                  icon={Trash2}
                  label={"Delete " + p.name}
                  onClick={async () => {
                    if (
                      !window.confirm("Delete saved project “" + p.name + "”?")
                    )
                      return;
                    try {
                      const r = await fetch("/api/projects/" + p.id, {
                        method: "DELETE",
                      });
                      if (!r.ok) throw Error((await r.json()).error);
                      refresh();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
export function quantityCSV(p, rows = bom(p)) {
  return csv([
    [
      "Part",
      "Assembly",
      "Material",
      "X (mm)",
      "Y (mm)",
      "Z (mm)",
      "Area (m2)",
      "Volume (m3)",
      "Edge length (m)",
      "Rate INR/m2",
      "Cost INR",
    ],
    ...rows.map((r) => [
      r.name,
      r.group,
      r.material,
      ...r.size,
      r.area.toFixed(4),
      r.volume.toFixed(6),
      r.edge.toFixed(3),
      r.rate,
      r.cost.toFixed(2),
    ]),
  ]);
}
function Quantities({ close }) {
  const s = useEditor(),
    rows = bom(s.project),
    [filter, setFilter] = useState("All"),
    [search, setSearch] = useState("");
  const shown = rows.filter(
      (r) =>
        (filter === "All" || r.layer === filter) &&
        r.name.toLowerCase().includes(search.toLowerCase()),
    ),
    subtotal = shown.reduce((n, r) => n + r.cost, 0),
    waste = s.project.settings.waste / 100;
  const money = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  const exportCSV = () =>
    download(
      quantityCSV(s.project, shown),
      s.project.name + "-quantities.csv",
      "text/csv",
    );
  return (
    <Dialog
      title="Quantities & material estimate"
      subtitle="Live quantities and editable rates. Medical equipment is excluded; obtain supplier quotations."
      onClose={close}
      wide
    >
      <div className="dialog-content">
        <div className="estimate-cards">
          <div>
            <span>Parts</span>
            <strong>{shown.length}</strong>
          </div>
          <div>
            <span>Board / finish area</span>
            <strong>
              {shown.reduce((n, r) => n + r.area, 0).toFixed(2)}{" "}
              <small>m²</small>
            </strong>
          </div>
          <div>
            <span>Material subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>With {s.project.settings.waste}% allowance</span>
            <strong>{money(subtotal * (1 + waste))}</strong>
          </div>
        </div>
        <div className="table-toolbar">
          <div className="panel-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter parts"
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All</option>
            {s.project.layers
              .filter((l) => l.id !== "Annotations")
              .map((l) => (
                <option key={l.id}>{l.id}</option>
              ))}
          </select>
          <button className="secondary" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PART / ASSEMBLY</th>
                <th>MATERIAL</th>
                <th>X × Y × Z · MM</th>
                <th>AREA · M²</th>
                <th>RATE</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => {
                    s.select(r.id);
                    close();
                  }}
                >
                  <td>
                    <strong>{r.name}</strong>
                    <small>{r.group}</small>
                  </td>
                  <td>{r.material}</td>
                  <td className="mono">
                    {r.size.map((n) => Math.round(n * 10) / 10).join(" × ")}
                  </td>
                  <td>{r.area.toFixed(3)}</td>
                  <td>{money(r.rate)}</td>
                  <td>{money(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Box area is its largest board face. Cylinder/profile area is total
          surface area. Hidden parts remain included. Material planning only:
          excludes labour, hardware, taxes, sheet nesting, and structural
          calculations.
        </p>
      </div>
      <div className="dialog-footer">
        <button
          className="secondary"
          onClick={() => s.set({ modal: "export" })}
        >
          More formats
        </button>
        <button className="primary" onClick={exportCSV}>
          <Download size={14} /> Download production quantities
        </button>
      </div>
    </Dialog>
  );
}
function ExportDialog({ close }) {
  const s = useEditor();
  const options = [
    [
      "json",
      "Editable project",
      "Objects, groups, materials, views and settings",
      FileJson,
    ],
    ["glb", "GLB · 3D exchange", "Visible solids · metres · Y-up", Box],
    [
      "obj",
      "OBJ · mesh geometry",
      "Visible solids · millimetres · Z-up",
      Package,
    ],
    [
      "stl",
      "STL · fabrication mesh",
      "Visible solids · millimetres · Z-up",
      Box,
    ],
    [
      "png",
      "Viewport image",
      "Current camera and presentation settings",
      Camera,
    ],
    [
      "csv",
      "Production quantities",
      "Parts, dimensions, materials and estimates",
      Columns3,
    ],
    [
      "quote",
      "Printable material estimate",
      "HTML report · print or save as PDF",
      FileJson,
    ],
    [
      "svg",
      "Floor plan · SVG",
      "Visible box footprints · vector projection",
      Columns3,
    ],
  ];
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function act(id) {
    setBusy(id);
    try {
      if (id === "json")
        download(
          JSON.stringify(s.project, null, 2),
          s.project.name + ".hazzino.json",
        );
      else if (id === "quote")
        download(
          quotationHTML(s.project),
          s.project.name + "-estimate.html",
          "text/html",
        );
      else if (id === "svg")
        download(
          planSVG(s.project),
          s.project.name + "-plan.svg",
          "image/svg+xml",
        );
      else if (id === "png") s.engine?.snapshot();
      else if (id === "csv")
        download(
          quantityCSV(s.project),
          s.project.name + "-quantities.csv",
          "text/csv",
        );
      else await s.engine?.export(id);
      s.notify("Export complete");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Dialog
      title="Take your design further"
      subtitle="Editable project files, exchange meshes, and production data."
      onClose={close}
    >
      <div className="dialog-content export-list">
        {error && <p className="error">{error}</p>}
        {options.map(([id, name, desc, I]) => (
          <button key={id} disabled={!!busy} onClick={() => act(id)}>
            <div className="export-icon">
              <I size={23} />
            </div>
            <span>
              <strong>{busy === id ? "Exporting…" : name}</strong>
              <small>{desc}</small>
            </span>
            <Download size={17} />
          </button>
        ))}
      </div>
    </Dialog>
  );
}
function Versions({ close }) {
  const s = useEditor(),
    [versions, setVersions] = useState([]),
    [name, setName] = useState("Design checkpoint"),
    [error, setError] = useState("");
  async function refresh() {
    try {
      const r = await fetch("/api/projects/" + s.project.id + "/versions");
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setVersions(d);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <Dialog
      title="Design checkpoints"
      subtitle="Named snapshots stored in MongoDB. Restore any checkpoint to continue editing."
      onClose={close}
    >
      <div className="dialog-content">
        <div className="inline-field">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Checkpoint name"
          />
          <button
            className="primary"
            onClick={async () => {
              if (!(await s.save())) return;
              try {
                const r = await fetch(
                  "/api/projects/" + s.project.id + "/versions",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  },
                );
                if (!r.ok) throw Error((await r.json()).error);
                refresh();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Create
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {versions.map((v) => (
          <div className="version-row" key={v.id}>
            <History size={18} />
            <span>
              <strong>{v.name}</strong>
              <small>{new Date(v.createdAt).toLocaleString()}</small>
            </span>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const r = await fetch(
                    "/api/projects/" + s.project.id + "/versions/" + v.id,
                  );
                  const d = await r.json();
                  if (!r.ok) throw Error(d.error);
                  s.commit("Restore " + v.name, (p) => Object.assign(p, d));
                  close();
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Restore
            </button>
          </div>
        ))}
        {!versions.length && (
          <p className="hint">
            Create your first checkpoint before exploring a design alternative.
          </p>
        )}
      </div>
    </Dialog>
  );
}
function Commands({ close }) {
  const s = useEditor(),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  const actions = [
    ...flattenCommands(
      editorMenus(s, {
        importProject: () =>
          document.querySelector("input[data-project-import]")?.click(),
      }),
    ).map((c) => ({
      name: c.label,
      path: c.path,
      I: Search,
      run: c.run,
      disabled: c.disabled,
    })),
    ...libraryItems.map(([id, name, desc, I]) => ({
      name: "Create " + name,
      I,
      run: () => s.set({ modal: "template:" + id }),
    })),
    { name: "Save project", I: FileJson, run: s.save },
    {
      name: "Export project",
      I: Download,
      run: () => s.set({ modal: "export" }),
    },
  ];
  function generate() {
    const numbers = {};
    for (const k of ["width", "height", "depth", "thickness", "shelves"]) {
      const match = query.match(
        new RegExp(k + "\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)", "i"),
      );
      if (match) numbers[k] = Number(match[1]);
    }
    try {
      if (/wardrobe|cabinet/i.test(query))
        s.add(wardrobe(numbers), "Generate wardrobe from dimensions");
      else if (/room/i.test(query))
        s.add(room(numbers), "Generate room from dimensions");
      else {
        setError(
          "Try “wardrobe width 1200 height 2100 depth 600 shelves 3” or “room width 5000 depth 4000”.",
        );
        return;
      }
      close();
      setTimeout(() => s.engine?.fit(), 50);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Dialog
      title="Find a tool. Start an idea."
      subtitle="Search tools, or create a template from named dimensions. Runs locally without an AI service."
      onClose={close}
    >
      <div className="dialog-content">
        <div className="command-input">
          <Search size={20} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: wardrobe width 1800 shelves 4"
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
        </div>
        {query && (
          <button className="primary full" onClick={generate}>
            Generate from dimensions <ArrowUpRight size={14} />
          </button>
        )}
        {error && <p className="error">{error}</p>}
        <div className="command-results">
          {actions
            .filter((a) =>
              (a.name + " " + (a.path || ""))
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((a, i) => (
              <button
                key={i}
                disabled={a.disabled}
                onClick={() => {
                  close();
                  a.run();
                }}
              >
                <a.I size={17} />
                {a.name}
                {a.path && <small className="command-path">{a.path}</small>}
                <ArrowUpRight size={14} />
              </button>
            ))}
        </div>
      </div>
    </Dialog>
  );
}
