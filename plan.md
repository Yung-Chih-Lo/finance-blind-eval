# Eval Platform Change Plan

This file keeps the next platformization changes small and easy to sequence.

## Completed

### 1. add-admin-token-session (done)

Add an admin magic-link flow for `/admin?token=...`.

- Done: exchange a URL token for an httpOnly admin session cookie.
- Done: redirect back to `/admin` without the token in the URL.
- Done: protect `/admin` and `/api/admin/*` with the admin session.
- Done: keep Basic Auth as a fallback for local or deployment recovery.

### 2. add-runtime-platform-settings (done)

Add runtime settings storage for open-source deployments.

- Done: introduce `.data/platform-settings.json` as the editable runtime settings file.
- Done: keep `web/config/evaluation.config.json` as the default template.
- Done: add server helpers to load, validate, version, save, export, and reset settings.
- Done: track `settingsVersion` and `settingsSnapshotHash` so old evaluation records remain reproducible.

### 3. add-admin-model-provider-config (done)

Let admin configure the LLM provider and prompt behavior from the UI.

- Done: add admin fields for chat completions endpoint and optional models endpoint.
- Done: let admin select three candidate model names from discovered `/v1/models`.
- Done: add editable system prompt, user prompt template, temperature, and max token settings.
- Done: add a preview/test action that calls the provider without writing participant records.
- Done: keep API keys server-side only; v1 uses an env var name such as `OPENAI_COMPAT_API_KEY`.

### 4. add-admin-study-copy-config (done)

Let admin configure the participant-facing study copy from the UI.

- Done: add admin fields for study title, root page title, root page description, and study eyebrow.
- Done: add admin fields for the participant intro letter: greeting, paragraphs, and task list.
- Done: add admin fields for signature metadata: student name, affiliation/school, advisor/professor, and thesis title.
- Done: add admin fields for completion page copy: eyebrow, title, description, and notes.
- Done: add admin fields for each prompt category: title, instruction, and the five example questions shown to participants.
- Done: reuse the existing `.data/platform-settings.json` runtime settings envelope and validation path.
- Done: keep these fields participant-facing only in v1; provider prompt-template variables remain `{{categoryTitle}}`, `{{categoryInstruction}}`, and `{{question}}`.

## Planned

### 5. dynamic-model-evaluation-records (partial)

Remove hardcoded model IDs from evaluation and reporting.

Already done:

- Randomize A/B/C labels for formal evaluations.
- Store hidden label mapping, gateway model names, `settingsVersion`, and `settingsSnapshotHash` on pending questions and records.

Remaining:

- Replace fixed `H1-best`, `H2-best`, and `TAIDE-baseline` assumptions with dynamic candidate IDs.
- Make provider `modelMapping`, validators, metrics, CSV/JSON export, and hidden mapping display support dynamic candidate IDs end-to-end.
- Decide whether preview should stay fixed-order for debugging or expose the same randomization path as formal evaluations.

## Recommended Order

1. Completed: admin token session.
2. Completed: runtime platform settings.
3. Completed: provider/model/prompt admin UI.
4. Completed: participant-facing study copy controls.
5. Next: finish dynamic model IDs end-to-end because it touches types, validation, records, exports, and admin metrics.

## Later Backlog

- Multi-question provider preview: let admin run preview against multiple configured examples instead of only one `Preview question`.
- Category-aware provider preview: let admin choose which prompt category is used for preview instead of always using the first category.
- Prompt variable reference UI: show available provider-template variables in a clearer help panel, with examples of rendered output.
- Optional research-metadata prompt variables: allow `{{studentName}}`, `{{advisor}}`, `{{affiliation}}`, and `{{thesisTitle}}` only if we decide the provider prompt should intentionally receive that context.
- Import/export settings polish: make JSON export/import safer for study-copy edits and deployment handoff.
- Toast polish follow-up: visually compare against shadcn/Sonner defaults in-browser and tune spacing/animation if needed.
