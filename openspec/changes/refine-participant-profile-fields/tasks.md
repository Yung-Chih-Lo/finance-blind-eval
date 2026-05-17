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

- [x] 2.1 RED: Wrote `web/tests/profile-typecheck.ts` exercising new types + `migrateLegacyProfile` import.
- [x] 2.2 Verify RED: typecheck failed on 5 missing exports (Gender / EducationLevel / FinanceBackgroundType / ParticipantProfileDraft / migrateLegacyProfile) — see commit output.
- [x] 2.3 GREEN: Added Gender, EducationLevel, FinanceBackgroundType type unions to `types.ts`.
- [x] 2.4 GREEN: Removed `under_20` from AgeRange union.
- [x] 2.5 GREEN: Updated ParticipantProfile (gender/educationLevel/financeBackgroundType/hasUsedAiForFinance added; isBusinessOrFinance/hasTakenFinanceCourse/financeLlmUsage/fieldOrWorkDomain removed; gradeOrOccupation made optional). Added ParticipantProfileDraft type. Also reduced FinanceSubdomain literal union (rolled in from task 3.6 since both touch same file).
- [ ] 2.6 Verify GREEN: deferred until Rounds 2-5 land — cascade errors at consumer sites are expected until profile.ts / storage / form / admin / drawer / session-route / verify-reset-pending are updated.

## 3. Profile options & validation (RED → GREEN)

- [x] 3.1 RED: Extended `profile-typecheck.ts` with type-level checks for `validateParticipantProfile` accepting draft + `isCompleteParticipantProfile` narrowing. Runtime behavior assertions deferred to `verify-profile-validation.ts` (task 4.3).
- [x] 3.2 Verify RED: typecheck failed at imports of new types and `migrateLegacyProfile`; output captured in prior commit.
- [x] 3.3 GREEN: Added `GENDER_OPTIONS`, `EDUCATION_LEVEL_OPTIONS`, `FINANCE_BACKGROUND_TYPE_OPTIONS` to profile.ts.
- [x] 3.4 GREEN: Dropped `under_20` from `AGE_RANGE_OPTIONS`.
- [x] 3.5 GREEN: Removed `FINANCE_LLM_USAGE_OPTIONS` from profile.ts. Cascade fix at consumer sites pending Rounds 8 (admin/page) and 9 (record-drawer).
- [x] 3.6 GREEN: Reduced `FINANCE_SUBDOMAIN_OPTIONS` to 7 entries; relabelled `not_sure` to `都不熟悉 / 沒接觸過`. Type literal already updated in 2.5.
- [x] 3.7 GREEN: `createParticipantProfileDraft` returns `ParticipantProfileDraft`; seeds `hasUsedAiForFinance: null`, gender/education/background as `prefer_not_to_say`.
- [x] 3.8 GREEN: `validateParticipantProfile` accepts draft, rejects null/undefined `hasUsedAiForFinance` with explicit `"請選擇是否曾用 AI 處理金融問題"` issue; `isCompleteParticipantProfile` narrows draft → ParticipantProfile.
- [ ] 3.9 Verify GREEN: deferred — cascade still pending at profile-form/admin/drawer/storage.

## 4. Legacy profile read path (RED → GREEN)

- [x] 4.1 Bundled with 4.6: implemented `migrateLegacyProfile` body directly (signature + body in one step) since stub-then-body adds no value when the body is already small.
- [x] 4.2 Verify RED was implicitly executed in task 2.2 (typecheck failed on missing import); kept here for documentation.
- [x] 4.3 RED→GREEN: Wrote `web/scripts/verify-profile-validation.ts` covering all four runtime checks (migrate, validate, legacy read, clear pending).
- [x] 4.4 Added `verify:profile` script in `web/package.json`; added `verify-profile-validation.ts` + `lib/evaluation/profile.ts` to verify-tsconfig include.
- [x] 4.5 Verified RED: initial run failed on missing `clearPendingQuestionsForParticipant` export (typecheck error logged).
- [x] 4.6 GREEN: Implemented `migrateLegacyProfile` body in profile.ts — whitelists `token`, `knownName`, `ageRange` (with `under_20 → prefer_not_to_say` remap), `gradeOrOccupation`, `financeWorkExperience`, `investmentExperience`, `financeFamiliarity`, `llmExperience`, `financeSubdomains` (filtered against new 7-option set), `notes`. Legacy and new-required fields intentionally omitted. Also added `hasLegacyProfileFields` predicate and `extractLegacyProfileSnapshot` helper for export use (design D9).
- [x] 4.7 Verify GREEN: `npm run verify:profile` prints `OK` (all four runtime sections pass — see commit output).

