## File Plan

- Create `web/lib/server/platform-settings.ts` — runtime settings file IO, validation, default envelope creation, save/reset/export helpers, and settings hash generation.
- Modify `web/lib/evaluation/types.ts` — add `PlatformSettingsEnvelope`, settings source metadata, validation result, and optional settings metadata on `PendingQuestion` / `EvaluationRecord`.
- Modify `web/lib/evaluation/config.ts` — keep repository defaults exportable as fallback constants while allowing server code to use active runtime settings.
- Modify `web/app/page.tsx`, `web/app/eval/page.tsx`, and participant components — pass active public settings from server pages into client UI.
- Modify `web/app/admin/page.tsx` — use active settings for model/facet/flag/limit display.
- Create `web/app/api/admin/settings/route.ts` — read and save protected runtime settings.
- Create `web/app/api/admin/settings/reset/route.ts` — reset runtime settings to repository defaults.
- Create `web/app/api/admin/settings/export/route.ts` — download active settings JSON.
- Modify `web/app/api/evaluation/answers/route.ts`, `web/app/api/evaluation/records/route.ts`, `web/app/api/session/redeem-invite/route.ts`, and server helpers — use active settings at request time and store metadata.
- Modify `web/lib/server/gateway-client.ts` and `web/lib/server/evaluation-storage.ts` — accept active settings/config values instead of relying only on static module constants.
- Modify `web/README.md`, root `README.md`, and `web/.env.example` — document runtime settings, `PLATFORM_SETTINGS_FILE`, fallback, and `.data` behavior.

## 1. Runtime Settings Core

- [x] 1.1 RED: Add a temporary failing call site or minimal local check for `getActivePlatformSettings()` proving `web/lib/server/platform-settings.ts` does not exist yet.
- [x] 1.2 Create `web/lib/server/platform-settings.ts` with `DEFAULT_SETTINGS_VERSION = 1`, default envelope creation, runtime file path resolution, and a stable JSON hash helper.
- [x] 1.3 Add local validation functions that reject missing `study`, `limits`, `answerLabels`, `modelIds`, `promptCategories`, `evaluationFacets`, and `worstAnswerFlags`.
- [x] 1.4 Implement `getActivePlatformSettings()` so missing `web/.data/platform-settings.json` returns the repository default config with source metadata `default`.
- [x] 1.5 Implement runtime-file read behavior so a valid settings file returns source metadata `runtime`, `settingsVersion`, `updatedAt`, and `updatedBy`.
- [x] 1.6 Implement invalid runtime-file behavior so validation errors are surfaced to callers instead of silently falling back to defaults.
- [x] 1.7 Implement `savePlatformSettings(config, updatedBy)` so valid saves increment the previous active version and write an envelope to `web/.data/platform-settings.json`.
- [x] 1.8 Implement `resetPlatformSettings(updatedBy)` so reset writes repository defaults as the next runtime version.
- [x] 1.9 Implement `exportPlatformSettings()` returning the active envelope plus source metadata without API secrets.

## 2. Types And Config Boundaries

- [x] 2.1 Add `PlatformSettingsEnvelope`, `PlatformSettingsSource`, `PlatformSettingsSnapshot`, and validation result types to `web/lib/evaluation/types.ts`.
- [x] 2.2 Add optional `settingsVersion` and `settingsSnapshotHash` fields to `PendingQuestion` and `EvaluationRecord`.
- [x] 2.3 Keep `web/lib/evaluation/config.ts` exporting repository default constants for compatibility, and add clearly named default exports such as `DEFAULT_STUDY_CONFIG`.
- [x] 2.4 Update TypeScript references so server code can pass runtime config values without widening client component props to `any`.

## 3. Participant And Admin Runtime Config Usage

