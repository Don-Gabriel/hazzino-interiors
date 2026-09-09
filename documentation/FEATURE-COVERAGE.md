# Hackathon feature coverage

The supplied DOCX is the product reference. The user's direct request sets the delivery target: a working local browser app, architecture/interiors first, built today with every implementation step recorded separately.

| Brief requirement                                    | Delivered implementation                                              | Limits                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| React + Three.js workspace                           | React/Vite UI and Three.js editor                                     | Desktop optimized                                       |
| Orbit, pan, zoom, grid                               | OrbitControls and world XY grid                                       | Grid is finite                                          |
| Rectangle creation                                   | Two-click rectangles on XY/XZ/YZ                                      | World drawing planes                                    |
| Board / box creation                                 | Dimension form and face extrusion                                     | Rectangular solids                                      |
| Exact dimensions                                     | mm/cm/m/in/ft property inputs                                         | Internally mm                                           |
| Selection                                            | Object, group, face, edge inspection                                  | Edge inspection is not topology editing                 |
| Move / rotate / resize                               | Gizmos and numeric properties                                         | Nonuniform assembly scaling has shear limits            |
| Duplicate / delete                                   | Buttons, keyboard, copy/paste                                         | Locked objects resist deletion                          |
| Group / ungroup                                      | Flat assemblies and component tree                                    | No nested hierarchy                                     |
| Basic snapping                                       | Grid increments and axis constraints                                  | Move handles snap to grid                               |
| Advanced drawing snaps                               | Endpoints, midpoints, edges, face centres, centres                    | Solid bounding features, no general intersection solver |
| Material application                                 | 12 presets, local wood grain, box-face assignments                    | Procedural textures, no external texture library        |
| Standard views                                       | Front/back/left/right/top/bottom/isometric/perspective                | Orthographic or perspective                             |
| Save / reopen                                        | JSON, per-project browser recovery, REST API                          | Browser recovery is origin-specific                     |
| MongoDB persistence                                  | Real disk-backed WiredTiger database                                  | Local workspace, no authentication                      |
| Demonstration furniture                              | Editable two-door wardrobe and furnished study                        | Saved in DB and example JSON files                      |
| Push/Pull                                            | Selected box face or profile extrusion                                | No arbitrary mesh face surgery                          |
| Line-to-face                                         | Closed-profile tool                                                   | Separate loose lines do not auto-stitch                 |
| Dimension tool                                       | Two-point annotations with object anchors                             | Free points remain fixed                                |
| Undo/redo                                            | Transaction snapshots, 80 entries                                     | History is session-local                                |
| Autosave / versions                                  | Browser after edits, DB every 30s, named checkpoints                  | No collaborative version merge                          |
| Arrays / mirror / alignment                          | Copy arrays, world-plane symmetric mirroring, rotated-bound alignment | Asymmetric profile mirror needs checking                |
| Layers / component library                           | Editable layers, visibility, furniture templates                      | Preset component catalogue                              |
| Collision checks                                     | Bounding overlap, thin part, floor checks                             | Conservative geometric warnings                         |
| Export                                               | JSON, GLB, OBJ, STL, PNG, CSV, SVG, HTML estimate                     | No native CAD import or drawing sheets                  |
| Added architecture                                   | Room envelopes, rectangular openings, section clipping                | Not a BIM engine                                        |
| Added end-to-end outputs                             | Board areas/volumes/edge lengths, rates, allowance, material estimate | No optimized nesting or certified manufacturing output  |
| AI-generated furniture                               | Local named-dimension template parser                                 | Explicitly deterministic, not AI                        |
| Vertex/edge editing, voice, DXF, cloud collaboration | Not included                                                          | Future work                                             |

The built app covers the mandatory hackathon modelling and persistence list. This coverage does not imply equivalence with the full SketchUp ecosystem or completion of every optional bonus feature.

## Hospital and keyboard extension — final scope
See JURY-DEMO.md for the current feature matrix and token/billing explanation. Gemini prompt-to-plan integration, semantic patient-room generation, local geometric checks, deterministic reflow and token ledger are implemented. Live provider success has not been verified because no user key is configured. Medical equipment is excluded from board-cost estimates. Function/numpad shortcuts and model clipboard operations are implemented with native text-editing safeguards. 40 tests pass.
