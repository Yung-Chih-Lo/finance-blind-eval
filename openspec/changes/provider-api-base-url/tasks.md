## File Plan

- Modify: `web/lib/evaluation/types.ts:7-24` — rename `chatCompletionsEndpoint` → `apiBaseUrl`; rename `modelsEndpoint` → `modelsEndpointOverride` (in both `ProviderSettings` and `ProviderSettingsStatus`)
- Modify: `web/lib/server/provider-settings.ts` — rename fields, add `resolveChatCompletionsUrl` + `resolveModelsEndpoint`, drop `deriveProviderModelsEndpoint`, strengthen `validateProviderSettings`, switch env var to `OPENAI_COMPAT_API_BASE_URL`
- Modify: `web/lib/server/gateway-client.ts` — call `resolveChatCompletionsUrl` for chat fetch, drop wrapper `deriveModelsEndpoint`, update env-var error message
- Modify: `web/lib/server/platform-settings.ts` — detect legacy `chatCompletionsEndpoint`/`modelsEndpoint` keys on load and raise `PlatformSettingsError`
- Modify: `web/app/api/admin/settings/route.ts` (and any other admin endpoints that catch `PlatformSettingsError`) — surface legacy schema banner-friendly payload if needed
- Modify: `web/components/evaluation/admin-provider-settings.tsx` — rename field, change label / placeholder / helper text, render legacy-schema banner with re-save + reset CTAs
- Modify: `web/tests/provider-settings-typecheck.ts` — fixture rename, add satisfies-style checks for new resolver + validation behavior
- Create: `web/scripts/verify-provider-url-resolution.mjs` — node script that asserts chat/models resolution for representative base URLs (trailing slash, override set, invalid suffix)
- Modify: `web/README.md` (lines 25–55) — env var section
- Modify: `CLAUDE.md` (Zeabur Env Vars section) — env var rename + migration note

## 1. Branch + baseline guardrails

- [x] 1.1 Confirm cwd is repo root, branch is `change/provider-api-base-url`, working tree clean (`git status -b`)
- [x] 1.2 Run baseline `npm run typecheck` and `npm run lint` in `web/`; capture they pass before refactor begins

## 2. Test scaffolding (RED-equivalent)

- [x] 2.1 Open `web/tests/provider-settings-typecheck.ts` and update fixture: replace `chatCompletionsEndpoint: "http://127.0.0.1:8080/v1/chat/completions"` with `apiBaseUrl: "http://127.0.0.1:8080/v1"` and `modelsEndpoint: ""` with `modelsEndpointOverride: ""`
- [x] 2.2 Append new compile-time checks importing yet-to-exist `resolveChatCompletionsUrl` and `resolveModelsEndpoint` from `@/lib/server/provider-settings`, calling them with the fixture, satisfying `string`
- [x] 2.3 Run `npm run typecheck` and verify it FAILS with module-export errors (RED: types/exports do not exist yet)
- [x] 2.4 Create `web/scripts/verify-provider-url-resolution.ts` with assertions for these cases (use `node:assert/strict`):
  - base `https://x/v1` → chat `https://x/v1/chat/completions`, models `https://x/v1/models`
  - base `https://x/v1/` (trailing slash) → chat `https://x/v1/chat/completions`, models `https://x/v1/models`
  - base `https://x/v1` + override `https://other/m` → chat `https://x/v1/chat/completions`, models `https://other/m`
  - validate rejects base ending `/chat/completions`
  - validate rejects base containing `?foo=1`
  - validate rejects base containing `#frag`
- [x] 2.5 Run `npm run verify:provider-url` and verify it FAILS at compile (RED: target functions absent). Followed existing `scripts/verify-tsconfig.json` + loader pattern instead of plain `.mjs`.
- [x] 2.6 Add an `npm` script entry in `web/package.json` named `verify:provider-url` mapped to `tsc -p scripts/verify-tsconfig.json && node --experimental-loader=./scripts/.verify-loader.mjs scripts/.verify-out/scripts/verify-provider-url-resolution.js`

