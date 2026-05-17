## File Plan

- **Modify** `web/lib/evaluation/types.ts` — add `Gender`, `EducationLevel`, `FinanceBackgroundType`; update `AgeRange` (drop `under_20`); update `ParticipantProfile` (add `gender`, `educationLevel`, `financeBackgroundType`, `hasUsedAiForFinance`; remove `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`; make `gradeOrOccupation` optional).
- **Modify** `web/lib/evaluation/profile.ts` — replace removed option lists with new ones; update `createParticipantProfileDraft`, `validateParticipantProfile`, `isCompleteParticipantProfile`; update `formatProfileChoice` callers.
- **Modify** `web/lib/evaluation/config.ts` — if any profile-related constants live here (likely none — confirm).
- **Modify** `web/components/evaluation/profile-form.tsx` — render gender, education-level, finance-background-type fields; remove field/work-domain, business-or-finance, finance-course, finance-LLM-usage 5-level fields; mark `gradeOrOccupation` optional; rename `financeLlmUsage` 5-level UI to `hasUsedAiForFinance` Y/N.
- **Modify** `web/config/evaluation.config.json` — append the analysis-framing paragraph to `study.intro.paragraphs`.
- **Modify** `web/lib/server/evaluation-storage.ts` — read legacy profiles by dropping removed fields without erroring; preserve legacy snapshots inside already-saved records.
- **Modify** `web/app/api/session/route.ts` — pass new validation through; ensure server rejects writes that include legacy field shape.
- **Modify** `web/app/admin/page.tsx` — replace `field/work domain` and `finance-task LLM usage` columns; render Y/N `hasUsedAiForFinance`; render finance-background-type label; render new gender and education-level columns where appropriate; update KPI bar finance-vs-non-finance breakdown to derive from `financeBackgroundType`.
- **Modify** `web/components/admin/record-drawer.tsx` — show new profile fields; gracefully render legacy snapshots with a `legacy` label prefix.
- **Modify** `web/app/api/admin/export/route.ts` — emit new CSV / JSON columns; drop removed columns; tolerate legacy records (empty cells for new fields).
- **Modify** `web/components/evaluation/admin-export-actions.tsx` — surface only if columns visible to admin change (likely no change needed; confirm during implementation).
- **Create** `web/tests/profile-typecheck.ts` — typecheck file exercising new `ParticipantProfile` shape + helpers.
- **Create** `web/scripts/verify-profile-validation.ts` — runtime verification script for `validateParticipantProfile`, draft helpers, and legacy-shape handling.
- **Modify** `web/scripts/verify-tsconfig.json` — include the new verify script.
- **Modify** `web/package.json` — add `verify:profile` script.

## 1. Pre-flight & test scaffolding

- [x] 1.1 Read current `web/lib/evaluation/types.ts` to confirm exact shape of legacy types being removed.
- [x] 1.2 Read current `web/components/evaluation/profile-form.tsx` to map every field render block being removed/added.
- [x] 1.3 Read current `web/lib/server/evaluation-storage.ts` to locate the participant-profile read/write path. **Note**: `buildExportCsv` / `buildExportJson` live here, not in `web/app/api/admin/export/route.ts` — task group 10 should target storage helpers.
- [x] 1.4 Read current `web/app/admin/page.tsx` (or its participant-table sub-component) to find the columns currently rendered. **Note**: table is inline in `page.tsx`; `getAdminSnapshot` derives `financeBackgroundCount`/`nonFinanceBackgroundCount` from `isBusinessOrFinance` — needs refactor.
- [x] 1.5 Read current `web/app/api/admin/export/route.ts` to find CSV/JSON column emission. **Note**: route is a thin wrapper; column emission is in `buildExportCsv`/`buildExportJson` inside `evaluation-storage.ts`.

## 2. Types (RED → GREEN)

