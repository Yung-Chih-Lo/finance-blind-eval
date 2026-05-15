## Context

The Next.js app currently imports `web/config/evaluation.config.json` through `web/lib/evaluation/config.ts`, then exposes synchronous constants such as `STUDY_CONFIG`, `PROMPT_CATEGORIES`, `MODEL_IDS`, and `RATE_LIMITS`. That works for a thesis prototype but makes the open-source platform hard to operate: changing copy, prompt examples, limits, facets, or later provider defaults requires editing source-controlled files and rebuilding.

Existing durable state already uses a file-backed `.data` pattern in `web/lib/server/evaluation-storage.ts`. Runtime settings should use the same operational model while keeping repository defaults intact.

## Goals / Non-Goals

**Goals:**

- Add `.data/platform-settings.json` as the editable runtime settings source.
- Keep `web/config/evaluation.config.json` as the default template and fallback.
- Validate runtime settings before saving or using them.
- Track `settingsVersion` so generated answers and saved records remain reproducible.
- Provide protected admin APIs for reading, saving, resetting, and exporting platform settings.
- Keep API keys and provider secrets out of the runtime JSON file in this change.

**Non-Goals:**

- Build the full admin UI for editing provider/model/prompt fields.
- Replace hardcoded model ID TypeScript unions with fully dynamic model IDs.
- Add a database-backed settings store.
- Add multi-tenant settings or per-invite settings.

## Decisions

### 1. Use `.data/platform-settings.json` With Repository Fallback

Runtime settings will live at `.data/platform-settings.json` by default, with an override env var such as `PLATFORM_SETTINGS_FILE` for deployments that need a different filename. If the file does not exist, the app will load the committed `evaluation.config.json`.

Alternative considered: edit `web/config/evaluation.config.json` directly through admin. That would modify source-controlled config at runtime and is unsafe for containerized or open-source deployments.

### 2. Store A Versioned Settings Envelope

The runtime file will be an envelope:

```json
{
  "settingsVersion": 2,
  "updatedAt": "2026-05-14T00:00:00.000Z",
  "updatedBy": "admin",
  "config": {}
}
```

`config` uses the existing `StudyConfig` shape for now. Every successful save increments `settingsVersion`; reset creates the next version and restores default config. Newly generated pending questions and saved evaluation records store the version and a compact settings snapshot.

Alternative considered: hash the whole config only. A hash is useful, but an integer version is easier for admin tables, exports, and discussion with researchers.

### 3. Add Server-Only Settings Helpers And Pass Public Config Into Client UI

Create `web/lib/server/platform-settings.ts` for file IO, validation, defaults, and versioning. Keep `web/lib/evaluation/config.ts` as repository defaults, then have server pages and server routes load active settings at request time. Client components such as `EvaluationApp`, `TokenEntry`, `QuestionFlow`, and `CompletionPage` should receive the active public config through props instead of importing static defaults.

Alternative considered: make all config imports async immediately. That would touch nearly every component at once and create avoidable UI churn. This change should focus runtime behavior on server routes and admin APIs first.

### 4. Validate With Local Type Guards

Use local validation functions rather than adding a new dependency. The shape is small enough, and the current project does not depend on `zod` or another schema validator.

Alternative considered: add `zod`. That is reasonable later if settings grow significantly, but this change can keep dependencies stable.

### 5. Admin APIs, Not Admin UI Yet

Add API routes under `/api/admin/settings`:

- `GET` returns the active settings envelope and source metadata.
- `PUT` validates and saves a complete settings envelope or config payload.
- `POST /api/admin/settings/reset` restores defaults as a new runtime version.
- `GET /api/admin/settings/export` returns a downloadable JSON file.

The admin UI for endpoint/model/prompt selection belongs to the next change after the persistence layer exists.

## Risks / Trade-offs

- [Risk] Runtime settings can cause hydration mismatch if client components import defaults while server routes use active settings. → Mitigation: pass active public config from server pages into client components and remove static config imports from participant-facing client components.
- [Risk] Invalid runtime JSON could break evaluations. → Mitigation: validate on read and fail closed for admin save; if an existing file is invalid, return a configuration error rather than silently running with corrupt settings.
- [Risk] File writes may fail on read-only deployments. → Mitigation: mirror the existing `.data` fallback pattern and return a clear admin API error when settings cannot be persisted.
- [Risk] Saving whole-config payloads can accidentally drop fields. → Mitigation: normalize payloads against the default config and reject missing required arrays, labels, limits, and study copy.

## Migration Plan

1. Add the settings helper and default envelope generation.
2. Add admin settings routes.
3. Pass active public settings from server pages into participant-facing client components.
4. Move server-side answer generation, validation, record save, admin summaries, and exports to request-time settings.
5. Add settings metadata to new pending questions and records while tolerating old records without those fields.
6. Document `.data/platform-settings.json` and reset behavior.

Rollback is straightforward: remove `.data/platform-settings.json` and the app will use the repository default config again.

## Open Questions

- Whether later provider settings should live in the same envelope under `provider`, or in a separate encrypted/server-secret-aware settings file.
- Whether admin UI saves should require an additional confirmation when changing prompt categories after records already exist.
