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

- [ ] 3.1 In `web/lib/evaluation/types.ts:7-16`, rename `chatCompletionsEndpoint` → `apiBaseUrl` and `modelsEndpoint` → `modelsEndpointOverride` in `ProviderSettings`
- [ ] 3.2 In `web/lib/evaluation/types.ts:18-24`, rename `modelsEndpoint` → `modelsEndpointOverride` in `ProviderSettingsStatus` (mirrors the source-of-truth field)
- [ ] 3.3 Run `npm run typecheck` and capture every error site (expected: provider-settings.ts, gateway-client.ts, platform-settings.ts, admin-provider-settings.tsx, tests/provider-settings-typecheck.ts)

## 4. Core resolver + validation in `provider-settings.ts`

- [ ] 4.1 In `web/lib/server/provider-settings.ts`, replace env read at line 71 from `envString("OPENAI_COMPAT_API_ENDPOINT")` to `envString("OPENAI_COMPAT_API_BASE_URL")` and rename target field to `apiBaseUrl`
- [ ] 4.2 Replace the `OPENAI_COMPAT_MODELS_ENDPOINT` read so it populates `modelsEndpointOverride`
- [ ] 4.3 In `normalizeProviderSettings`, rename incoming keys to `apiBaseUrl` / `modelsEndpointOverride` (do NOT accept legacy keys here — keep the rename clean; legacy detection happens at `platform-settings.ts` load)
- [ ] 4.4 Add `resolveChatCompletionsUrl(settings: Pick<ProviderSettings, "apiBaseUrl">): string` that returns `${stripTrailingSlash(settings.apiBaseUrl)}/chat/completions`; export it
- [ ] 4.5 Add `resolveModelsEndpoint(settings: Pick<ProviderSettings, "apiBaseUrl" | "modelsEndpointOverride">): string` that returns `modelsEndpointOverride.trim()` if non-empty else `${stripTrailingSlash(settings.apiBaseUrl)}/models`; export it
- [ ] 4.6 Add helper `stripTrailingSlash(value: string): string` (private, module-local) that returns `value.replace(/\/+$/, "")`
- [ ] 4.7 Remove old `deriveProviderModelsEndpoint` export and its internal logic
- [ ] 4.8 In `validateProviderSettings`, rename the `apiBaseUrl` URL check (was `chatCompletionsEndpoint`), and add three failure modes: path ends `/chat/completions` or `/chat/completions/` or `/completions` → issue `"provider.apiBaseUrl should be a base URL (e.g. https://gateway.example.com/v1), not the chat completions URL."`; `url.search` non-empty → issue `"provider.apiBaseUrl must not include a query string."`; `url.hash` non-empty → issue `"provider.apiBaseUrl must not include a fragment."`
- [ ] 4.9 In `validateProviderSettings`, rename `modelsEndpoint` references to `modelsEndpointOverride` (validation remains: optional http(s) URL, no extra rules)
- [ ] 4.10 In `createProviderSettingsStatus`, replace `deriveProviderModelsEndpoint(settings)` call with `resolveModelsEndpoint(settings)`; field on the status remains `modelsEndpoint` (status type already renamed to `modelsEndpointOverride` in 3.2 — adjust accordingly)
- [ ] 4.11 Run `npm run typecheck` in `web/` and fix any residual `chatCompletionsEndpoint` / `modelsEndpoint` references inside `provider-settings.ts`

## 5. Wire `gateway-client.ts` to resolver + new env var

- [ ] 5.1 In `web/lib/server/gateway-client.ts`, replace `chatCompletionsEndpoint` usage at line 200 (`fetch(params.settings.chatCompletionsEndpoint, ...)`) with `fetch(resolveChatCompletionsUrl(params.settings), ...)`
- [ ] 5.2 Replace the `!providerSettings.chatCompletionsEndpoint` guard at line 256 with `!providerSettings.apiBaseUrl`
- [ ] 5.3 Update the error message at line 257 to reference `OPENAI_COMPAT_API_BASE_URL` instead of `OPENAI_COMPAT_API_ENDPOINT`
- [ ] 5.4 Remove the wrapper `deriveModelsEndpoint` (lines 85-90) and any remaining `OPENAI_COMPAT_MODELS_ENDPOINT` direct reads — `provider-settings.ts` now owns env reads
- [ ] 5.5 Replace `discoverProviderModels`'s call to `deriveProviderModelsEndpoint(readySettings)` (line 150) with `resolveModelsEndpoint(readySettings)`
- [ ] 5.6 Import `resolveChatCompletionsUrl` and `resolveModelsEndpoint` from `@/lib/server/provider-settings`
- [ ] 5.7 Run `npm run typecheck` and verify gateway-client compiles

## 6. Legacy schema detection in `platform-settings.ts`

