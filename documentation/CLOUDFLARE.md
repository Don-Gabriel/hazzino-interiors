# Cloudflare deployment

The current Hazzino web app can run on Cloudflare Workers with Static Assets and SQLite-backed Durable Objects. The existing Express/MongoDB application remains available locally.

## Published checkpoint — 10 September 2026

- Live app: [hazzino-interiors.fanatical-tennis.workers.dev](https://hazzino-interiors.fanatical-tennis.workers.dev).
- Source commit: `7f81fa7427216f82d869a50b1d756baf94dcd2d4` on [GitHub](https://github.com/Don-Gabriel/hazzino-interiors).
- Cloudflare version: `21a79af2-f602-4c3c-b83c-ac91de18ea00`.
- All 56 existing tests and five Cloudflare integration tests passed locally. All five deployment tests also passed against this public URL. A browser save succeeded and no browser errors were reported.
- Published using a temporary preview account at approximately 11:19 am IST. The owner subsequently confirmed completing the Cloudflare claim. A follow-up health check returned HTTP 200 with cloud storage ready. Account ownership was not independently checked; Wrangler still needs sign-in to the claimed account before future deployments.

## What works in the hosted build

- The existing browser modelling engine, workspace, materials, scenes and exports.
- Cloud project save, list, reopen, update and delete.
- Independent version checkpoints, including restoring earlier geometry.
- Browser recovery and JSON backups.
- Separate cloud storage for each browser workspace. An HttpOnly, SameSite cookie identifies that workspace. Clearing cookies or using another browser creates a different workspace; use JSON export/import to transfer designs. Account sign-in and cross-device synchronization are not implemented.

The cloud API validates the same project schema as the local app and accepts request bodies up to 20 MiB. Project documents are stored in small SQLite rows, preserving large documents and Unicode content. Each document update and project deletion uses a transaction.

Gemini is not connected in this deployment. The built-in hospital template works; live Gemini generation remains available through the configured local app. Local `.env` secrets and the local MongoDB database are not uploaded. The supplied `.skp` files are reference assets in GitHub; the application does not yet import them natively.

This deployment does not establish full SketchUp parity. See [SKETCHUP-WORKSPACE.md](SKETCHUP-WORKSPACE.md) for the feature audit. Offset is still pending.

## Development and checks

```sh
npm ci
npm run dev:cloudflare
```

With the Cloudflare runtime on port 8787:

```sh
npm run test:cloudflare
```

The five integration tests exercise asset serving and deep links, model/checkpoint round trips, isolation between browser workspaces, rejection of invalid and cross-origin writes, and large Unicode documents. The ordinary `npm test` suite additionally needs the local MongoDB API on port 3001.

`npm run build` and `wrangler deploy --dry-run` verify the deployment bundle. Production dependency audit is clear at this checkpoint. Wrangler's development dependency chain reports a Sharp/libheif advisory; this app does not use Cloudflare image transformation bindings, and that package is not included in its deployed Worker or browser bundle.

## Publish to an account

```sh
npx wrangler login
npm run deploy:cloudflare
```

Wrangler publishes `hazzino-interiors` and its database binding from [wrangler.jsonc](../wrangler.jsonc). Use the URL printed by the successful deployment. No custom domain is required.

An unauthenticated preview can instead be deployed using `npx wrangler deploy --temporary`. Cloudflare returns a private claim link which the owner must complete within 60 minutes to retain the account and deployment. Never put that claim link or credentials into GitHub. After claiming, authenticate Wrangler to the claimed account for future deployments.

Official references: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [claiming preview deployments](https://developers.cloudflare.com/workers/platform/claim-deployments/).
