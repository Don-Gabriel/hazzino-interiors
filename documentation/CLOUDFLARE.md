# Cloudflare deployment

## Current release — AI Design Studio connection fix

**AI Design Studio connection fix — verified live:** the separate dialog under **Extensions → AI Hospital…** now uses the deployed five Gemini keys and the same daily budget as the furniture generator. The exact default 6 × 5 m patient-room prompt generated a two-bed layout with cabinets, IV stands and a 1,200 mm central strip. Its **36 editable objects** were applied and the browser confirmed **Saved to Cloudflare**. All implemented layout checks passed; this is not a healthcare-code certification. The request used **328 input + 140 output = 468 tokens (key 1)**. Afterwards the shared ledger recorded **8 attempts, 7,291 actual reported tokens and 48,000 reserved tokens out of 60,000**: at that snapshot, two further 6,000-token attempt reservations remained for the UTC day. The allowance is unchanged. This release passed **19 targeted tests and 7 live Cloudflare integration tests**, plus the build and deployment dry run. Worker version: `6cf549da-1c2e-47c4-81eb-614689644504`.



## Historical key setup (superseded below) — 10 September 2026, 3:44 pm IST

All five supplied keys passed local and Worker-side model metadata checks and were installed as secrets after the owner confirmed Free tier. The model is now `gemini-3.5-flash-lite`, with supported minimal thinking and unchanged output/budget caps. Code deployment `90dccf9b-1019-463c-adfb-43ca1e90bbf8` was followed by a secret-change deployment. All seven targeted regressions and the build passed. Real local generation returned an 1800 × 600 × 2400 mm wardrobe plan using 358 tokens; its generated 93-part assembly validated. **Worker-side generation still returns HTTP 404 despite successful metadata verification. Use localhost:5173 for AI; this cloud-specific issue remains unresolved.** This update supersedes the earlier unconfigured status below.

## Historical release — modelling corrections and furniture AI, 10 September 2026

- Current version: `9cd7ad1f-52d0-4aea-b672-c9d09d2a28dc`; published before the 3:40 pm IST cutoff.
- Asset: `index-DC9IQ_TS.js`. All 112 ordinary tests and the production build passed.
- All six integration tests passed against the public release: assets/deep links, save/reopen/checkpoints, browser isolation, invalid writes, large Unicode models and textured furniture round trips. The deployed furniture AI status endpoint returns the expected unconfigured state with zero cloud keys.
- Corrected material navigation/tinting, new custom-colour workflow, broad-face rectangular Follow Me profiles, elevated drawing snaps and feature edges for shaped meshes. New dimensioned solids start beside existing furniture. Boolean source replacement and nested-group Undo have regression coverage.
- Added `/api/furniture-ai/status`, `/verify` and `/generate`, with a persistent global demo budget. Deployed status is deliberately unconfigured until keys are verified and uploaded as Worker secrets. Local keys are not bundled or automatically published.
- [Jury guide](JURY-FURNITURE-GUIDE.md) includes exact procedures and distinguishes implemented/tested features from unverified live Gemini generation.

Older entries below record historical releases; their version IDs are not the current version.

## Rectangle preview fix — 10 September 2026