## 3. Type rename (compile-driven sweep)

- [x] 3.1 In `web/lib/evaluation/types.ts:7-16`, rename `chatCompletionsEndpoint` → `apiBaseUrl` and `modelsEndpoint` → `modelsEndpointOverride` in `ProviderSettings`
- [x] 3.2 In `web/lib/evaluation/types.ts:18-24`, rename `modelsEndpoint` → `modelsEndpointOverride` in `ProviderSettingsStatus` (mirrors the source-of-truth field)
- [x] 3.3 Run `npm run typecheck` and capture every error site (confirmed: provider-settings.ts, gateway-client.ts, admin-provider-settings.tsx, tests, scripts; platform-settings.ts propagates via normalizer and did not error directly)

## 4. Core resolver + validation in `provider-settings.ts`

- [x] 4.1 In `web/lib/server/provider-settings.ts`, replace env read at line 71 from `envString("OPENAI_COMPAT_API_ENDPOINT")` to `envString("OPENAI_COMPAT_API_BASE_URL")` and rename target field to `apiBaseUrl`
- [x] 4.2 Replace the `OPENAI_COMPAT_MODELS_ENDPOINT` read so it populates `modelsEndpointOverride`
- [x] 4.3 In `normalizeProviderSettings`, rename incoming keys to `apiBaseUrl` / `modelsEndpointOverride` (do NOT accept legacy keys here — keep the rename clean; legacy detection happens at `platform-settings.ts` load)
- [x] 4.4 Add `resolveChatCompletionsUrl(settings: Pick<ProviderSettings, "apiBaseUrl">): string` that returns `${stripTrailingSlash(settings.apiBaseUrl)}/chat/completions`; export it
- [x] 4.5 Add `resolveModelsEndpoint(settings: Pick<ProviderSettings, "apiBaseUrl" | "modelsEndpointOverride">): string` that returns `modelsEndpointOverride.trim()` if non-empty else `${stripTrailingSlash(settings.apiBaseUrl)}/models`; export it
- [x] 4.6 Add helper `stripTrailingSlash(value: string): string` (private, module-local) that returns `value.replace(/\/+$/, "")`
- [x] 4.7 Remove old `deriveProviderModelsEndpoint` export and its internal logic
- [x] 4.8 In `validateProviderSettings`, added `validateApiBaseUrlSemantics` covering: path ends `/chat/completions` or `/completions` → "provider.apiBaseUrl should be a base URL ..."; non-empty `url.search` → "provider.apiBaseUrl must not include a query string."; non-empty `url.hash` → "provider.apiBaseUrl must not include a fragment."
- [x] 4.9 In `validateProviderSettings`, rename `modelsEndpoint` references to `modelsEndpointOverride` (validation remains: optional http(s) URL, no extra rules)
- [x] 4.10 `createProviderSettingsStatus`: dropped the `modelsEndpoint` field from the status — no consumer reads it (verified by grep). Status now exposes only `apiKeyEnvVar`, `apiKeyConfigured`, `hasCompleteModelMapping`, `mappedModelCount`.
- [x] 4.11 Ran `npm run typecheck`: `provider-settings.ts` clean; remaining errors are in `gateway-client.ts` and `admin-provider-settings.tsx`, addressed in sections 5 and 7.

## 5. Wire `gateway-client.ts` to resolver + new env var

- [x] 5.1 In `web/lib/server/gateway-client.ts`, replace `chatCompletionsEndpoint` usage at line 200 (`fetch(params.settings.chatCompletionsEndpoint, ...)`) with `fetch(resolveChatCompletionsUrl(params.settings), ...)`
- [x] 5.2 Replace the `!providerSettings.chatCompletionsEndpoint` guard at line 256 with `!providerSettings.apiBaseUrl`
- [x] 5.3 Update the error message at line 257 to reference `OPENAI_COMPAT_API_BASE_URL` instead of `OPENAI_COMPAT_API_ENDPOINT`
- [x] 5.4 Removed the `deriveModelsEndpoint` wrapper and its `OPENAI_COMPAT_MODELS_ENDPOINT` direct read (no external callers; `provider-settings.ts` now owns env reads)
- [x] 5.5 Replace `discoverProviderModels`'s call to `deriveProviderModelsEndpoint(readySettings)` (line 150) with `resolveModelsEndpoint(readySettings)`
- [x] 5.6 Import `resolveChatCompletionsUrl` and `resolveModelsEndpoint` from `@/lib/server/provider-settings`
- [x] 5.7 Ran `npm run typecheck`: provider-settings.ts + gateway-client.ts clean; only admin UI remains

