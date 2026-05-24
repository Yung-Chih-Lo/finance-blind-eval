## File Plan

- **Modify**: `web/lib/evaluation/types.ts` — drop 5 enum types (`Gender`, `FinanceBackgroundType`, `FinanceWorkExperience`, `InvestmentExperience`, `FinanceSubdomain`); add `MainDomain` + `AiUsageFrequency`; tighten `AgeRange` (drop `prefer_not_to_say`) + `EducationLevel` (drop `prefer_not_to_say`); rewrite `ParticipantProfile` to 6 keys; rewrite `ParticipantProfileDraft`; replace `AdminSnapshot` bucket count fields (4 → 3)
- **Modify (rewrite ~50%)**: `web/lib/evaluation/profile.ts` — delete `migrateLegacyProfile` / `extractLegacyProfileSnapshot` / `LegacyProfileSnapshot` / `LEGACY_FIELDS`; rewrite option arrays for the 5 fields; rewrite `createParticipantProfileDraft` / `validateParticipantProfile` / `isCompleteParticipantProfile`; drop unused option arrays
- **Modify (rewrite full)**: `web/components/evaluation/profile-form.tsx` — 341 lines → ~140; only 5 fields, no legacy prefill, no `prefer_not_to_say`
- **Modify**: `web/app/api/session/route.ts` — drop `isLegacyShape` predicate + `wasLegacy` transition branch + `upsertParticipantStatusAndClearPending` call; rewrite `buildPersistedProfile` to project 6 keys
- **Modify**: `web/lib/server/evaluation-storage.ts` — drop `migrateParticipantProfile` + `migrateLegacyProfile`/`extractLegacyProfileSnapshot` imports; drop JSON `legacyProfile` attach paths; drop CSV 4 `legacy_*` trailing columns; rewrite active-profile CSV columns to 5 fields; rewrite admin snapshot bucket counting (4 → 3); drop `upsertParticipantStatusAndClearPending` export if no callsite remains
- **Modify**: `web/app/admin/page.tsx` — KPI bar 3 buckets; participant table column list; drawer drops legacy section
- **Modify (rewrite full)**: `web/scripts/verify-profile-validation.ts` — replace 11 legacy-focused test functions with new schema assertions
- **Delete**: `web/tests/profile-typecheck.ts` — all assertions target removed legacy machinery; new schema is covered by verify script + tsc
- **Wipe**: `web/.data/evaluation-store.json` — 15 test participants / 15 test records (zero real samples)

## 1. RED — rewrite verify-profile-validation.ts with new-schema assertions

