## Context

The project currently has a Vite prototype under `vite/` and a new Next.js base under `web/`. The Vite prototype proves the research flow but keeps model discovery, model fanout, hidden A/B/C mapping, and record storage in browser code. That is acceptable for a local UI sketch but not for formal evaluation because browser code can expose gateway configuration and the true model behind each answer.

The Next.js base uses the App Router, React 19, Next 16, shadcn/ui, Tailwind 4, and scripts for `dev`, `typecheck`, `lint`, and `build`. The migration should use `web/` as the active app and keep `vite/` only as a behavior reference until the Next implementation is verified.

## Goals / Non-Goals

**Goals:**

- Recreate the participant evaluation flow in `web/` without making it look like a chat app.
- Use server-side Next.js route handlers for `/v1/models` discovery and `/v1/chat/completions` fanout.
- Keep the gateway API key and hidden A/B/C model mapping out of browser bundles.
- Persist participant profile, prompts, answers, selections, reasons, ratings, timestamps, latency, and completion status through an API boundary.
- Provide an admin page with completion status, per-question records, model best/worst counts, and CSV/JSON export.
- Keep the first implementation small enough to run locally without a required external database.

**Non-Goals:**

- Do not implement user account login for participants.
- Do not display model identities or aggregate model results to participants after completion.
- Do not replace the existing FastAPI model gateway.
- Do not build a full survey authoring system; the five guided prompt categories remain static for this change.

## Decisions

### Use Next.js as the active app boundary

`web/` becomes the active evaluation app because it can host both UI routes and server route handlers. This avoids shipping gateway secrets and hidden model mapping to the browser while preserving a single deployable app for the evaluation UI.

Alternative considered: keep Vite and add a separate FastAPI eval backend. That would also protect secrets, but it adds another service before the evaluation workflow is stable.

### Treat participant tokens as opaque invite identifiers

Participant tokens in URLs are not secrets. The browser can see them, and participants can share them. The server-side session endpoint must validate the token and associate it with metadata or a participant record, but security must not depend on the token being hidden.

For the first version, participants can enter through a shared `/eval` URL and receive a random 6-digit token. Direct `/eval?token=...` links remain useful for testing or resuming. Future production hardening can store only hashed invite tokens and add one-time-use or expiration rules.

### Keep model mapping server-side

The server route that generates answers will fetch `/v1/models`, choose the three configured models, call chat completions in parallel, randomize A/B/C labels per question, and persist the hidden mapping before returning answers to the browser. The browser receives only labels and answer text.

Alternative considered: preserve the Vite adapter behavior where mapping happens in client state. That is rejected for formal evaluation because a participant could inspect the bundle or local storage.

### Use a thin persistence adapter

Implement a storage module behind server route handlers. Start with file-backed JSON under a local data directory or in-memory fallback if filesystem writes are unavailable. Keep the interface narrow so SQLite/Postgres can replace it later without changing UI components.

The storage interface should support participant upsert, question record creation, record listing, aggregate counts, and export serialization.

### Route shape

Use app routes that match the research workflow:

- `/eval` participant flow with server-allocated 6-digit token; `/eval?token=...` remains supported for direct testing or resume links.
- `/admin` research admin.
- `POST /api/session` validates or creates a participant session.
- `POST /api/evaluation/answers` receives a guided question, calls the gateway, stores hidden mapping, and returns blinded answers.
- `POST /api/evaluation/records` stores best/worst selections, reasons, flags, and ratings.
- `GET /api/admin/records` returns admin data.
- `GET /api/admin/export?format=csv|json` returns export files.

## Risks / Trade-offs

- [Risk] Gateway CORS remains necessary if the browser calls it directly. -> Mitigation: browser must call only Next.js API routes; only the Next server calls the gateway.
- [Risk] Local JSON storage can lose data if deployed to ephemeral infrastructure. -> Mitigation: document it as local-only and keep the storage adapter replaceable.
- [Risk] Automatic `/v1/models` mapping can pick the wrong three models if the gateway exposes more than three. -> Mitigation: support server-only model override environment variables.
- [Risk] Server route latency will include three model calls. -> Mitigation: call all three models in parallel and store measured latency.
- [Risk] The Vite prototype and Next app can drift during migration. -> Mitigation: port behavior once, verify Next routes, then treat `vite/` as archived reference only.

## Migration Plan

1. Copy domain constants and types from `vite/src` into `web/lib/evaluation`.
2. Implement server-side storage and gateway adapters in `web/lib/server`.
3. Implement Next API routes for session, answers, records, admin data, and export.
4. Port participant UI into `web/app/eval/page.tsx` and shared components.
5. Port admin UI into `web/app/admin/page.tsx`.
6. Verify with `cd web && npm run typecheck && npm run lint && npm run build`.
7. Run `web` dev server and manually check `/eval`, `/eval?token=123456`, and `/admin`.
8. After verification, update root documentation to mark `web/` as active and `vite/` as prototype reference.

Rollback is to keep using the existing Vite prototype in `vite/` because this change does not need to delete it during the first migration.

## Open Questions

- What exact persistent store should production use after local validation: SQLite, Postgres, or a managed backend?
- Should admin access be protected by a simple admin secret in this change, or deferred until deployment planning?
- Should pilot tokens remain random-on-start only, or should an admin endpoint also pre-create invite links later?