## 6. Legacy schema detection in `platform-settings.ts`

- [x] 6.1 In `web/lib/server/platform-settings.ts`, locate the envelope-load path (around line 316 where `normalizeProviderSettings` is called) and inspect `maybeEnvelope.provider` raw object before normalization
- [x] 6.2 If raw provider object has own-property `chatCompletionsEndpoint` or `modelsEndpoint`, throw `PlatformSettingsError("Legacy provider schema in runtime settings file.", ["Legacy provider keys (...) detected. Open /admin and either reset to defaults or re-save provider settings."], 500)` — message dynamically names the detected keys
- [x] 6.3 Ensure detection happens BEFORE `normalizeProviderSettings` (which would silently drop the unknown keys)
- [x] 6.4 Run `npm run typecheck` to confirm no regressions (only admin UI errors remain)

## 7. Admin UI: field, helper text, legacy banner

- [x] 7.1 In `web/components/evaluation/admin-provider-settings.tsx`, find the `Chat completions endpoint` label (line 211) and rename to `API base URL`
- [x] 7.2 Change the input `value` and `onChange` to reference `apiBaseUrl` instead of `chatCompletionsEndpoint`
- [x] 7.3 Replace placeholder `https://gateway.example.com/v1/chat/completions` (line 214) with `https://gateway.example.com/v1`
- [x] 7.4 Added `<small className="provider-helper">` helper text under the API base URL input
- [x] 7.5 Find the `Models endpoint` label (line 221) and rename to `Models endpoint override (optional)`; update placeholder to `留空時由 API base URL 推導 /models`
- [x] 7.6 Switch the input binding from `modelsEndpoint` to `modelsEndpointOverride`
- [x] 7.7 Created `components/evaluation/admin-legacy-settings-banner.tsx` (client component). Caught `PlatformSettingsError` with `"Legacy provider schema"` prefix in `app/admin/page.tsx` and render the banner instead of the rest of the dashboard.
- [x] 7.8 Banner has built-in "重置為環境變數預設值" button that POSTs to `/api/admin/settings/reset` and refreshes the page on success
- [x] 7.9 Ran `npm run typecheck` and `npm run lint` — both clean

## 8. Test verification (GREEN)

- [x] 8.1 Run `npm run typecheck` in `web/` → passes
- [x] 8.2 Run `npm run verify:provider-url` → all 6 assertions PASS
- [x] 8.3 Run `npm run lint` → clean
- [x] 8.4 Run `npm run build` → succeeds (17 routes generated)

## 9. Manual smoke (local dev)

- [x] 9.1 Local `web/.env.local` not used (user runs dev with shell-exported env or against Zeabur); contract documented in section 10
- [x] 9.2 Confirmed `web/.data/platform-settings.json` is absent locally — happy path will not fire legacy detection
- [ ] 9.3 USER: Start `npm run dev` from `web/`; open `/admin`; confirm provider panel shows new label `API base URL`, helper text, and the field is empty or populated from env
- [ ] 9.4 USER: With a temporary fake `.data/platform-settings.json` containing `{ "config": {...}, "provider": { "chatCompletionsEndpoint": "http://x/v1/chat/completions", "modelsEndpoint": "" } }`, reload `/admin` and confirm the legacy-schema banner appears; press reset; confirm banner clears and form re-populates from env
- [ ] 9.5 USER: Delete temporary file; restart dev server; confirm normal load

