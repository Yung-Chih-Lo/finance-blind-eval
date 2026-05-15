## 1. File Plan And Baseline

- [x] 1.1 Inspect `vite/src/App.tsx`, `vite/src/modelAdapter.ts`, `vite/src/storage.ts`, `vite/src/researchConfig.ts`, and `vite/src/types.ts` as migration source references.
- [x] 1.2 Inspect `web/app/page.tsx`, `web/app/layout.tsx`, `web/app/globals.css`, `web/components/ui/button.tsx`, and `web/lib/utils.ts` to match the Next.js base conventions.
- [x] 1.3 Create `web/lib/evaluation/types.ts` for participant, answer, rating, record, and model types migrated from the Vite prototype.
- [x] 1.4 Create `web/lib/evaluation/config.ts` for five prompt categories, quality flags, seeded participant metadata, and research model aliases.
- [x] 1.5 Run `cd web && npm run typecheck` and verify the untouched Next.js baseline plus new type/config files compile.

## 2. Server Adapters

- [x] 2.1 Create `web/lib/server/evaluation-storage.ts` with functions for participant upsert, record creation, participant listing, record listing, clearing local data, JSON export, CSV export, and model best/worst counts.
- [x] 2.2 Implement file-backed JSON persistence in `web/lib/server/evaluation-storage.ts` using a local data path ignored by git, with in-memory fallback if file writes fail.
- [x] 2.3 Create `web/lib/server/gateway-client.ts` with server-only functions to call the OpenAI-compatible gateway `/v1/models` and `/v1/chat/completions`.
- [x] 2.4 In `gateway-client.ts`, read `OPENAI_COMPAT_API_ENDPOINT`, optional `OPENAI_COMPAT_MODELS_ENDPOINT`, optional `OPENAI_COMPAT_API_KEY`, and optional model override env vars without using `NEXT_PUBLIC_`.
- [x] 2.5 In `gateway-client.ts`, infer `/v1/models` from `/v1/chat/completions` when `OPENAI_COMPAT_MODELS_ENDPOINT` is absent.
- [x] 2.6 In `gateway-client.ts`, resolve exactly three research model calls from `/v1/models`, using overrides only when more than three models exist or names cannot be inferred.
- [x] 2.7 In `gateway-client.ts`, parallelize the three chat completion requests and return answer text plus measured latency.
- [x] 2.8 Add server-side hidden A/B/C randomization in `gateway-client.ts` or a helper module so real model IDs are not returned to the browser.
- [x] 2.9 Run `cd web && npm run typecheck` and fix server adapter type errors.

## 3. API Routes

- [x] 3.1 Create `web/app/api/session/route.ts` with `POST` handling token validation or session creation and participant profile upsert.
- [x] 3.2 Create `web/app/api/evaluation/answers/route.ts` with `POST` accepting participant token, question index, prompt category, and user question.
- [x] 3.3 In `web/app/api/evaluation/answers/route.ts`, call the gateway adapter and return only `{ questionId, answers: { A, B, C }, latencyMs }` to the browser.
- [x] 3.4 In `web/app/api/evaluation/answers/route.ts`, persist the server-side hidden mapping associated with the generated `questionId`.
- [x] 3.5 Create `web/app/api/evaluation/records/route.ts` with `POST` storing selected best, selected worst, reasons, quality flags, and ratings for a question.
- [x] 3.6 In `web/app/api/evaluation/records/route.ts`, reject missing best/worst choices, identical best/worst choices, and submissions with no reason text.
- [x] 3.7 Create `web/app/api/admin/records/route.ts` with `GET` returning participant statuses, records, and aggregate best/worst counts.
- [x] 3.8 Create `web/app/api/admin/export/route.ts` with `GET ?format=json|csv` returning downloadable export content.
- [x] 3.9 Run `cd web && npm run typecheck` and verify all route handlers compile.

## 4. Participant UI Migration

- [x] 4.1 Create `web/app/eval/page.tsx` as a client entry page that reads `token` from search params and displays the token entry state when absent.
- [x] 4.2 Create `web/components/evaluation/token-entry.tsx` for the start screen and route update behavior.
- [x] 4.3 Create `web/components/evaluation/profile-form.tsx` for required background fields and finance familiarity scale.
- [x] 4.4 Create `web/components/evaluation/question-flow.tsx` for the five guided flexible prompt steps.
- [x] 4.5 In `question-flow.tsx`, call `POST /api/evaluation/answers` and render only answer A/B/C cards with no model identity.
- [x] 4.6 In `question-flow.tsx`, require best answer, worst answer, and at least one reason before calling `POST /api/evaluation/records`.
- [x] 4.7 Create `web/components/evaluation/quality-controls.tsx` for flags and 1-5 ratings.
- [x] 4.8 Create `web/components/evaluation/completion-page.tsx` that thanks the participant without revealing model results.
- [x] 4.9 Ensure the participant UI remains survey-like: progress display, one guided question at a time, no chat transcript layout, and no model names.
- [x] 4.10 Run `cd web && npm run typecheck` and fix client component type errors.

## 5. Admin UI Migration

- [x] 5.1 Create `web/app/admin/page.tsx` for the research admin dashboard.
- [x] 5.2 Fetch `GET /api/admin/records` from the admin page or a server helper and render participant count, completion count, question record count, and finance/non-finance group counts.
- [x] 5.3 Render model best/worst count cards using aggregate data from the admin API.
- [x] 5.4 Render participant completion status table with token, background, finance familiarity, LLM experience, status, and completed question count.
- [x] 5.5 Render per-question record table with token, question index, prompt category, user question, selected best, selected worst, hidden mapping, and response latency.
- [x] 5.6 Add JSON and CSV export controls that request `/api/admin/export?format=json` and `/api/admin/export?format=csv`.
- [x] 5.7 Run `cd web && npm run typecheck` and fix admin page type errors.

## 6. Styling And Documentation

- [x] 6.1 Port the Vite survey visual language into `web/app/globals.css` using the existing Next/Tailwind setup and shadcn button conventions.
- [x] 6.2 Verify responsive layouts for participant flow and admin tables at mobile and desktop widths.
- [x] 6.3 Create or update `web/.env.example` with server-only gateway variables and no `NEXT_PUBLIC_` API key.
- [x] 6.4 Update root `README.md` or create one if absent to mark `web/` as the active Next.js app and `vite/` as prototype reference.
- [x] 6.5 Update `web/README.md` with dev commands, eval routes, gateway env variables, and local persistence caveats.

## 7. Verification

- [x] 7.1 Run `cd web && npm run typecheck` and verify it passes.
- [x] 7.2 Run `cd web && npm run lint` and verify it passes.
- [x] 7.3 Run `cd web && npm run build` and verify it passes.
- [x] 7.4 Start `cd web && npm run dev -- --port 5174` and verify `/eval` plus `/eval?token=123456` load.
- [x] 7.5 Manually complete one mock or gateway-backed participant flow and verify the completion page hides model results.
- [x] 7.6 Open `/admin` and verify participant status, per-question record, best/worst counts, and export buttons work.
- [x] 7.7 Stop the dev server after manual verification.