- [x] 1.1 Open `web/scripts/verify-profile-validation.ts` and delete every test function tied to legacy: `testMigrateLegacyProfile`, `testStorageBackwardCompatRead`, `testClearPendingOnLegacyResubmit`, `testExtractLegacyHandlesNonString`, `testJsonExportMigratesAndAttachesLegacy`, `testCombinedUpsertClearsPending`, `testCsvLegacyRowEmitsEmptyForUndefined`, `testEducationOptionsExcludeHighSchool`, `buildLegacyProfile` helper
- [x] 1.2 Update imports in `verify-profile-validation.ts`: keep `createParticipantProfileDraft`, `isCompleteParticipantProfile`, `validateParticipantProfile`; drop `EDUCATION_LEVEL_OPTIONS` (or use only for option-list assertion), `extractLegacyProfileSnapshot`, `migrateLegacyProfile`; keep storage imports needed by new tests (`buildExportCsv`, `buildExportJson`, `resetEvaluationData`, `saveEvaluationRecord`, `upsertParticipantStatus`); drop `clearPendingQuestionsForParticipant`, `savePendingQuestion`, `getPendingQuestionsByParticipant`, `upsertParticipantStatusAndClearPending` if not used by new tests
- [x] 1.3 Add `testProfileShapeStrict()` — assert that the keys of a freshly built `ParticipantProfile` object are exactly `["token", "ageRange", "educationLevel", "mainDomain", "aiUsageFrequency", "hasUsedAiForFinance"]` (no extras, no missing)
- [x] 1.4 Add `testDraftSeedsNullForFiveRequiredFields()` — call `createParticipantProfileDraft("P-FRESH")` and assert `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, and `hasUsedAiForFinance` are all `null`; assert `validateParticipantProfile(draft)` returns 5 issues mentioning 年齡 / 學歷 / 目前主要領域 / AI 使用頻率 / 是否曾用 AI 處理金融
- [x] 1.5 Add `testNewEnumValuesOnly()` — assert `AGE_RANGE_OPTIONS` value list equals `["20_24","25_29","30_39","40_plus"]`, `EDUCATION_LEVEL_OPTIONS` equals `["undergrad_in_progress","undergrad_completed","grad_or_above"]`, `MAIN_DOMAIN_OPTIONS` equals `["finance_related","business_non_finance","other"]`, `AI_USAGE_FREQUENCY_OPTIONS` equals `["never","occasional","frequent","daily"]`; assert no option contains `prefer_not_to_say`
- [x] 1.6 Add `testRejectsOldEnumLiterals()` — call `validateParticipantProfile` with a draft containing legacy literal values (`gender: "female"`, `financeBackgroundType: "student_finance_related"`, `llmExperience: "weekly"`, `ageRange: "prefer_not_to_say"`, `educationLevel: "high_school_or_below"`) and assert each old value is rejected (validation issues present)
- [x] 1.7 Add `testCsvHeaderHasOnlyFiveActiveFields()` — call `resetEvaluationData()` + `buildExportCsv()`, split header line by comma, assert it contains `token`, `age_range`, `education_level`, `main_domain`, `ai_usage_frequency`, `has_used_ai_for_finance`; assert it does NOT contain any of `gender`, `grade_or_occupation`, `finance_work_experience`, `investment_experience`, `finance_familiarity`, `finance_subdomains`, `notes`, `known_name`, `llm_experience`, `finance_background_type`, `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, `legacy_finance_llm_usage`
- [x] 1.8 Add `testJsonExportHasNoLegacyBlock()` — call `resetEvaluationData()`, seed one new-shape `EvaluationRecord` via `saveEvaluationRecord`, call `buildExportJson()`, parse JSON, assert no record contains a `legacyProfile` key and each `participantProfile` object has exactly the 6 expected keys; assert no participant entry contains a `legacyProfile` key
- [x] 1.9 Add `testStorageRoundtripPreservesFiveFieldShape()` — call `resetEvaluationData()`, `upsertParticipantStatus` with a new-shape `ParticipantProfile`, then `getParticipantStatus`; assert returned `profile` keys are exactly the 6 expected ones with values equal to what was written (no migration mutation)
- [x] 1.10 Verify RED: run `cd web && npm run verify:profile` and post the output. Expected failure: TypeScript compile error because `MainDomain`, `AiUsageFrequency`, `MAIN_DOMAIN_OPTIONS`, `AI_USAGE_FREQUENCY_OPTIONS` are not yet defined in `types.ts` / `profile.ts`. This is the RED proof.

## 2. GREEN: types.ts — replace ParticipantProfile shape and enums