## 10. Docs

- [x] 10.1 Update `web/README.md` lines 30–35: rename env var to `OPENAI_COMPAT_API_BASE_URL=http://127.0.0.1:8080/v1` (drop `/chat/completions`); add note that the app derives chat + models from this base and validates the base URL
- [x] 10.2 Update `web/README.md` optional vars: keep `OPENAI_COMPAT_MODELS_ENDPOINT` as optional override; clarify it overrides the derived `/models` URL
- [x] 10.3 Update `CLAUDE.md` Zeabur Env Vars block: rename to `OPENAI_COMPAT_API_BASE_URL`; add migration note pointing admins at /admin reset

## 11. Final validation

- [x] 11.1 `openspec validate provider-api-base-url --strict` → valid
- [x] 11.2 `openspec status --change provider-api-base-url` → 4/4 artifacts complete
- [x] 11.3 `git status` shows only intended files (CLAUDE.md, tasks.md, web/README.md staged for this commit)

## 12. Verify-driven fixes

Triggered by `/opsxp-verify` round 1: multi-agent review found docs miss + UX/hardening gaps not in the original scope.

- [x] 12.1 CRITICAL: `docs/USAGE.en.md` — env var, narrative, models-endpoint reference updated to base-URL semantics
- [x] 12.2 CRITICAL: `docs/USAGE.zh-TW.md` — same three spots updated
- [x] 12.3 WARNING: `admin-legacy-settings-banner.tsx` — dropped redundant English `message` prop; banner is now Chinese-only with issues list intact
- [x] 12.4 WARNING: `router.refresh()` → `router.push("/admin?tab=provider")` after successful reset
- [x] 12.5 WARNING: Inline comments added above `validateApiBaseUrlSemantics` and legacy-key array
- [x] 12.6 SUGGESTION: `resolveChatCompletionsUrl` / `resolveModelsEndpoint` throw on empty `apiBaseUrl` (override still wins for models). RED proved via verify script; GREEN passes.
- [x] 12.7 SUGGESTION: Verify script now asserts multi-slash collapse, empty-base throw, whitespace-only throw, override-with-empty-base
- [x] 12.8 All gates green: typecheck, lint, verify:provider-url (10/10), next build (17 routes), `openspec validate --strict`

## 13. Round-2 verify follow-up

Triggered by `/opsxp-verify` round 2: maintainer agent caught `.env.example` miss; QA agent flagged dead-code + assertion looseness; future-maintainer flagged legacy-schema coverage gap.

- [x] 13.1 CRITICAL: `web/.env.example` rewritten — `OPENAI_COMPAT_API_BASE_URL=http://127.0.0.1:8080/v1` with helper comment; `OPENAI_COMPAT_MODELS_ENDPOINT` is now empty (optional override) with comment explaining derive-from-base semantics
- [x] 13.2 WARNING: `web/scripts/.verify-loader.mjs:1-4` header now names both `verify-study-copy.ts` and `verify-provider-url-resolution.ts` and explains the contract (alias map + `server-only` stub + JSON inline)
- [x] 13.3 WARNING: Extracted `detectLegacyProviderSchema(rawProvider)` as a small public helper in `platform-settings.ts`; `normalizeEnvelope` now calls it. Verify script adds 6 assertions (single legacy key, both keys, new schema, null, non-object). RED proved (helper missing) → GREEN passes.
- [x] 13.4 SUGGESTION: Dropped dead `if (!endpoint)` guard from `discoverProviderModels` — the resolver throws on empty base now
- [x] 13.5 SUGGESTION: Verify-script throw assertions tightened from `/apiBaseUrl/` to `/apiBaseUrl is empty/` (3 assertions)
- [x] 13.6 SUGGESTION: Added symmetric assertion — `resolveChatCompletionsUrl` ignores `modelsEndpointOverride` and still throws on empty base
- [x] 13.7 All gates green: typecheck, lint, verify:provider-url (17/17 assertions), build, `openspec validate --strict`