- [ ] 6.1 In `web/lib/server/platform-settings.ts`, locate the envelope-load path (around line 316 where `normalizeProviderSettings` is called) and inspect `maybeEnvelope.provider` raw object before normalization
- [ ] 6.2 If raw provider object has own-property `chatCompletionsEndpoint` or `modelsEndpoint`, throw `PlatformSettingsError("Legacy provider schema in runtime settings file.", ["Legacy provider keys (chatCompletionsEndpoint / modelsEndpoint) detected. Open /admin and either reset to defaults or re-save provider settings."], 500)`
- [ ] 6.3 Ensure detection happens BEFORE `normalizeProviderSettings` (which would silently drop the unknown keys)
- [ ] 6.4 Run `npm run typecheck` to confirm no regressions

## 7. Admin UI: field, helper text, legacy banner

- [ ] 7.1 In `web/components/evaluation/admin-provider-settings.tsx`, find the `Chat completions endpoint` label (line 211) and rename to `API base URL`
- [ ] 7.2 Change the input `value` and `onChange` to reference `apiBaseUrl` instead of `chatCompletionsEndpoint`
- [ ] 7.3 Replace placeholder `https://gateway.example.com/v1/chat/completions` (line 214) with `https://gateway.example.com/v1`
- [ ] 7.4 Add a `<small className="provider-helper">` (or equivalent existing helper-class — inspect file to reuse pattern) under the input: `請貼 base URL（例：https://gateway.example.com/v1），不要包含 /chat/completions。`
- [ ] 7.5 Find the `Models endpoint` label (line 221) and rename to `Models endpoint override (optional)`; update placeholder to `留空時由 API base URL 推導 /models`
- [ ] 7.6 Switch the input binding from `modelsEndpoint` to `modelsEndpointOverride`
- [ ] 7.7 At the top of the provider panel (or wherever `PlatformSettingsError` is surfaced), add a banner that activates when the parent settings fetch returns the legacy-schema error: text `偵測到舊版 provider 設定格式，請重新儲存設定或按下方「Reset to defaults」。` Reuse existing error-styling class.
- [ ] 7.8 Verify the existing reset-to-defaults button (find via grep on `settings/reset` in the file) is reachable from the banner state (visible even when load failed)
- [ ] 7.9 Run `npm run typecheck` and `npm run lint`

## 8. Test verification (GREEN)

- [ ] 8.1 Run `npm run typecheck` in `web/` → must pass with the updated fixture from task 2.1–2.2
- [ ] 8.2 Run `npm run verify:provider-url` → must pass all 6 assertions from task 2.4
- [ ] 8.3 Run `npm run lint` → must pass
- [ ] 8.4 Run `npm run build` → must succeed (Next.js build)

## 9. Manual smoke (local dev)

- [ ] 9.1 Set `OPENAI_COMPAT_API_BASE_URL=http://127.0.0.1:8080/v1` and `SHARED_INVITE_CODE=ailab502` in `web/.env.local`; remove or leave any legacy `OPENAI_COMPAT_API_ENDPOINT` (must not affect behavior)
- [ ] 9.2 Delete or rename local `web/.data/platform-settings.json` if it exists from prior runs (legacy-schema detection requires a clean slate for the happy path)
- [ ] 9.3 Start `npm run dev` from `web/`; open `/admin`; confirm provider panel shows new label `API base URL`, helper text, and the field is empty or populated from env
- [ ] 9.4 With a temporary fake `.data/platform-settings.json` containing `{ "provider": { "chatCompletionsEndpoint": "http://x/v1/chat/completions", "modelsEndpoint": "" } }`, reload `/admin` and confirm the legacy-schema banner appears; press reset; confirm banner clears and form re-populates from env
- [ ] 9.5 Delete temporary file; restart dev server; confirm normal load

## 10. Docs

- [ ] 10.1 Update `web/README.md` lines 30–35: rename env var to `OPENAI_COMPAT_API_BASE_URL=http://127.0.0.1:8080/v1` (drop `/chat/completions`); add one-line note that the app derives chat + models from this base
- [ ] 10.2 Update `web/README.md` lines 46–52: keep `OPENAI_COMPAT_MODELS_ENDPOINT` as optional override; update comment to clarify it overrides the derived `/models` URL
- [ ] 10.3 Update `CLAUDE.md` Zeabur Env Vars block (line 31 area): change `OPENAI_COMPAT_API_ENDPOINT` mentions to `OPENAI_COMPAT_API_BASE_URL`; add migration note: "after deploy, open /admin and re-save provider settings if legacy banner appears"

## 11. Final validation

- [ ] 11.1 Run `openspec validate provider-api-base-url --strict` → must pass
- [ ] 11.2 Run `openspec status --change provider-api-base-url` → confirm all artifacts complete and ready to apply
- [ ] 11.3 Confirm `git status` shows only intended files (no stray modifications)
