## File Plan

- Create: `web/lib/evaluation/study-copy-form.ts` — client-safe helpers for cloning study config and converting multiline textarea input to validated string arrays.
- Create: `web/tests/study-copy-form-typecheck.ts` — TypeScript coverage for study-copy helper shapes and array parsing behavior.
- Create: `web/components/evaluation/admin-study-copy-settings.tsx` — admin UI for participant-facing study copy and prompt category examples.
- Modify: `web/app/admin/page.tsx` — render the study-copy settings panel with active platform settings.
- Modify: `web/components/evaluation/admin-provider-settings.tsx` — clarify that provider template variables are separate from study-copy fields.
- Modify: `web/app/globals.css` — add responsive layout styles for the study-copy settings panel if existing admin styles are insufficient.

## 1. Study Copy Helpers

- [x] 1.1 RED: Create `web/tests/study-copy-form-typecheck.ts` importing planned helper names from `@/lib/evaluation/study-copy-form`.
- [x] 1.2 Verify RED: Run `cd web && npm run typecheck` and confirm it fails because `study-copy-form.ts` does not exist.
- [x] 1.3 GREEN: Create `web/lib/evaluation/study-copy-form.ts` with `cloneStudyConfig(config)`, `arrayToMultiline(items)`, and `multilineToArray(value)` helpers.
- [x] 1.4 Verify GREEN: Run `cd web && npm run typecheck` and confirm helper imports and return types pass.
- [x] 1.5 Add helper coverage in `study-copy-form-typecheck.ts` for preserving `StudyConfig` structure and dropping blank multiline rows.

## 2. Admin Study Copy UI

- [x] 2.1 Create `web/components/evaluation/admin-study-copy-settings.tsx` as a client component accepting `initialSettings: ActivePlatformSettings`.
- [x] 2.2 Add local `StudyConfig` state initialized from `cloneStudyConfig(initialSettings.config)`.
- [x] 2.3 Add controlled inputs for `study.eyebrow`, `study.title`, `study.rootTitle`, and `study.rootDescription`.
- [x] 2.4 Add controlled fields for intro greeting, intro paragraphs textarea, and intro tasks textarea.
- [x] 2.5 Add controlled fields for signature closing, student name, affiliation/school, advisor/professor, and thesis title.
- [x] 2.6 Add controlled fields for completion eyebrow, title, description, and completion notes textarea.
- [x] 2.7 Render each existing `promptCategories[index]` as an editable section with title input, instruction textarea, and multiline examples textarea.
- [x] 2.8 Convert multiline fields back to arrays with `multilineToArray` immediately before save.
- [x] 2.9 Add a Save action that sends `PUT /api/admin/settings` with `{ config }` and does not include provider settings.
- [x] 2.10 Add success toast that includes the returned `settingsVersion` after save.
- [x] 2.11 Add error toast that displays `error` plus joined `issues` from failed settings API responses.
- [x] 2.12 Add a restore-loaded-values action that resets local state to `initialSettings.config` without calling `/api/admin/settings/reset`.

## 3. Admin Page Integration

- [x] 3.1 Import `AdminStudyCopySettings` in `web/app/admin/page.tsx`.
- [x] 3.2 Render `AdminStudyCopySettings` near the top of `/admin`, before the provider settings panel.
- [x] 3.3 Confirm existing provider settings, export actions, invite actions, and analytics tables still render below the new panel.
- [x] 3.4 Update `AdminProviderSettings` helper text so `{{categoryTitle}}`, `{{categoryInstruction}}`, and `{{question}}` are explicitly described as provider prompt variables, not questionnaire copy fields.
- [x] 3.5 Add or adjust CSS in `web/app/globals.css` for study-copy grids, repeated category sections, and mobile stacking without nesting cards inside cards.

## 4. Behavior Verification

- [x] 4.1 RED: Temporarily save a category with fewer than five non-empty examples through the new UI or an equivalent request, and verify the API returns a validation error without overwriting settings.
- [x] 4.2 GREEN: Save valid study copy with changed title, signature metadata, completion note, and one category example through the new UI.
- [x] 4.3 Verify `/eval` renders the updated intro title, intro letter, signature metadata, and category examples after the save.
- [x] 4.4 Verify the completion page renders updated completion copy by using an existing completed session or by inspecting active settings render output.
- [x] 4.5 Verify provider settings remain unchanged after a study-copy-only save by comparing endpoint, model mapping, prompt template, temperature, and max tokens before and after save.
- [x] 4.6 Verify provider template helper text still lists only `{{categoryTitle}}`, `{{categoryInstruction}}`, and `{{question}}`.

## 5. Final Checks

- [x] 5.1 Run `openspec validate add-admin-study-copy-config --strict`.
- [x] 5.2 Run `cd web && npm run typecheck`.
- [x] 5.3 Run `cd web && npm run lint`.
- [x] 5.4 Run `cd web && npm run build`.
- [x] 5.5 Update `plan.md` to mark `add-admin-study-copy-config` as current or done according to implementation status.
- [x] 5.6 Self-review tasks against the spec: study identity, intro, signature, completion, category examples, provider preservation, and prompt-variable separation are all covered.
