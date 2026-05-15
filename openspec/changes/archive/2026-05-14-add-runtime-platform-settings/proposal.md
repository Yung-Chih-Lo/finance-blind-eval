## Why

The platform still treats `web/config/evaluation.config.json` as a compile-time source of truth, which is too rigid for an open-source evaluation app that should be deployable by different researchers without source edits. Runtime settings are needed now so admin-controlled provider, prompt, and study-content work can build on a stable persistence and versioning layer.

## What Changes

- Add a runtime settings file at `.data/platform-settings.json` that can override the repository default config after deployment.
- Keep `web/config/evaluation.config.json` as the default template and fallback when runtime settings do not exist.
- Add server-side helpers to load, validate, normalize, version, and save platform settings.
- Add admin API routes for reading, saving, resetting, and exporting the current platform settings.
- Include `settingsVersion` and settings snapshot metadata on newly generated evaluation records so later analysis can reproduce which configuration produced each answer.
- Document the runtime settings file, default fallback behavior, and deployment ownership expectations.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `blind-evaluation-app`: Adds runtime platform settings, admin settings APIs, and per-record settings version tracking to the existing configurable study-content capability.

## Impact

- Affected code: `web/lib/evaluation/config.ts`, `web/lib/evaluation/types.ts`, `web/lib/server/*`, `web/app/api/admin/*`, `web/app/api/evaluation/*`, admin/export code, and documentation.
- Affected data: `.data/platform-settings.json` becomes the editable runtime settings file; evaluation records gain settings metadata for reproducibility.
- Affected operations: deployments can keep repository defaults unchanged while editing runtime settings through protected admin APIs.