- [x] 2.1 In `web/lib/evaluation/types.ts`, redefine `AgeRange` to the 4-value union `"20_24" | "25_29" | "30_39" | "40_plus"` (drop `prefer_not_to_say`)
- [x] 2.2 Redefine `EducationLevel` to the 3-value union `"undergrad_in_progress" | "undergrad_completed" | "grad_or_above"` (drop `prefer_not_to_say`)
- [x] 2.3 Add `export type MainDomain = "finance_related" | "business_non_finance" | "other"`
- [x] 2.4 Add `export type AiUsageFrequency = "never" | "occasional" | "frequent" | "daily"`
- [x] 2.5 Delete the 5 unused enum exports: `Gender`, `FinanceBackgroundType`, `FinanceWorkExperience`, `InvestmentExperience`, `FinanceSubdomain`
- [x] 2.6 Rewrite `ParticipantProfile` interface to exactly 6 keys: `token: string`, `ageRange: AgeRange`, `educationLevel: EducationLevel`, `mainDomain: MainDomain`, `aiUsageFrequency: AiUsageFrequency`, `hasUsedAiForFinance: boolean`
- [x] 2.7 Rewrite `ParticipantProfileDraft` to the same 6 keys but with `ageRange | null`, `educationLevel | null`, `mainDomain | null`, `aiUsageFrequency | null`, `hasUsedAiForFinance: boolean | null` — token stays non-null; delete the old `Omit + intersection` shape
- [x] 2.8 In `AdminSnapshot`, replace `financeBackgroundCount`, `nonFinanceBackgroundCount`, `refusalBackgroundCount`, `unknownBackgroundCount` with `financeRelatedCount: number`, `businessNonFinanceCount: number`, `otherCount: number`; update the inline comment to reference `mainDomain` instead of `financeBackgroundType`

## 3. GREEN: profile.ts — rewrite validation + option arrays, drop legacy

- [x] 3.1 In `web/lib/evaluation/profile.ts`, delete `extractLegacyProfileSnapshot`, `LegacyProfileSnapshot` type export, `LEGACY_FIELDS` constant, `migrateLegacyProfile` function
- [x] 3.2 Delete unused option exports: `GENDER_OPTIONS`, `FINANCE_BACKGROUND_TYPE_OPTIONS`, `FINANCE_WORK_EXPERIENCE_OPTIONS`, `INVESTMENT_EXPERIENCE_OPTIONS`, `FINANCE_SUBDOMAIN_OPTIONS`; delete matching `*_VALUES` Set constants
- [x] 3.3 Rewrite `AGE_RANGE_OPTIONS` to 4 entries (drop `prefer_not_to_say`): `20-24 歲`, `25-29 歲`, `30-39 歲`, `40 歲以上`
- [x] 3.4 Rewrite `EDUCATION_LEVEL_OPTIONS` to 3 entries (drop `prefer_not_to_say`): `大學在學`, `大學畢業`, `研究所在學或以上`
- [x] 3.5 Add `MAIN_DOMAIN_OPTIONS: Array<{ value: MainDomain; label: string }>` with: `finance_related → "財經類學系或工作（金融/財管/經濟/會計/保險）"`, `business_non_finance → "商學或管理類但非財經（企管/資管/行銷/統計/國貿）"`, `other → "其他領域（文/理/工/法/社科/藝術等）"`
- [x] 3.6 Add `AI_USAGE_FREQUENCY_OPTIONS: Array<{ value: AiUsageFrequency; label: string }>` with: `never → "從未"`, `occasional → "偶爾（每月幾次以下）"`, `frequent → "經常（每週幾次）"`, `daily → "每天"`
- [x] 3.7 Rewrite `createParticipantProfileDraft(token, initialProfile?)` to construct a draft with `token`, and `ageRange / educationLevel / mainDomain / aiUsageFrequency / hasUsedAiForFinance` all `null` (or carry through `initialProfile` value if it passes the matching `hasChoice` set check); delete `knownName`, `gradeOrOccupation`, `financeWorkExperience`, `investmentExperience`, `financeFamiliarity`, `financeSubdomains`, `notes` from the draft
- [x] 3.8 Rewrite `validateParticipantProfile(profile)` to issue 5 Chinese-language errors when any of `ageRange / educationLevel / mainDomain / aiUsageFrequency` is null or off-list, and to reject `hasUsedAiForFinance` when not strictly `true` or `false`; delete all 8 legacy-field validation branches
- [x] 3.9 Rewrite `isCompleteParticipantProfile` as `(draft) => validateParticipantProfile(draft).length === 0` keeping the type-predicate return so the narrowed type is `ParticipantProfile`
- [x] 3.10 Keep `formatProfileChoice` (still used by admin display for select-option labels) but verify imports are clean
- [x] 3.11 Update the `LLM_EXPERIENCE_VALUES` set (used by `hasChoice` for `llmExperience`) to instead validate `aiUsageFrequency` against the new 4-value set `AI_USAGE_FREQUENCY_VALUES`
- [x] 3.12 Run `cd web && npm run typecheck` and post the output — expect compile errors across `profile-form.tsx`, `session/route.ts`, `evaluation-storage.ts`, `admin/page.tsx` (which is the next 4 task groups)

