## 1. Provider Settings Model
- [x] 1.1 Add `ProviderSettings`, `ProviderSettingsStatus`, model discovery, and preview response types in `web/lib/evaluation/types.ts`.
- [x] 1.2 Add provider defaults derived from `OPENAI_COMPAT_*` env vars, including endpoint, optional models endpoint, API key env var name, default prompt, temperature, max tokens, and optional model mapping.
- [x] 1.3 Validate provider settings server-side: URL fields, env var name format, complete A/B/C mapping for saved runtime settings, non-empty prompts, temperature range, and max token bounds.
- [x] 1.4 Include provider settings in runtime settings load/save envelopes without storing raw API keys.
- [x] 1.5 Include provider settings in `settingsSnapshotHash` so exported evaluation records are reproducible against the active provider configuration.
- [x] 1.6 Return `apiKeyConfigured` and sanitized provider metadata from settings APIs; never return the raw API key value.

## 2. Admin Settings API
- [x] 2.1 Extend `GET /api/admin/settings` to return study config, provider settings, version, hash, and API key configured status.
- [x] 2.2 Extend `PUT /api/admin/settings` to accept and persist provider settings with validation errors mapped to user-facing messages.
- [x] 2.3 Keep existing study config save/reset behavior compatible with older clients that only send `config`.
- [x] 2.4 Extend reset behavior so provider settings reset to env-derived defaults.
- [x] 2.5 Extend settings export/import, if present, to include sanitized provider settings and exclude secrets.
- [x] 2.6 Add regression coverage for invalid provider saves not overwriting the previous valid settings.

## 3. Provider Discovery And Preview
- [x] 3.1 Add `GET /api/admin/provider/models`, protected by the existing admin guard.
- [x] 3.2 Resolve the models endpoint from the configured `modelsEndpoint`, or derive it from `/v1/chat/completions` when omitted.
- [x] 3.3 Call the OpenAI-compatible models endpoint using only the server-side env var named by `apiKeyEnvVar`.
- [x] 3.4 Return discovered model IDs, latency, endpoint metadata, and API key configured status without leaking secrets.
- [x] 3.5 Add `POST /api/admin/provider/test`, protected by the existing admin guard.
- [x] 3.6 Preview all three mapped candidates against a supplied sample question using configured prompt, temperature, max tokens, and model mapping.
- [x] 3.7 Ensure preview requests do not create participant sessions, pending questions, evaluation answers, or admin analytics records.
- [x] 3.8 Surface discovery and preview failures as structured JSON errors suitable for toast or alert rendering.

## 4. Gateway Client Integration
- [x] 4.1 Refactor `web/lib/server/gateway-client.ts` to accept the active provider settings instead of reading endpoint/model values only from env.
- [x] 4.2 Render the configured user prompt template with question text, category title, and category instruction placeholders.
- [x] 4.3 Apply configured system prompt, temperature, max tokens, and mapped provider model ID for each internal candidate.
- [x] 4.4 Reject formal answer generation before creating pending question records when provider settings are incomplete or API key is missing.
- [x] 4.5 Preserve legacy env-derived behavior for local development when no runtime provider settings have been saved.
- [x] 4.6 Keep retry and per-model failure behavior compatible with the existing evaluation UI.

## 5. Admin Provider UI
- [x] 5.1 Add a focused provider configuration panel to the admin interface above operational analytics.
- [x] 5.2 Provide controls for chat completions endpoint, optional models endpoint, API key env var name, system prompt, user prompt template, temperature, and max tokens.
- [x] 5.3 Display API key configured status as a clear server-derived state, not an editable secret field.
- [x] 5.4 Add model discovery controls that populate selectable provider model IDs.
- [x] 5.5 Add A/B/C internal candidate mapping controls with explicit validation that all three candidates are mapped before saving.
- [x] 5.6 Add provider preview controls with sample question input, per-candidate result, latency, and structured failure display.
- [x] 5.7 Keep the provider UI responsive on desktop and mobile without nested cards or cramped controls.

## 6. Evaluation Flow
- [x] 6.1 Update answer generation routes to load the active runtime provider settings before dispatching model requests.
- [x] 6.2 Store the active settings version and hash on generated answer records after provider settings are included in the hash.
- [x] 6.3 Keep formal experiment mode strict: if provider configuration is invalid or downstream provider is unavailable, show an error and do not accept fallback mock data.
- [x] 6.4 Ensure retrying one failed model uses the same active provider settings snapshot as the original question when possible.
- [x] 6.5 Verify participant-facing model identities remain blinded even when admin names provider model IDs.

## 7. Documentation And Change Notes
- [x] 7.1 Update `plan.md` so `add-admin-model-provider-config` is marked as the current change and previous runtime settings work is no longer labeled current.
- [x] 7.2 Document provider settings in the project README or admin setup docs: env vars, admin token URL, API key handling, model discovery, and preview.
- [x] 7.3 Add or update `.env.example` with non-secret provider variables and clear API key placement guidance.
- [x] 7.4 Note the current limitation that internal candidates remain A/B/C until the later dynamic-model-record change.

## 8. Verification
- [x] 8.1 Run `openspec validate add-admin-model-provider-config --strict`.
- [x] 8.2 Run the frontend typecheck/lint/build commands used by this project.
- [x] 8.3 Smoke test admin settings save/reset, provider discovery, provider preview, and participant answer generation against a mock OpenAI-compatible endpoint.
- [x] 8.4 Verify preview does not change evaluation storage counts.
- [x] 8.5 Verify invalid provider settings produce visible admin errors and keep the last valid settings.
- [x] 8.6 Verify participant UI shows an error alert, not mock answers, when formal provider configuration is missing or down.
