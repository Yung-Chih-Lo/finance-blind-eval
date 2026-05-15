## Why

Admins can now read and save runtime platform settings, but they still cannot configure the model provider, candidate model mapping, or prompt behavior from the UI. This blocks the platform from being reused as an open-source LLM evaluation form without editing environment variables and source code for every deployment.

## What Changes

- Extend runtime platform settings with a server-side provider configuration section for OpenAI-compatible chat completions.
- Add admin UI controls for chat completions endpoint, optional models endpoint, API-key env var name/status, candidate model mapping for A/B/C internal model IDs, system prompt, user prompt template, temperature, and max tokens.
- Add admin actions to discover models from the configured `/v1/models` endpoint and assign exactly three gateway model names to the existing blind-evaluation candidates.
- Add a preview/test endpoint that calls the configured provider without creating participant sessions, pending questions, or evaluation records.
- Update answer generation to use runtime provider settings instead of only `OPENAI_COMPAT_*` env variables.
- Keep gateway API keys server-side only; runtime settings SHALL store an env var name and secret availability status, not the raw key.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `blind-evaluation-app`: Adds admin-editable provider/model/prompt settings, model discovery, provider preview, and provider-backed answer generation through runtime settings.

## Impact

- Affected code: `web/lib/evaluation/types.ts`, `web/lib/server/platform-settings.ts`, `web/lib/server/gateway-client.ts`, `web/app/admin/page.tsx`, new admin provider UI components, new admin provider API routes, and documentation.
- Affected data: `.data/platform-settings.json` gains a non-secret provider settings section and continues versioning through `settingsVersion`.
- Affected operations: researchers can configure endpoint/model/prompt behavior from `/admin`; deployers still provide API keys through environment variables.
