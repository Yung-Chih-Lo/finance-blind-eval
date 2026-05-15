## Context

The runtime settings envelope already contains the full `StudyConfig` under `config`, and the participant entry page, root page, completion page, prompt categories, examples, facets, flags, limits, and provider prompt rendering already read from active platform settings. The missing piece is an admin UI that lets a researcher edit the participant-facing study copy without hand-editing `web/config/evaluation.config.json` or `.data/platform-settings.json`.

The admin page already receives `ActivePlatformSettings`, renders provider controls, and saves provider updates through `PUT /api/admin/settings`. The same protected settings API can persist study-copy edits if the client submits `{ config }`; the server already preserves provider settings when the provider payload is omitted.

## Goals / Non-Goals

**Goals:**

- Add a participant-facing study copy editor to `/admin`.
- Cover existing `StudyConfig.study` fields: title, root title/description, eyebrow, intro greeting, intro paragraphs, intro task list, signature metadata, completion copy, and completion notes.
- Cover existing prompt category fields: title, instruction, and five participant-visible example questions per category.
- Reuse existing runtime settings validation, versioning, snapshot hashing, and admin auth.
- Keep provider prompt-template variables clearly separate from questionnaire copy settings.

**Non-Goals:**

- Do not add raw JSON import or arbitrary schema editing in this change.
- Do not add/remove/reorder prompt categories in v1; edit the configured categories in place.
- Do not make `modelIds`, `answerLabels`, facets, flags, limits, or rate limits editable in this change.
- Do not inject student/advisor/school/thesis metadata into provider prompts by default.
- Do not change participant record schemas.

## Decisions

### 1. Add A Dedicated `AdminStudyCopySettings` Client Component

Create a focused client component, likely `web/components/evaluation/admin-study-copy-settings.tsx`, and render it on `/admin` near the provider settings panel. The component should receive `initialSettings: ActivePlatformSettings`, clone `initialSettings.config`, allow local edits, and save with:

```ts
PUT /api/admin/settings
body: { config }
```

This uses the existing server-side validation and keeps provider settings unchanged.

Alternative considered: extend `AdminProviderSettings` with study fields. That would create a single large component mixing operational provider setup with participant-facing copy. A separate component keeps ownership clearer and makes future apply tasks smaller.

### 2. Edit Arrays As Multiline Text In V1

Represent these arrays as newline-separated textarea values:

- `study.intro.paragraphs`
- `study.intro.tasks`
- `study.completion.notes`
- each `promptCategories[index].examples`

On save, split by line, trim whitespace, and drop empty lines. The existing server validator then enforces non-empty arrays and at least five examples per category.

Alternative considered: add per-item add/remove controls. That is nicer long term, but it adds more UI state and validation cases. Multiline editing is enough for this researcher-admin workflow and avoids accidental overbuilding.

### 3. Edit Existing Prompt Categories In Place

The first implementation should render each configured prompt category as a repeated section with title, instruction, and example textarea. It should not create, delete, or reorder categories.

Reasoning: the participant flow, `maxQuestionsPerParticipant`, and records already assume the configured category sequence. Editing labels and examples is low-risk; structural category management belongs in a later change.

### 4. Keep Prompt Variables In Provider Settings Only

The provider prompt template continues to support only `{{categoryTitle}}`, `{{categoryInstruction}}`, and `{{question}}`. The study-copy panel should not present student/advisor/school fields as prompt variables.

Reasoning: participant-facing metadata can bias or change model behavior if injected into prompts. Keeping the first version visible-copy-only preserves research cleanliness.

### 5. Use Existing Toast And Validation Feedback

Successful saves should show a toast with the new settings version. Failed saves should display the server validation issue summary through the same toast mechanism used elsewhere in admin. The component should also provide a local "restore loaded values" action so admins can discard unsaved edits without resetting the entire runtime settings file.

## Risks / Trade-offs

- [Risk] Multiline textareas are less polished than item builders. -> Mitigation: label them clearly and use helper text that each line becomes one paragraph/task/note/example.
- [Risk] Admin can save copy that changes research wording mid-study. -> Mitigation: existing `settingsVersion` and snapshot hash capture the active copy used by subsequent generated answers.
- [Risk] Editing category examples while participants are mid-session can change the next rendered examples. -> Mitigation: this is acceptable runtime-admin behavior; generated records already retain the actual prompt category and user question.
- [Risk] Large admin page becomes visually dense. -> Mitigation: keep the study-copy editor in grouped sections and avoid nesting cards inside cards.

## Migration Plan

1. Add the admin study-copy component and render it with active settings.
2. Wire save/restore actions to existing settings API behavior.
3. Add focused tests for array parsing and settings save payload behavior.
4. Verify `/admin` still renders provider settings and analytics after study-copy controls are added.

Rollback: revert the UI component and admin page render call. Existing runtime settings data remains compatible because this change does not alter the settings envelope schema.

## Open Questions

- Whether to place the study-copy editor above or below provider settings on `/admin`. Default recommendation: place participant-facing copy above provider settings, because it is less operational and likely edited before model setup.
- Whether later changes should add full category add/remove/reorder controls after dynamic model/record work is complete.