## 5. Server storage & session API (RED → GREEN)

- [x] 5.1 Covered in `verify-profile-validation.ts` `testStorageBackwardCompatRead`.
- [x] 5.2 Verify RED: prior run failed without migrate-on-read.
- [x] 5.3 GREEN: `getParticipantStatus` / `getParticipantStatuses` / `getAdminSnapshot` now call `migrateParticipantStatus` which routes through `migrateLegacyProfile`. The underlying JSON file is not mutated — only the in-memory view is migrated.
- [ ] 5.4 Pending (Round 5b): `web/app/api/session/route.ts` rewrite to use `validateParticipantProfile` + strip legacy keys before persist + trigger pending-clear when legacy→new transition detected.
- [x] 5.5 Verify GREEN: `npm run verify:profile` PASS (storage read test green).
- [ ] 5.6 Pending: typecheck snapshot taken — remaining errors at session/route, profile-form, admin/page, record-drawer (each handled in its dedicated round).
- [x] 5.7 Covered in `testClearPendingOnLegacyResubmit`.
- [x] 5.8 Verify RED: prior run failed on missing `clearPendingQuestionsForParticipant` export.
- [x] 5.9 GREEN: Added `clearPendingQuestionsForParticipant(token)` to evaluation-storage.ts (mutex-protected, no-op if no entries match). Session-route call-site wiring still pending in 5.4.
- [x] 5.10 Verify GREEN: `npm run verify:profile` PASS.

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
- [x] 8.4 GREEN: `getAdminSnapshot` now derives 4 mutually-exclusive counts (`financeBackgroundCount` / `nonFinanceBackgroundCount` / `refusalBackgroundCount` / `unknownBackgroundCount`) from `financeBackgroundType`. `AdminSnapshot` type extended in `types.ts`. UI rendering still pending in 8.x.
- [ ] 8.5 For any participant row whose stored profile lacks the new fields (legacy snapshot), render `-` in the new columns; do NOT crash.
- [ ] 8.6 Verify: `cd web && npm run typecheck && npm run lint` → PASS.
- [ ] 8.7 Manual smoke: open `/admin?token=<token>`, switch to `受測者` tab, confirm new columns appear, legacy records render `-` for new columns, KPI bar reports the new breakdown. Document outcome.

## 9. Admin record drawer

- [ ] 9.1 In `web/components/admin/record-drawer.tsx`, replace the legacy field references with the new fields (gender, education level, finance background type label, `hasUsedAiForFinance` Y/N).
- [ ] 9.2 For legacy snapshots that still carry `fieldOrWorkDomain` / `isBusinessOrFinance` / `hasTakenFinanceCourse` / `financeLlmUsage`, render those values inside a collapsed `legacy` section labelled `舊版欄位`; do not show them under the active profile section.
- [ ] 9.3 Verify: open `/admin` record list, click a row, confirm new fields render and legacy section appears only for legacy records. Document outcome.

## 10. CSV / JSON export

- [x] 10.1 Removed legacy column emission from `buildExportCsv` (`field_or_work_domain` / `is_business_or_finance` / `has_taken_finance_course` / `finance_llm_usage`).
- [x] 10.2 Added new active-profile columns to CSV: `gender`, `education_level`, `finance_background_type`, `has_used_ai_for_finance` (Y / N).
- [x] 10.3 Other columns preserved (token, ageRange, gradeOrOccupation, financeWorkExperience, investmentExperience, financeFamiliarity, llmExperience, financeSubdomains, judgment fields, model IDs, settings metadata).
- [x] 10.4 Legacy records emit empty cells for new active-profile columns via `?? ""`.
- [x] 10.4b Appended four trailing `legacy_*` columns (always present in header; populated only when `extractLegacyProfileSnapshot` returns a snapshot).
- [x] 10.5 `buildExportJson` now attaches a nested `legacyProfile` block to legacy records (records + participants); new-shape records lack the block.
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