- [ ] 2.1 RED: Write `web/tests/profile-typecheck.ts` that declares one `ParticipantProfile` value using ONLY the new shape (`gender`, `educationLevel`, `financeBackgroundType`, `hasUsedAiForFinance`, optional `gradeOrOccupation`, no removed fields) and one legacy value cast to `unknown` then narrowed by a `migrateLegacyProfile` helper (yet to be written) returning `Partial<ParticipantProfile>`.
- [ ] 2.2 Verify RED: `cd web && npm run typecheck` → FAIL (new types and helper missing).
- [ ] 2.3 GREEN: Update `web/lib/evaluation/types.ts` — add `Gender = "female" | "male" | "non_binary_or_other" | "prefer_not_to_say"`, `EducationLevel = "high_school_or_below" | "undergrad_in_progress" | "undergrad_completed" | "grad_or_above" | "prefer_not_to_say"`, `FinanceBackgroundType = "student_finance_related" | "student_other" | "working_finance_related" | "working_other" | "prefer_not_to_say"`.
- [ ] 2.4 GREEN: Update `AgeRange` in `types.ts` — remove `under_20` literal.
- [ ] 2.5 GREEN: Update `ParticipantProfile` in `types.ts` — add `gender: Gender`, `educationLevel: EducationLevel`, `financeBackgroundType: FinanceBackgroundType`, `hasUsedAiForFinance: boolean`; remove `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`; make `gradeOrOccupation?: string` (optional); confirm removal of `fieldOrWorkDomain`. Also export a `ParticipantProfileDraft` type = `Omit<ParticipantProfile, "hasUsedAiForFinance"> & { hasUsedAiForFinance: boolean | null }` for the form/draft path; stored `ParticipantProfile.hasUsedAiForFinance` remains `boolean`.
- [ ] 2.6 Verify GREEN: `cd web && npm run typecheck` → ALL PASS (after `migrateLegacyProfile` stub added in step 4.1).

## 3. Profile options & validation (RED → GREEN)

- [ ] 3.1 RED: Extend `web/tests/profile-typecheck.ts` to call `validateParticipantProfile` against (a) a fully-populated new-shape draft with `hasUsedAiForFinance: true` (expect `[]`), (b) a draft missing `gender` (expect non-empty issues including a gender hint), (c) a draft missing `educationLevel`, (d) a draft missing `financeBackgroundType`, (e) a draft with `hasUsedAiForFinance: null` (expect a "請選擇" issue — this guards against the silent-default-false trap), (f) a draft with `hasUsedAiForFinance: undefined` (expect the same explicit-selection issue) — and call `isCompleteParticipantProfile` matching the same six inputs.
- [ ] 3.2 Verify RED: `cd web && npm run typecheck` → FAIL (validator still expects legacy keys).
- [ ] 3.3 GREEN: In `web/lib/evaluation/profile.ts` add new option lists: `GENDER_OPTIONS`, `EDUCATION_LEVEL_OPTIONS`, `FINANCE_BACKGROUND_TYPE_OPTIONS` with Chinese labels matching the spec.
- [ ] 3.4 GREEN: In `web/lib/evaluation/profile.ts` update `AGE_RANGE_OPTIONS` to drop `under_20`.
- [ ] 3.5 GREEN: In `web/lib/evaluation/profile.ts` remove the legacy `FINANCE_LLM_USAGE_OPTIONS` export (and any callers).
- [ ] 3.6 GREEN: In `web/lib/evaluation/profile.ts` reduce `FINANCE_SUBDOMAIN_OPTIONS` from 9 to 7 — drop `derivatives` and `risk_management`; rename the label for `not_sure` to `"都不熟悉 / 沒接觸過"` and keep the value `not_sure`. Update the matching type literal in `types.ts`.
- [ ] 3.7 GREEN: Update `createParticipantProfileDraft` so it now returns `ParticipantProfileDraft` (not `ParticipantProfile`). Seed `gender = "prefer_not_to_say"`, `educationLevel = "prefer_not_to_say"`, `financeBackgroundType = "prefer_not_to_say"`. **Seed `hasUsedAiForFinance = null` (NOT `false`)** so an untouched control cannot silently persist as an explicit No. Remove draft entries for `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`. Keep `gradeOrOccupation` defaulting to empty string.
- [ ] 3.8 GREEN: Update `validateParticipantProfile` to accept `ParticipantProfileDraft` (i.e. `hasUsedAiForFinance: boolean | null`). It MUST (a) require `gender`, `educationLevel`, `financeBackgroundType` to be in their option sets (reject `prefer_not_to_say` only when the spec requires positive intent — in this change, `prefer_not_to_say` is a valid response so it passes), (b) require `hasUsedAiForFinance === true || hasUsedAiForFinance === false` and explicitly reject `null` / `undefined` with a "請選擇" issue, (c) NOT require `gradeOrOccupation`, (d) NOT require any of the removed legacy fields. Update `isCompleteParticipantProfile` so it narrows `ParticipantProfileDraft` → `ParticipantProfile` only when validation passes (with `hasUsedAiForFinance: boolean`).
- [ ] 3.9 Verify GREEN: `cd web && npm run typecheck` → ALL PASS.

