## Why

Runtime settings can already store study copy, signature metadata, prompt categories, examples, completion text, facets, flags, and limits, but admins cannot edit the participant-facing questionnaire copy from the UI. This still forces researchers to modify JSON or source files for human-facing study wording, which is too brittle for a reusable thesis evaluation platform.

## What Changes

- Add an admin study-copy settings panel that edits participant-facing `StudyConfig` fields from `/admin`.
- Let admins edit study title, root landing title, root description, study eyebrow, intro letter greeting, intro paragraphs, task list, signature metadata, completion page copy, and completion notes.
- Let admins edit each prompt category title, instruction, and the five example questions shown to participants.
- Save study-copy edits through the existing protected `/api/admin/settings` runtime settings API and `.data/platform-settings.json` envelope.
- Keep provider prompt-template variables separate from questionnaire copy; do not add student/advisor/school metadata to model prompts by default.
- Preserve existing validation requirements, including non-empty copy fields and at least five example questions per prompt category.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `blind-evaluation-app`: Adds admin-editable participant-facing study copy and prompt example settings through the existing runtime platform settings contract.

## Impact

- Affected code: `web/components/evaluation/*` admin settings components, `web/app/admin/page.tsx`, `web/lib/evaluation/types.ts` if UI helper types are needed, and existing settings API wiring.
- Affected data: `.data/platform-settings.json` continues to hold the runtime settings envelope; study-copy saves increment `settingsVersion` and update the settings snapshot hash.
- Affected UX: researchers can update questionnaire wording, signature details, completion text, category guidance, and examples without redeploying or editing JSON by hand.
- Not affected: provider API secrets remain server-side, and provider prompt behavior remains controlled by the existing provider settings panel.