## 4. GREEN: profile-form.tsx — rewrite as 5-field form

- [x] 4.1 In `web/components/evaluation/profile-form.tsx`, replace the entire imports block: drop `GENDER_OPTIONS`, `FINANCE_BACKGROUND_TYPE_OPTIONS`, `FINANCE_SUBDOMAIN_OPTIONS`, `FINANCE_WORK_EXPERIENCE_OPTIONS`, `INVESTMENT_EXPERIENCE_OPTIONS`; add `MAIN_DOMAIN_OPTIONS`, `AI_USAGE_FREQUENCY_OPTIONS`; drop `ScaleInput` import; drop `FinanceSubdomain` type import
- [x] 4.2 Delete the `toggleSubdomain` helper and the multi-checkbox `financeSubdomains` fieldset
- [x] 4.3 Rewrite the `submitProfile` function body to drop `gradeOrOccupation.trim()` and `notes.trim()` projections — the new draft has no string fields needing trim
- [x] 4.4 Rewrite the JSX form body with 5 `<label>` blocks, each a `<select>`: 年齡 / 學歷 / 目前主要領域 / AI 使用頻率 / 是否曾用 AI 工具處理金融問題?; each select binds to its draft field and `setProfile` updates the `null`-or-value form-state
- [x] 4.5 Use the participant-facing Chinese label for the AI-for-finance field including the scope phrase: `是否曾用 AI 工具處理金融問題？（曾用 ChatGPT、Claude、Gemini 等 AI 工具，查詢、討論或解答金融、投資、財務、會計、總經相關問題）`
- [x] 4.6 Drop the `<fieldset>` grouping legends (`基本分層 / 金融背景與經驗 / AI 使用經驗`) — with only 5 fields, group them under one fieldset (`<legend>背景資料</legend>`) or omit grouping entirely
- [x] 4.7 Update the submit button text to `開始 5 題盲測問卷` if not already (verify; per 2A it should already be the case)
- [x] 4.8 Verify: `cd web && npm run typecheck` for `profile-form.tsx` — expect form.tsx clean; remaining errors should be in storage/admin/session

## 5. GREEN: session/route.ts — drop legacy branch

- [x] 5.1 In `web/app/api/session/route.ts`, delete the `isLegacyShape` function (lines ~52-60)
- [x] 5.2 Delete the `wasLegacy` declaration + the `validatedProfile && wasLegacy` conditional that calls `upsertParticipantStatusAndClearPending`; replace with a plain `await upsertParticipantStatus(status)` call
- [x] 5.3 Rewrite `buildPersistedProfile(token, raw, existingKnownName?)` to project only the 6 new keys; delete the `grade`/`knownName`/`gradeOrOccupation`/`notes` handling and the `existingKnownName` parameter; rename to `buildPersistedProfile(token, raw)`
- [x] 5.4 Delete the unused `SEEDED_PARTICIPANTS` import (used only by old `knownName` fallback)
- [x] 5.5 Delete the `upsertParticipantStatusAndClearPending` import (no callsite remains)
- [x] 5.6 Verify: `cd web && npm run typecheck` for `session/route.ts` — expect this file clean; remaining errors should be in storage/admin