- [x] 3.1 Update `web/app/page.tsx` to load active settings server-side and render `rootTitle` / `rootDescription` from those settings.
- [x] 3.2 Update `web/app/eval/page.tsx` to load active settings server-side and pass the public config into `EvaluationApp`.
- [x] 3.3 Update `EvaluationApp` props so it receives the active `StudyConfig` and uses its question limit when restoring sessions.
- [x] 3.4 Update `TokenEntry` so intro copy, tasks, and signature come from the config prop instead of importing static defaults.
- [x] 3.5 Update `QuestionFlow` so categories, examples, min/max question length, and progress count come from the config prop.
- [x] 3.6 Update `QualityControls` so answer labels, facets, and worst-answer flags come from props supplied by `QuestionFlow`.
- [x] 3.7 Update `CompletionPage` so completion copy comes from the active config prop.
- [x] 3.8 Update `web/app/admin/page.tsx` to use active settings for model IDs, facets, worst flags, and question limit displays.

## 4. Admin Settings APIs

- [x] 4.1 RED: Call `GET /api/admin/settings` on the dev server and verify it is missing or does not yet return active settings metadata.
- [x] 4.2 Create `GET /api/admin/settings` returning active settings source, version, update metadata, snapshot hash, and config.
- [x] 4.3 Add `PUT /api/admin/settings` accepting either `{ config }` or a complete envelope, validating it, saving it, and returning the saved envelope.
- [x] 4.4 Ensure invalid `PUT /api/admin/settings` returns 400 with validation details and does not overwrite the current settings file.
- [x] 4.5 Create `POST /api/admin/settings/reset` to restore repository defaults as the next runtime version.
- [x] 4.6 Create `GET /api/admin/settings/export` returning downloadable JSON with `Content-Disposition`.
- [x] 4.7 Verify the existing proxy protects all `/api/admin/settings*` routes with admin session or Basic Auth.

## 5. Evaluation Request And Record Metadata

- [x] 5.1 Update `web/app/api/session/redeem-invite/route.ts` to use active settings rate limits.
- [x] 5.2 Update `web/app/api/evaluation/answers/route.ts` to load active settings before validation and reject invalid runtime settings before calling the gateway.
- [x] 5.3 Update `generateBlindAnswers()` to accept active answer labels, model IDs, and prompt behavior inputs from the caller.
- [x] 5.4 Store `settingsVersion` and `settingsSnapshotHash` on each `PendingQuestion` created after answer generation.
- [x] 5.5 Update `web/app/api/evaluation/records/route.ts` so saved `EvaluationRecord` preserves settings metadata from the pending question.
- [x] 5.6 Update `getAdminSnapshot()`, model selection counts, comparative counts, and worst flag counts to accept active settings while tolerating old records.
- [x] 5.7 Update JSON export to include settings metadata on records without breaking old records.
- [x] 5.8 Update CSV export headers to include `settings_version` and `settings_snapshot_hash`.

## 6. Documentation And Environment

- [x] 6.1 Add `PLATFORM_SETTINGS_FILE=` to `web/.env.example`.
- [x] 6.2 Document `web/.data/platform-settings.json` as the runtime file and confirm it remains uncommitted.
- [x] 6.3 Document default fallback, reset behavior, and why API keys must remain in environment variables rather than runtime settings.
- [x] 6.4 Update `plan.md` to mark `add-runtime-platform-settings` as the active/current change if useful for the next handoff.

## 7. Verification

- [x] 7.1 Run `cd web && npm run typecheck`.
- [x] 7.2 Run `cd web && npm run lint`.
- [x] 7.3 Run `cd web && npm run build`.
- [x] 7.4 Start the dev server with admin auth configured and verify `GET /api/admin/settings` returns default source when no runtime file exists.
- [x] 7.5 Save a valid modified settings payload through `PUT /api/admin/settings` and verify `settingsVersion` increments.
- [x] 7.6 Reload `/eval` and verify participant intro/prompt content uses the saved runtime settings.
- [x] 7.7 Submit an evaluation question and verify the pending/saved record includes `settingsVersion` and `settingsSnapshotHash`.
- [x] 7.8 Corrupt the runtime settings file in a disposable local run and verify answer generation returns a configuration error before any model gateway call.
- [x] 7.9 Run `openspec validate add-runtime-platform-settings --strict`.