## 4. Legacy profile read path (RED → GREEN)

- [ ] 4.1 RED: Add a `migrateLegacyProfile(raw: unknown): Partial<ParticipantProfile>` export in `web/lib/evaluation/profile.ts` (signature only, body throws) so step 2.1 compiles; in `profile-typecheck.ts` call it on a legacy object literal `{ ageRange: "25_29", isBusinessOrFinance: "yes", fieldOrWorkDomain: "資管系", hasTakenFinanceCourse: "yes", financeLlmUsage: "weekly", financeFamiliarity: 4 }` and assert (via type narrowing assignment) the result is `Partial<ParticipantProfile>` with no legacy keys.
- [ ] 4.2 Verify RED: `cd web && npm run typecheck` passes (signature exists) but body throws — record this as the failing precondition for the runtime script in 4.3.
- [ ] 4.3 RED: Create `web/scripts/verify-profile-validation.ts` — script that constructs a legacy profile, runs `migrateLegacyProfile`, then asserts the result (i) preserves compatible fields `ageRange`, `financeFamiliarity`, `financeWorkExperience`, `investmentExperience`, `llmExperience`, `financeSubdomains`, optional `gradeOrOccupation`, (ii) does NOT contain `fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`, (iii) does NOT pre-populate any new required field (`gender`, `educationLevel`, `financeBackgroundType`, `hasUsedAiForFinance`). The script prints `OK` on success or throws.
- [ ] 4.4 RED: Add `verify:profile` script in `web/package.json` mirroring the pattern of `verify:reset-pending`; add `web/scripts/verify-profile-validation.ts` to `web/scripts/verify-tsconfig.json` `include`.
- [ ] 4.5 Verify RED: `cd web && npm run verify:profile` → FAIL (helper throws).
- [ ] 4.6 GREEN: Implement `migrateLegacyProfile` body — accept `unknown`, return `Partial<ParticipantProfile>`. Whitelist compatible fields by reading them from the raw object; drop any field not on the whitelist; never invent new-field defaults; if `ageRange === "under_20"` map to `"prefer_not_to_say"`.
- [ ] 4.7 Verify GREEN: `cd web && npm run verify:profile` → prints `OK`.

## 5. Server storage & session API (RED → GREEN)

- [ ] 5.1 RED: Extend `web/scripts/verify-profile-validation.ts` to call the server-storage profile read helper (or its pure equivalent if not exported) against a JSON record that uses the legacy shape, then assert the returned in-memory profile object has the legacy keys stripped and the new required keys absent (forcing the form to re-prompt).
- [ ] 5.2 Verify RED: `cd web && npm run verify:profile` → FAIL.
- [ ] 5.3 GREEN: In `web/lib/server/evaluation-storage.ts` locate the path that reads a stored `ParticipantProfile`. Apply `migrateLegacyProfile` at the read boundary so server consumers see only the new shape (with legacy fields dropped). Do NOT mutate the underlying JSON file — already-saved evaluation records keep their original snapshot for audit.
- [ ] 5.4 GREEN: In `web/app/api/session/route.ts`, ensure profile write path uses `validateParticipantProfile`; reject writes that fail validation with the same error shape already used (400 with `issues[]`). Strip any unrecognized legacy keys silently before persisting.
- [ ] 5.5 Verify GREEN: `cd web && npm run verify:profile` → prints `OK`.
- [ ] 5.6 GREEN: Run `cd web && npm run typecheck` to surface any consumer of removed fields (admin code, exports, etc.); record each error path for the relevant task group below — do NOT fix here unless trivially internal to storage.
- [ ] 5.7 RED: Extend `web/scripts/verify-profile-validation.ts` to seed a store with both a legacy participant profile AND a pending question owned by that participant (with `participantProfile` holding the legacy snapshot). Then drive the profile-submit handler with a valid new-shape profile. Assert (a) the persisted profile is the new shape, (b) the participant's pending question entries are removed from storage, (c) a subsequent answer-generation request for the same question index would succeed (no 409 — assert by inspecting that the pending storage no longer contains an entry for that `(token, questionIndex)`).
- [ ] 5.8 Verify RED: `cd web && npm run verify:profile` → FAIL (no pending-clear logic exists).
- [ ] 5.9 GREEN: In `web/lib/server/evaluation-storage.ts` add `clearPendingQuestionsForParticipant(token: string): Promise<void>` (or sync equivalent matching surrounding style). It deletes every pending entry whose `participantToken === token`. In `web/app/api/session/route.ts` (or whichever route handles profile write), after a successful new-shape profile write detect whether the previous on-disk profile was the legacy shape (by re-reading the pre-write value) and, if so, call `clearPendingQuestionsForParticipant` before returning the response. Do NOT clear pending questions on a routine re-submit that does not represent a legacy → new-shape transition.
- [ ] 5.10 Verify GREEN: `cd web && npm run verify:profile` → prints `OK`.

