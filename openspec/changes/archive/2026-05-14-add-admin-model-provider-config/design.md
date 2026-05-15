## Context

The app now has protected admin settings APIs and runtime settings versioning, but model provider behavior is still controlled by `OPENAI_COMPAT_*` environment variables and hardcoded prompt strings in `web/lib/server/gateway-client.ts`. This means a researcher can edit study copy and prompt categories through runtime settings, but cannot configure which gateway endpoint, model names, system prompt, user prompt template, temperature, or token budget the evaluation uses.

The platform is intended to be open-source and reusable. Admin configuration must be usable from `/admin`, while secrets must remain server-side and never be written into `.data/platform-settings.json`.

## Goals / Non-Goals

**Goals:**

- Add a non-secret provider settings section to the runtime settings envelope.
- Provide admin UI controls for endpoint, model discovery, candidate model mapping, prompt template, temperature, and max tokens.
- Let admins discover gateway models from the configured models endpoint.
- Let admins preview/test the provider without creating evaluation records.
- Make participant answer generation use runtime provider settings.
- Continue to support current `OPENAI_COMPAT_*` env vars as defaults and backward-compatible fallback.

**Non-Goals:**

- Store raw API keys in the runtime settings file.
- Make model IDs fully dynamic in reporting and exports; this remains the next planned `dynamic-model-evaluation-records` change.
- Add multi-provider plugin support beyond OpenAI-compatible `/v1/models` and `/v1/chat/completions`.
- Add streaming provider previews; formal participant streaming is already handled separately in the UI flow.

## Decisions

### 1. Add Provider Settings As A Sibling To `config`

Extend the settings envelope to:

```json
{
  "settingsVersion": 2,
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "updatedBy": "admin",
  "settingsSnapshotHash": "...",
  "config": {},
  "provider": {
    "chatCompletionsEndpoint": "https://gateway.example/v1/chat/completions",
    "modelsEndpoint": "https://gateway.example/v1/models",
    "apiKeyEnvVar": "OPENAI_COMPAT_API_KEY",
    "modelMapping": {
      "H1-best": "model-a",
      "H2-best": "model-b",
      "TAIDE-baseline": "model-c"
    },
    "systemPrompt": "...",
    "userPromptTemplate": "...",
    "temperature": 0.2,
    "maxTokens": 1200
  }
}
```

Provider settings are not part of `StudyConfig` because they are operational configuration, not participant-facing study copy. `settingsSnapshotHash` should include both `config` and `provider` so answer records identify the complete runtime behavior.

Alternative considered: store provider settings in a separate file. That reduces blast radius, but adds an extra versioning path. A single settings envelope is simpler and keeps reproducibility aligned.

### 2. Keep Secrets In Environment Variables

The settings file stores `apiKeyEnvVar`, not the API key. Server helpers read `process.env[apiKeyEnvVar]` and return only `apiKeyConfigured: boolean` to admin APIs/UI.

Alternative considered: encrypt API keys in `.data`. That creates key-management and rotation problems for a local thesis platform. Env-only secrets are simpler and safer.

### 3. Require Explicit Three-Model Mapping Before Formal Generation

Formal answer generation should use `provider.modelMapping` for the existing internal `ModelId` values: `H1-best`, `H2-best`, and `TAIDE-baseline`. If any mapping is missing, the server can fall back to the legacy inference path only when runtime provider settings are still default. Once an admin saves provider settings, missing mappings should be a configuration error.

Alternative considered: map A/B/C directly in settings. That would mix display labels with internal research model IDs and makes later randomized label mapping harder. Keep internal model IDs for now.

### 4. Add Dedicated Provider Admin APIs

Add routes under `/api/admin/provider`:

- `GET /api/admin/provider/models` discovers model IDs using active provider endpoints.
- `POST /api/admin/provider/test` sends a preview question to the mapped models or one selected model and returns sanitized preview output.

Settings persistence remains in `/api/admin/settings`. Provider APIs are operational actions and should not write records.

### 5. Admin UI Uses Progressive Disclosure

The admin dashboard should add a provider settings section above analytics tables. The section should show:

- connection fields and API key status,
- model discovery and three mapping selects,
- prompt and generation controls,
- save/reset/test actions.

This keeps operational setup near the admin dashboard without turning the participant flow into a configuration surface.

## Risks / Trade-offs

- [Risk] A bad endpoint or missing API key can break formal evaluations. -> Mitigation: validate settings, show key status, add test action, and fail answer generation before creating pending questions.
- [Risk] Prompt template changes can make old and new records hard to compare. -> Mitigation: settings version/hash already attach to records; include provider settings in the hash.
- [Risk] Admin preview could accidentally create research records. -> Mitigation: preview route must not touch participant/session/storage functions.
- [Risk] Browser could receive secrets through admin settings JSON. -> Mitigation: API responses expose only env var name and configured boolean, never raw env values.

## Migration Plan

1. Extend settings types and default provider generation from existing `OPENAI_COMPAT_*` env vars.
2. Update validation and hashing to include provider settings.
3. Add provider discovery and preview APIs.
4. Update `gateway-client.ts` to consume active provider settings for formal answer generation.
5. Add the admin provider settings panel and connect it to settings save/discover/test routes.
6. Update documentation and env examples.

Rollback: remove `.data/platform-settings.json` or reset settings. The default provider settings will derive from the existing environment variables.

## Open Questions

- Whether provider preview should fan out to all three configured models by default or test only a single selected model. The implementation can support both, but the first UI should default to all three because this is a blind-comparison platform.