## 6. GREEN: evaluation-storage.ts — drop legacy paths, rewrite snapshot + CSV

- [ ] 6.1 In `web/lib/server/evaluation-storage.ts`, delete the `extractLegacyProfileSnapshot` and `migrateLegacyProfile` imports (line ~8)
- [ ] 6.2 Delete the `migrateParticipantProfile` function (lines ~211-219) and every callsite (search for `migrateParticipantProfile(`); the helper applied legacy stripping on read which no longer exists
- [ ] 6.3 In the function that builds per-participant read results (`getParticipantStatus` etc., line ~222), remove the `migrateParticipantProfile(status.profile)` call and return the raw status profile
- [ ] 6.4 In `buildExportJson`, delete the records-loop legacy-attach path: replace `extractLegacyProfileSnapshot(record.participantProfile)` + `migrateLegacyProfile(record.participantProfile)` + conditional `{ ...record, participantProfile: migrated, legacyProfile }` with a plain `{ ...record }` return (the profile snapshot is already in the new shape)
- [ ] 6.5 In `buildExportJson`, delete the participants-loop legacy-attach path with the same simplification: return `{ ...participant }` with no `legacyProfile`
- [ ] 6.6 In `buildExportCsv` row construction (line ~660-680), drop the `legacy = extractLegacyProfileSnapshot(record.participantProfile)` line and replace the active-profile column block with the 6-field set: `token`, `age_range`, `education_level`, `main_domain`, `ai_usage_frequency`, `has_used_ai_for_finance` (`Y` / `N` / empty); delete `gender`, `grade_or_occupation`, `finance_work_experience`, `investment_experience`, `finance_familiarity`, `finance_subdomains`, `llm_experience` from the row record
- [ ] 6.7 In `buildExportCsv` trailing columns block (line ~725-731), delete the 4 `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, `legacy_finance_llm_usage` entries entirely
- [ ] 6.8 Update the CSV header construction to match — delete the 4 `legacy_*` column header strings + the 7 dropped active-profile column header strings
- [ ] 6.9 In the admin snapshot bucket-counting block (line ~575-618), rewrite to count `mainDomain` directly: `financeRelatedCount += profile?.mainDomain === "finance_related" ? 1 : 0` (and same for `business_non_finance`, `other`); delete the 4-bucket switch with the `prefer_not_to_say` + unknown branches; the returned snapshot field names update to match `AdminSnapshot` from task 2.8
- [ ] 6.10 Delete the `upsertParticipantStatusAndClearPending` export and its implementation entirely (only callsite was the deleted `wasLegacy` branch in `session/route.ts`)
- [ ] 6.11 Verify: `cd web && npm run typecheck` — expect storage clean; remaining errors should be in `admin/page.tsx`

## 7. GREEN: admin/page.tsx — KPI bar + participant table + drawer

- [ ] 7.1 In `web/app/admin/page.tsx`, locate the KPI bar value-template line (≈339) that reads `${snapshot.financeBackgroundCount} / ${snapshot.nonFinanceBackgroundCount} / ${snapshot.refusalBackgroundCount} / ${snapshot.unknownBackgroundCount}`; replace with `${snapshot.financeRelatedCount} / ${snapshot.businessNonFinanceCount} / ${snapshot.otherCount}`
- [ ] 7.2 Update the KPI bar label/caption that names the buckets — search for the Chinese label string (likely `財經 / 非財經 / 不願透露 / 未填` or similar) and replace with `財經類 / 商學非財經 / 其他`
- [ ] 7.3 In the `受測者` tab participant table, drop columns: `gender`, `educationLevel` rename to label-based display, `financeBackgroundType` rename to `mainDomain`-based label display, `financeFamiliarity`, `hasUsedAiForFinance` keep as Y/N; ensure the final column order is Token / 年齡 / 學歷 / 目前主要領域 / AI 使用頻率 / 曾用 AI 處理金融? / 完成狀態 / 已答/總題數
- [ ] 7.4 Update column header labels to match the new fields in Chinese: `Token`, `年齡`, `學歷`, `目前主要領域`, `AI 使用頻率`, `曾用 AI 處理金融?`, `完成狀態`, `已答/總題數`
- [ ] 7.5 In the record drawer rendering block, drop the legacy section (any block that conditionally renders fields prefixed with `legacy` or that displays the 4 removed legacy fields); also drop display of `gender`, `gradeOrOccupation`, `financeFamiliarity`, `financeWorkExperience`, `investmentExperience`, `financeSubdomains`, `notes`, `knownName` if any remain
- [ ] 7.6 Update the drawer profile-section labels to show only the 5 new fields with `formatProfileChoice(MAIN_DOMAIN_OPTIONS, profile.mainDomain)` etc.
- [ ] 7.7 Verify: `cd web && npm run typecheck` — expect clean across the whole web/ tree

## 8. Cleanup — delete obsolete file, wipe data store

- [ ] 8.1 Delete `web/tests/profile-typecheck.ts` (every type assertion in it references the removed legacy machinery — `migrateLegacyProfile`, removed `Gender`/`FinanceBackgroundType`/`FinanceWorkExperience`/`InvestmentExperience`/`FinanceSubdomain` enums)
- [ ] 8.2 Overwrite `web/.data/evaluation-store.json` with `{"participants":[],"sessions":[],"pendingQuestions":[],"records":[]}` (empty shape); the production deploy step also requires a Zeabur volume wipe (tracked in section 10)
- [ ] 8.3 Verify: `cd web && npm run typecheck` — must be clean (the deleted file should leave no orphan import)

## 9. Verify GREEN — full test + lint + build

- [ ] 9.1 Run `cd web && npm run verify:profile` and post output — must show every new-schema assertion PASS and total `OK`
- [ ] 9.2 Run `cd web && npm run verify:provider-url` — must PASS (orthogonal capability; regression guard)
- [ ] 9.3 Run `cd web && npm run verify:reset-pending` — must PASS (still touches pending storage which this change modified)
- [ ] 9.4 Run `cd web && npm run verify:intro-copy` — must PASS (2A capability; regression guard)
- [ ] 9.5 Run `cd web && npm run verify:system-prompt` — must PASS (2A capability; regression guard)
- [ ] 9.6 Run `cd web && npm run verify:completion-gate` — must PASS (2A capability; regression guard)
- [ ] 9.7 Run `cd web && npm run lint` — must be clean
- [ ] 9.8 Run `cd web && npm run typecheck` — must be clean
- [ ] 9.9 Run `cd web && npm run build` — must complete without errors; capture last 30 lines of output

## 10. Deferred to deployment (bundled with 2A's 5.5-5.8)

- [ ] 10.1 (deferred to deploy) `cd web && npx zeabur@latest deploy --project-id 69b00f05d00471cc19a0b524 --service-id 6a06c9fdeb6e67d8262aba62 --json`
- [ ] 10.2 (deferred to deploy) On Zeabur volume `/src/.data`, delete `evaluation-store.json` (or write empty-shape JSON) so the new code starts with a clean store; leave `platform-settings.json` untouched so 2A's intro copy + system prompt remain effective
- [ ] 10.3 (deferred to deploy) Open `/admin` on the live URL; if a banner about settings format incompatibility appears, hit `POST /api/admin/settings/reset` to drop legacy keys (carried over from 2A deploy notes)
- [ ] 10.4 (deferred to deploy) Browser smoke-test: redeem invite → 5-field background form renders with only 5 fields and no `prefer_not_to_say` options → submit → reach question 1 of 5 → answer all 5 → reach completion screen (also validates 2A's 5-question gate end-to-end)
- [ ] 10.5 (deferred to deploy) Browser smoke-test: ask one non-finance question (e.g. `今天台北天氣`) and confirm the system prompt enforces 2A's finance-brain refusal
