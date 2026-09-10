# Hazzino Studio — AI hospital interior design

## What we built

A working local browser application connects natural-language planning, editable 3D geometry, geometric validation, durable project storage and design exports. The hospital extension focuses on patient rooms and wards. It builds on the furniture and architecture editor, rather than replacing the model with a static AI image.

The user describes a room. Gemini returns a constrained JSON plan. The server checks dimensions and counts, generates actual editable assemblies, and evaluates their placement. The user reviews the result before applying it; applying is undoable. Requests such as “use the same dimensions but fit four beds” include the current hospital intent. Unsupported requested objects must be disclosed in Gemini's explanation.

## Run and demonstrate

1. Open http://127.0.0.1:5173 (development) or http://127.0.0.1:3001 (compiled application).
2. Add the key to `C:\WorkSpace\Hazzino\.env` as `GEMINI_API_KEY=your_key`. Save the file. AI requests reread it without restarting. Never put the key in frontend code or a VITE-prefixed variable.
3. Select **AI Hospital** and enter: “Create a 6m by 5m patient room with two beds, bedside cabinets, IV stands and a 1.2m central pathway.” Select **Generate with Gemini**.
4. Review the dimensions, explanation, geometric issues and token usage. Select **Apply layout to current project**. Orbit, select a part, change dimensions/materials, or move the assembly.
5. Open AI Hospital again to inspect current layout checks. Moving an assembly into the central strip produces an obstruction issue. **Reflow current layout** deterministically regenerates the current plan and is undoable; it does not spend AI tokens or guarantee that an overcrowded brief becomes feasible.
6. Save to MongoDB, reopen through Projects, export editable JSON or a mesh, and download the validation/token reports.

Without a key, **Preview local 2-bed template** offers a clearly labeled deterministic demonstration. It is not represented as an AI response. Live Gemini verification remains dependent on the user's key and account availability.

## Delivered scope and honest boundaries

| Capability | Delivered behavior |
|---|---|
| Natural-language generation | Server-side Gemini structured output into patient-room/ward parameters; bounded dimensions, 1–12 beds, optional cabinets and IV stands |
| Semantic furniture | Named hospital-bed assemblies with frame, mattress, headboard, footboard, safety rails and supports; bedside cabinets and IV stands; each part remains editable |
| Architecture | Dimensioned floor and three-wall room envelope, millimetre coordinates; open front for inspection |
| Validation | Assembly world bounding-box overlap, room bounds, floor/ceiling and reserved central circulation strip |
| Editing | Drawing planes, rectangles, closed profiles, exact push/pull, numeric dimensions, transforms, snapping, grouping, materials, undo/redo |
| Persistence | MongoDB projects and checkpoints; browser recovery; editable JSON round trip |
| Output | GLB, OBJ, STL, PNG, SVG footprints, CSV quantities and printable estimate |
| AI accounting | Actual successful-response token metadata, paid-rate projection, recent MongoDB ledger and downloadable JSON |

This release does not certify hospital safety, accessibility, fire egress, infection control or medical-equipment manufacture. The strip test is not pathfinding, door-swing analysis or a complete wheelchair route simulation. Numeric clearances are configurable planning assumptions. ICU equipment, nurse stations, pharmacy, reception generators, arbitrary AI CAD operations, IFC/BIM, collaboration and production payment processing remain future work. Generated medical equipment is conceptual procurement geometry, not a fabrication-ready medical device. Existing board/finish rates are illustrative, not vendor quotations.

## Keyboard demonstration

F1 opens the complete shortcut guide. Ctrl X/C/V cut/copy/paste model selections; Ctrl Shift V pastes in place; Ctrl Z/Y undo/redo; Ctrl D duplicates; Ctrl A selects; Ctrl G groups; Ctrl Shift G ungroups; Ctrl S saves. Normal text inputs keep native text editing. Arrow keys move in XY, Page Up/Down in Z; Shift multiplies the increment by ten and Alt reduces it to one tenth.

F2 renames, F3 fits, F4 switches the inspector, F6 cycles drawing planes, F7 toggles grid, F8 snapping, F9 section, F10 projects. F5/F11/F12 retain browser reload/fullscreen/developer-tools behavior. Numpad 1/3/7 select front/right/top; Ctrl reverses those views; 0 is isometric, 5 switches projection, 4/6/8/2 orbit, +/- zoom, decimal frames selection, multiply fits all and divide toggles X-ray. The guide is the authoritative complete mapping.