## 6. Profile form UI

- [ ] 6.1 In `web/components/evaluation/profile-form.tsx`, remove the field/work-domain text input, business-or-finance radio group, finance-course radio group, and finance-LLM-usage 5-level select.
- [ ] 6.2 In `web/components/evaluation/profile-form.tsx`, mark the `gradeOrOccupation` input as optional (remove required attribute, soften the label, allow empty string).
- [ ] 6.3 In `web/components/evaluation/profile-form.tsx`, add the `gender` select rendered from `GENDER_OPTIONS` with a small helper note `(僅供樣本描述)`.
- [ ] 6.4 In `web/components/evaluation/profile-form.tsx`, add the `educationLevel` select rendered from `EDUCATION_LEVEL_OPTIONS`.
- [ ] 6.5 In `web/components/evaluation/profile-form.tsx`, add the `financeBackgroundType` select rendered from `FINANCE_BACKGROUND_TYPE_OPTIONS`.
- [ ] 6.6 In `web/components/evaluation/profile-form.tsx`, replace the 5-level finance-LLM-usage UI with a two-radio group bound to `hasUsedAiForFinance` (values `true` / `false`), labelled `「您是否曾用 AI / ChatGPT 處理金融、投資、財報、課業或工作相關問題？」`. **Neither radio may be pre-selected** — when the local draft has `hasUsedAiForFinance = null`, both radios render unchecked. Surface a "請選擇" validation message when submit is attempted with `null`. Do NOT use an HTML `checkbox` (a checkbox cannot represent the tri-state and a single checkbox defaults to unchecked-as-false which we explicitly forbid).
- [ ] 6.7 In `web/components/evaluation/profile-form.tsx`, update the local form-state shape and the submit payload to match the new `ParticipantProfile`.
- [ ] 6.8 Verify: `cd web && npm run typecheck && npm run lint` → ALL PASS.
- [ ] 6.9 Manual smoke (RED first then GREEN): `cd web && npm run dev`, open `http://localhost:3000/`, redeem an invite, confirm profile form renders all new fields, that empty `gradeOrOccupation` is accepted, that all required fields block submit until set, and that selecting `不願透露` for `gender` does not block submit. Document outcome in the commit message.

## 7. Study briefing copy

- [ ] 7.1 In `web/config/evaluation.config.json`, append one paragraph to `study.intro.paragraphs` reading verbatim: `「背景資料主要用於樣本描述與金融相關性檢核；主要分層變項預先指定為金融工作或實習經驗，金融熟悉度作為次要連續變項；其他人口統計與使用經驗欄位僅作探索性分析，不作為主要推論依據。」`. Place it after the existing privacy paragraph, before the investment-advice disclaimer paragraph.
- [ ] 7.2 Verify: `cd web && npm run dev`, open `/`, confirm the new paragraph renders in the briefing block before invite-code submit. Document outcome.

## 8. Admin participant table

- [ ] 8.1 In `web/app/admin/page.tsx` (or the participant-table component it imports), remove the `field/work domain` column and the legacy `finance-task LLM usage` column.
- [ ] 8.2 Add columns for `gender` (rendered via `formatProfileChoice(GENDER_OPTIONS, ...)`), `educationLevel`, `financeBackgroundType` (rendered as the Chinese label).
- [ ] 8.3 Render `hasUsedAiForFinance` as `Y` / `N` (or `是` / `否`).
- [ ] 8.4 Update the KPI bar finance-vs-non-finance derivation to read from `financeBackgroundType`: counts for finance-relevant = `student_finance_related ∪ working_finance_related`; non-finance = `student_other ∪ working_other`; refusal = `prefer_not_to_say`; unknown for legacy records that lack `financeBackgroundType`.
- [ ] 8.5 For any participant row whose stored profile lacks the new fields (legacy snapshot), render `-` in the new columns; do NOT crash.
- [ ] 8.6 Verify: `cd web && npm run typecheck && npm run lint` → PASS.
- [ ] 8.7 Manual smoke: open `/admin?token=<token>`, switch to `受測者` tab, confirm new columns appear, legacy records render `-` for new columns, KPI bar reports the new breakdown. Document outcome.

