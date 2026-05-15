## Why

The current blind evaluation prototype is implemented as a Vite-only frontend, which exposes too much evaluation logic to the browser and cannot safely protect the OpenAI-compatible gateway API key or hidden model mapping. The project now has a Next.js base in `web/`, so the eval app should move there and use server-side routes for model fanout, persistence, and exports.

## What Changes

- Migrate the participant evaluation UI from `vite/` into the Next.js app under `web/`.
- Replace browser-side model discovery and fanout with Next.js server routes that call the OpenAI-compatible gateway.
- Keep participant tokens browser-visible but treat them as opaque identifiers, not secrets.
- Keep gateway API keys and A/B/C hidden model mappings server-side.
- Move evaluation record persistence behind API routes, with local file or in-memory fallback acceptable for the first implementation if no database is configured.
- Recreate the admin view in Next.js for completion status, per-question records, model best/worst counts, and CSV/JSON export.
- Preserve the existing research questionnaire structure: background form, five guided flexible questions, blind A/B/C answer comparison, best/worst selection, reasons, flags, ratings, and thank-you completion page.

## Capabilities

### New Capabilities

- `blind-evaluation-app`: Next.js-based participant and admin evaluation workflow with server-mediated model calls, hidden mapping, recording, and export.

### Modified Capabilities

- None.

## Impact

- Affected app: `web/` Next.js app.
- Legacy reference: `vite/` prototype remains as source reference during migration.
- New server-side routes: Next.js route handlers under `web/app/api/**`.
- Gateway integration: OpenAI-compatible `/v1/models` and `/v1/chat/completions`.
- Configuration: server-only environment variables for gateway endpoint/API key and optional model overrides.
- Verification: `cd web && npm run typecheck`, `npm run lint`, `npm run build`, plus manual route checks for `/eval`, `/eval?token=...`, and `/admin`.