## Tokenization and billing explained to the jury

Tokens are the model's text units, not mouse clicks or fixed prices per furniture item. An AI job sends the system instructions, user request and compact current room intent as input. Gemini returns JSON as output. Manual drawing, local templates, reflow, geometry construction, validation, saving and exports consume **zero Gemini tokens**. A larger request or response can consume more tokens even when both create the same number of beds. The app reads provider `usageMetadata`; it does not pretend a character count is an exact token count. [Google token documentation](https://ai.google.dev/gemini-api/docs/tokens)

For the configured `gemini-2.5-flash-lite`, the standard text prices checked on 9 September 2026 are **$0.10 per million input tokens and $0.40 per million output tokens**, including thinking output. The app also knows Flash 2.5's $0.30/$2.50 rates; other model prices display as unavailable. Free-tier input/output are listed as free, subject to account limits. [Official pricing](https://ai.google.dev/gemini-api/docs/pricing)

`Projected paid USD = inputTokens × inputRate / 1,000,000 + (candidateTokens + thinkingTokens) × outputRate / 1,000,000`.

Example: 1,000 input tokens and 250 output tokens on Flash-Lite project to **$0.0002** at those rates; 1,000 identical jobs project to **$0.20** for model tokens alone. This is an illustrative calculation, not a measured request or customer charge. Hosting, database, taxes, currency conversion, payment fees and commercial margin are separate. A failed/timed-out request may still incur provider usage that this successful-response ledger cannot observe; Google's billing record remains authoritative.

The ledger records request ID, time, model, operation, configured tier, token counts, estimated paid cost and latency. Raw prompts and keys are not stored in the ledger. Its UI summarizes the latest 100 persisted successful requests, not a lifetime invoice. It does not reconcile credits, caching discounts, invoice taxes or provider billing. Unknown model rates are null, never guessed.

## Moving from free development to paid production

Today `.env` defaults to `GEMINI_BILLING_TIER=free`. This label describes configuration; it cannot read or change the Google account's billing status. For production, enable the appropriate paid billing arrangement in Google AI Studio/Cloud, confirm model access and quotas, then update this application setting. Changing the flag alone does not activate paid service. Google controls rate limits; the app adds one active generation and six starts per minute locally, a 4,000-character prompt limit, 1,800 maximum output tokens and a 45-second timeout. It does not automatically retry chargeable calls. [Google billing guide](https://ai.google.dev/gemini-api/docs/billing)

Before public production: add authentication and tenant isolation, secret management, per-user durable quotas, idempotent jobs, metering reconciliation, budget alerts and an actual payments/subscription service. Product credits could later wrap model cost plus infrastructure and margin, but no credit wallet or checkout is claimed here. Free-tier and paid-tier data-use terms differ; review provider terms before sending sensitive project information. This local demonstration should use fictional room requirements.

## Evidence

The automated suite passes **40 tests**, including geometric openings, exact extrusion, persistence, undo/redo, shortcuts, hospital semantic generation, collision/circulation detection, invalid-plan rejection, Gemini response-contract parsing and token-cost math. Gemini contract tests use a mock response; this is explicitly separate from a successful live provider call. Production compilation passes.

Browser checks verified exact 18 mm push/pull, numeric resizing, materials, duplicate/undo/redo, grouping, nudging, numpad navigation, the help guide, model clipboard operations through the Edit menu, and the hospital preview. Browser automation intercepts native clipboard chords, so physical Ctrl X/C/V execution is not claimed as an automated browser result; routing and clipboard state are unit tested. The application exposes WebMCP model tools in the available browser, and save/read were exercised.

## Live verification update
The user key was subsequently verified. Google's generation endpoint reported the configured Gemini 2.5 models unavailable to new users. The application now uses `gemini-3.5-flash-lite`. A live request through the running application returned HTTP 200 and generated a 16-part wardrobe, 1200 x 600 x 2100 mm, in the back-right corner of a 6 x 5 m room with 20 mm wall clearance. Its 461 provider-reported tokens were persisted to MongoDB. This supersedes the earlier missing-key limitation. The earlier 2.5 pricing example remains an example for that model, not the current model's rate; the new model currently shows cost unavailable while tracking actual tokens.