- Source: [`b275b55`](https://github.com/Don-Gabriel/hazzino-interiors/commit/b275b55).
- Current version: `807a79c3-da9d-4bbb-bbc7-46ff75cf4d69`.
- Rectangle previews now receive the two original diagonal control points, avoiding a second expansion that collapsed the outline into a line. A regression test failed before the fix and passes across all three planes and four drag directions afterward. All 13 targeted drawing/manual-workflow tests and the build passed.
- Browser verification showed four preview edges while the design still had zero objects, then exactly one face after the second click. The public app returned HTTP 200 and the verified corrected asset `index-DC8gX3pP.js` after deployment.

## Manual workflow correction — 10 September 2026

- Live source: [`f2a8b19`](https://github.com/Don-Gabriel/hazzino-interiors/commit/f2a8b19), including `9e49ad6` for snapping and the documented manual workflow.
- Current Cloudflare version: `fb197854-c132-4cb0-89a4-375b3ecb329a`.
- 104 ordinary tests pass. Six public cloud integration tests passed for the workflow update; the final Outliner interface correction was then built, deployed and browser-checked on the live site. No live browser errors were observed in that final check.
- Added point-to-point component snapping, endpoint priority, segment intersections, particle board and an accessible Outliner at narrow desktop widths.
- [HACKATHON-WORKFLOW.md](HACKATHON-WORKFLOW.md) records the exact manual cabinet sequence, browser evidence, portable example and remaining scope. The local demonstration was saved/reopened through MongoDB and remained editable. The public Cloudflare deployment continues to use SQLite Durable Objects.
- These new document-driven corrections were completed after the earlier 3 pm deadline; the previous clearance release had already been published before it.

## Clearance correction — 10 September 2026, 2:47 pm IST

- Live app: [hazzino-interiors.hazzino-studio.workers.dev](https://hazzino-interiors.hazzino-studio.workers.dev).
- Source: [`3810c17`](https://github.com/Don-Gabriel/hazzino-interiors/commit/3810c17).
- Current Cloudflare version: `8f6a7a59-9b1b-46ea-bbc5-d234c170b7eb`.
- 100 ordinary tests and six local Cloudflare integration tests passed. All **six integration tests also passed against this public deployment**.
- The live browser generated the corrected 93-part wardrobe, verified both-door clearance in the preview, blocked a door closing against an extended drawer, and ran the complete current/closed/opening audit with zero intersections or blocked opening paths. Saved **Furniture clearance · Corrected demonstration** to the browser's cloud workspace. No console errors or warnings were observed.
- New manual hinge/slide controls, insertion spacing and inaccessible sliding-layout validation are included. See [the clearance guide](CLEARANCE-AND-MANUAL-BUILD.md) for operation and limits. Existing project geometry is preserved; use Edit furniture to regenerate old construction with the new clearances.

## Furniture release — 10 September 2026

- Live app: [hazzino-interiors.hazzino-studio.workers.dev](https://hazzino-interiors.hazzino-studio.workers.dev).
- Source: `c963a9d` on [GitHub](https://github.com/Don-Gabriel/hazzino-interiors). The main furniture implementation is commit `8464c0b`; `c963a9d` adds machining-record import validation.
- Cloudflare version: `a2c3fd16-325f-40a9-adba-8a293ac745b4`.
- Published to the owner's authenticated account at approximately 2 pm IST, before the requested 3 pm deadline. This is a regular account deployment, with no temporary claim required.
- 91 automated tests pass. Six integration tests pass against the public app, covering assets/deep links, cloud projects and checkpoints, browser-workspace isolation, invalid/cross-origin writes, large Unicode documents, and furniture/textured model round trips.
- Browser verification created a 75-part sliding wardrobe, inspected moving fronts, generated its 32-panel cut list and a nine-sheet layout with no oversized parts, and saved it to Cloudflare. A separate test panel was machined into a mesh with eight through holes through the actual dialog. Saving and reloading preserved all 76 objects and the machining record. No browser console errors were observed in this workflow.

The earlier preview at `hazzino-interiors.fanatical-tennis.workers.dev` belongs to a different account from the completed Wrangler login. It was not overwritten. Use the new URL above for the current furniture release. Browser recovery and cloud workspace cookies are origin-specific: export/import project JSON to transfer a design from the old preview or local application.

## Hosted features and storage

The deployed app includes the furniture configurator, manual modelling, Offset, Push/Pull, Follow Me, solid booleans, panel machining, production tools and all eight converted SKP samples. See [FURNITURE-STUDIO.md](FURNITURE-STUDIO.md) for capabilities and limitations; this release is not complete SketchUp parity.

The web app uses Cloudflare Workers with Static Assets and SQLite-backed Durable Objects. It supports project save, list, reopen, update and delete, independent version checkpoints, IndexedDB recovery and JSON backups. The existing Express/MongoDB application remains available locally.

An HttpOnly, SameSite cookie identifies an anonymous browser workspace. Clearing cookies, changing domain or using another browser creates a different workspace. Account sign-in and cross-device synchronization are not implemented. JSON export/import transfers editable projects.

The cloud API validates the same project schema as the local app and accepts request bodies up to 20 MiB. Project documents are stored in small SQLite rows, preserving large documents, embedded textures and Unicode. Document updates and project deletion use transactions.

The original release did not connect live Gemini generation; this limitation is superseded by the AI releases below. Local `.env` secrets and the MongoDB database are not uploaded. The browser uses converted SKP assets; native SKP decoding is not implemented.

## Develop, test and publish

```sh
npm ci
npm run dev:cloudflare
```

With the local Cloudflare runtime on port 8787, run `npm run test:cloudflare`. The ordinary `npm test` suite also requires the local MongoDB API on port 3001 (`npm run dev`).

To test the public deployment in PowerShell:

```powershell
$env:CLOUDFLARE_TEST_URL = 'https://hazzino-interiors.hazzino-studio.workers.dev'
npm run test:cloudflare
```

The integration tests create isolated workspaces and remove their own generated test projects. `npm run build` and `npx wrangler deploy --dry-run` validate the bundle. `npm audit` reports zero vulnerabilities with the committed Sharp 0.35.4 override.

```sh
npx wrangler login
npm run deploy:cloudflare
```

Wrangler 4.130.0 is pinned in the project. It publishes `hazzino-interiors`, static assets and the Durable Object binding from [wrangler.jsonc](../wrangler.jsonc), which identifies the authenticated owner account. Use the successful deployment's printed URL. No custom domain is required. Initial workers.dev DNS/TLS provisioning took a short time; subsequent HTTPS and browser checks passed normally.

## Codex Cloudflare setup

Following [Cloudflare's agent setup instructions](https://developers.cloudflare.com/agent-setup/prompt.md), 14 Cloudflare skills and five MCP server registrations were installed in the user's global Codex/agent configuration. The main Cloudflare, bindings, builds and observability connectors each completed OAuth; the documentation connector is public. These tools become available after a Codex restart. Wrangler publishing is already authenticated and works independently of that restart.

No OAuth credentials, claim links or local secrets are committed to this repository.

Official references: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Wrangler deployment](https://developers.cloudflare.com/workers/wrangler/commands/#deploy).


## Cloud AI release verification — 10 September 2026, 3:53 pm IST

Supersedes the earlier cloud HTTP 404 status: deployed version 5d5cb502-05d8-4b4b-aac2-a2562b0203f9 successfully generated a wardrobe and inserted 62 editable objects in the browser. Latest request: 306 input + 183 output = 489 tokens. Cloud ledger: 7 attempts, 6,823 actual reported tokens, 42,000 reserved of 60,000. Response cap is now 3,072. Nine targeted tests and six cloud integration tests passed. Complex prompts can still produce incomplete responses or dimensions rejected on insertion; these limitations are documented in the jury guide.