## 9. Admin record drawer

- [ ] 9.1 In `web/components/admin/record-drawer.tsx`, replace the legacy field references with the new fields (gender, education level, finance background type label, `hasUsedAiForFinance` Y/N).
- [ ] 9.2 For legacy snapshots that still carry `fieldOrWorkDomain` / `isBusinessOrFinance` / `hasTakenFinanceCourse` / `financeLlmUsage`, render those values inside a collapsed `legacy` section labelled `舊版欄位`; do not show them under the active profile section.
- [ ] 9.3 Verify: open `/admin` record list, click a row, confirm new fields render and legacy section appears only for legacy records. Document outcome.

## 10. CSV / JSON export

- [ ] 10.1 In `web/app/api/admin/export/route.ts` (or its CSV-building helper), remove emission of legacy columns (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`).
- [ ] 10.2 Add emission of new columns: `gender`, `educationLevel`, `financeBackgroundType`, `hasUsedAiForFinance` (CSV value `Y` / `N`).
- [ ] 10.3 Keep emission of all other existing columns (token, ageRange, gradeOrOccupation, financeWorkExperience, investmentExperience, financeFamiliarity, llmExperience, financeSubdomains, judgment fields, model IDs, settings metadata).
- [ ] 10.4 For legacy records that lack new fields, emit empty cells for the new active-profile columns (do NOT default to `prefer_not_to_say` — empty signals legacy).
- [ ] 10.4b Append four trailing CSV columns AFTER the active-profile columns: `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, `legacy_finance_llm_usage`. The four headers MUST always be present (deterministic schema). New-shape records emit empty strings. Legacy records emit their stored values verbatim (CSV-escape values per existing helper).
- [ ] 10.5 Update the JSON export: include the new active-profile fields under their canonical names; for legacy records also attach a nested `legacyProfile` object containing the four legacy fields (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`); for new-shape records do NOT include the `legacyProfile` block.
- [ ] 10.6 Verify: open `/admin?tab=原始資料`, trigger CSV export, inspect the CSV header row contains the four `legacy_*` columns, at least one new-shape row shows empty `legacy_*` cells, and if a legacy row exists in the store, that row shows the legacy values populated. Also trigger JSON export and confirm the `legacyProfile` nested block appears only on legacy records.

## 11. Final sweep

- [ ] 11.1 Run `cd web && npm run typecheck` → PASS with zero errors.
- [ ] 11.2 Run `cd web && npm run lint` → PASS with zero errors.
- [ ] 11.3 Run `cd web && npm run verify:profile` → prints `OK`.
- [ ] 11.4 Grep `web/` for `fieldOrWorkDomain|isBusinessOrFinance|hasTakenFinanceCourse|financeLlmUsage` (excluding `.next`, `node_modules`, archive specs). Expect references only inside `migrateLegacyProfile`, the CSV `legacy_*` column emitter, the JSON `legacyProfile` block emitter, the record-drawer legacy section, and any other explicit legacy-handling code path; remove any stragglers.
- [ ] 11.5 Run `cd web && npm run build` → PASS (catches dynamic route / metadata issues).
- [ ] 11.6 Manual end-to-end smoke (browser, on `npm run dev`):
  - Redeem invite as a fresh participant; fill new profile form with mixed selections; submit; ensure question 1 appears.
  - Refresh mid-questionnaire; ensure prefilled profile is preserved.
  - Simulate a legacy session by manually editing `.data/evaluation-store.json` to add a participant entry with `fieldOrWorkDomain: "資管系", isBusinessOrFinance: "yes"`, no new fields. Visit `/eval` with that session cookie; confirm the form re-prompts with compatible fields prefilled.
  - Open `/admin` as admin; confirm participant table, drawer, and CSV export all behave per spec.
- [ ] 11.7 Confirm the legacy `.data/evaluation-store.json` simulation is reverted before commit.
