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
- [x] 2.6 Verify GREEN: `npm run typecheck` PASSES at Round 11 final sweep — all cascade sites updated.

## 3. Profile options & validation (RED → GREEN)

- [x] 3.1 RED: Extended `profile-typecheck.ts` with type-level checks for `validateParticipantProfile` accepting draft + `isCompleteParticipantProfile` narrowing. Runtime behavior assertions deferred to `verify-profile-validation.ts` (task 4.3).
- [x] 3.2 Verify RED: typecheck failed at imports of new types and `migrateLegacyProfile`; output captured in prior commit.
- [x] 3.3 GREEN: Added `GENDER_OPTIONS`, `EDUCATION_LEVEL_OPTIONS`, `FINANCE_BACKGROUND_TYPE_OPTIONS` to profile.ts.
- [x] 3.4 GREEN: Dropped `under_20` from `AGE_RANGE_OPTIONS`.
- [x] 3.5 GREEN: Removed `FINANCE_LLM_USAGE_OPTIONS` from profile.ts. Cascade fix at consumer sites pending Rounds 8 (admin/page) and 9 (record-drawer).
- [x] 3.6 GREEN: Reduced `FINANCE_SUBDOMAIN_OPTIONS` to 7 entries; relabelled `not_sure` to `都不熟悉 / 沒接觸過`. Type literal already updated in 2.5.
- [x] 3.7 GREEN: `createParticipantProfileDraft` returns `ParticipantProfileDraft`; seeds `hasUsedAiForFinance: null`, gender/education/background as `prefer_not_to_say`.
- [x] 3.8 GREEN: `validateParticipantProfile` accepts draft, rejects null/undefined `hasUsedAiForFinance` with explicit `"請選擇是否曾用 AI 處理金融問題"` issue; `isCompleteParticipantProfile` narrows draft → ParticipantProfile.
- [x] 3.9 Verify GREEN at Round 11 final sweep.

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
- [x] 5.4 GREEN: `session/route.ts` validates via `validateParticipantProfile`, projects to new shape via `buildPersistedProfile` (silently drops any legacy keys client might send), and calls `clearPendingQuestionsForParticipant` only when `isLegacyShape(existing.profile)` is true (legacy → new transition).
- [x] 5.5 Verify GREEN: `npm run verify:profile` PASS (storage read test green).
- [x] 5.6 GREEN at Round 11 final sweep — all consumer-site cascade errors fixed.
- [x] 5.7 Covered in `testClearPendingOnLegacyResubmit`.
- [x] 5.8 Verify RED: prior run failed on missing `clearPendingQuestionsForParticipant` export.
- [x] 5.9 GREEN: Added `clearPendingQuestionsForParticipant(token)` to evaluation-storage.ts (mutex-protected, no-op if no entries match). Session-route call-site wiring still pending in 5.4.
- [x] 5.10 Verify GREEN: `npm run verify:profile` PASS.

## 6. Profile form UI

- [x] 6.1 Removed legacy field inputs (fieldOrWorkDomain text, isBusinessOrFinance select, hasTakenFinanceCourse select, financeLlmUsage 5-level select).
- [x] 6.2 `gradeOrOccupation` label became `年級或職稱（選填）`, no required attribute, blank submit allowed.
- [x] 6.3 Added gender select with helper text `僅供樣本描述，不會作為個別偏好推論依據。`
- [x] 6.4 Added `最高學歷` select.
- [x] 6.5 Added `金融背景類型` select.
- [x] 6.6 Two-radio group for `hasUsedAiForFinance` — neither preselected, validation via `validateParticipantProfile` returns "請選擇是否曾用 AI 處理金融問題" when value is null.
- [x] 6.7 Local state is `ParticipantProfileDraft`; submit projects `hasUsedAiForFinance: draft.hasUsedAiForFinance === true` after validation.
- [x] 6.8 Verify GREEN at Round 11 — typecheck + lint both clean.
- [ ] 6.9 Manual smoke deferred to Round 11 final sweep.

## 7. Study briefing copy

- [x] 7.1 GREEN: Appended analysis-framing paragraph to `study.intro.paragraphs` between the privacy paragraph and the investment-advice disclaimer.
- [ ] 7.2 Manual smoke deferred to Round 11 final sweep.

## 8. Admin participant table

- [x] 8.1 Removed `領域` / `背景` (isBusinessOrFinance) / `金融 AI 使用` (5-level) columns from participant table.
- [x] 8.2 Added `性別` / `學歷` / `金融背景` columns rendered with `formatProfileChoice`.
- [x] 8.3 `曾用 AI 處理金融` column renders `Y` / `N` / `-` (for legacy null).
- [x] 8.4 GREEN: `getAdminSnapshot` now derives 4 mutually-exclusive counts (`financeBackgroundCount` / `nonFinanceBackgroundCount` / `refusalBackgroundCount` / `unknownBackgroundCount`) from `financeBackgroundType`. `AdminSnapshot` type extended in `types.ts`. UI rendering still pending in 8.x.
- [x] 8.5 `formatProfileChoice` returns `-` when value is undefined; `hasUsedAiForFinance` rendered as `-` for non-boolean values; legacy rows render gracefully.
- [x] 8.6 Verify GREEN at Round 11.
- [ ] 8.7 Manual smoke deferred to Round 11.

## 9. Admin record drawer

- [x] 9.1 GREEN: Drawer now renders gender / age / education / financeBackgroundType / gradeOrOccupation / financeWorkExperience / investmentExperience / hasUsedAiForFinance (Y/N/—) / subdomains.
- [x] 9.2 GREEN: Added `舊版欄位 (legacy)` section that renders only when `extractLegacyProfileSnapshot(record.participantProfile)` returns a non-empty snapshot; each visible legacy field has a `legacy.` prefix in its `<dt>`.
- [ ] 9.3 Manual smoke deferred to Round 11.

## 10. CSV / JSON export

- [x] 10.1 Removed legacy column emission from `buildExportCsv` (`field_or_work_domain` / `is_business_or_finance` / `has_taken_finance_course` / `finance_llm_usage`).
- [x] 10.2 Added new active-profile columns to CSV: `gender`, `education_level`, `finance_background_type`, `has_used_ai_for_finance` (Y / N).
- [x] 10.3 Other columns preserved (token, ageRange, gradeOrOccupation, financeWorkExperience, investmentExperience, financeFamiliarity, llmExperience, financeSubdomains, judgment fields, model IDs, settings metadata).
- [x] 10.4 Legacy records emit empty cells for new active-profile columns via `?? ""`.
- [x] 10.4b Appended four trailing `legacy_*` columns (always present in header; populated only when `extractLegacyProfileSnapshot` returns a snapshot).
- [x] 10.5 `buildExportJson` now attaches a nested `legacyProfile` block to legacy records (records + participants); new-shape records lack the block.
- [ ] 10.6 Verify: open `/admin?tab=原始資料`, trigger CSV export, inspect the CSV header row contains the four `legacy_*` columns, at least one new-shape row shows empty `legacy_*` cells, and if a legacy row exists in the store, that row shows the legacy values populated. Also trigger JSON export and confirm the `legacyProfile` nested block appears only on legacy records.

## 11. Final sweep

- [x] 11.1 `npm run typecheck` → PASS, zero errors.
- [x] 11.2 `npm run lint` → PASS, zero errors.
- [x] 11.3 `npm run verify:profile` → prints `OK` (all four runtime sections).
- [x] 11.4 Grep audit: 40 occurrences total, all in expected legacy-handling paths (LEGACY_FIELDS definition + migrate + extract in profile.ts; legacy_* CSV columns in storage; legacy section in record-drawer; test fixtures in verify-profile-validation + profile-typecheck; comment in session/route). No stragglers.
- [x] 11.5 `npm run build` → PASS (17 static pages generated, no route/metadata errors).
- [ ] 11.6 Manual end-to-end smoke remains — recommended to run before `/opsxp-archive`. Automated coverage already validates: validate-rejects-null hasUsedAi, legacy migrate-on-read, clearPendingQuestionsForParticipant, legacy_* CSV emission paths (via verify-profile-validation). The remaining smoke is purely UI-visual confirmation.
- [ ] 11.7 No legacy `.data/evaluation-store.json` simulation was created during apply — verify scripts use OS tmp dirs.

## 12. Verify-driven follow-up (`/opsxp-verify` 2026-05-17)

Multi-perspective verify surfaced four CRITICAL + several WARNING issues. Fixes:

- [x] 12.1 Anti-silent-default for all required pick-one fields. `ParticipantProfileDraft` now allows `null` for `gender / educationLevel / financeBackgroundType / financeWorkExperience / investmentExperience` in addition to `hasUsedAiForFinance`. `createParticipantProfileDraft` seeds these as `null`; profile-form selects render a `disabled` "請選擇" placeholder option. `validateParticipantProfile` already rejected non-option values, so the existing checks cover the new null sentinels. Protects the primary stratifier `financeWorkExperience` (D2) from silent contamination.
- [x] 12.2 `buildExportJson` now migrates `record.participantProfile` and `participant.profile` before serialization, so the active profile block in JSON export no longer leaks legacy keys. The nested `legacyProfile` block is attached only when `extractLegacyProfileSnapshot` returns non-empty. Regression: `testJsonExportMigratesAndAttachesLegacy`.
- [x] 12.3 `extractLegacyProfileSnapshot` coerces non-string legacy values via `String()` (was silently dropping booleans/numbers persisted by older serialization). Regression: `testExtractLegacyHandlesNonString`.
- [x] 12.4 Deleted dead exports `hasLegacyProfileFields` and `LegacyProfileField`. `LegacyProfileSnapshot` interface derived from `LEGACY_FIELDS` via mapped type so the two cannot drift.
- [x] 12.5 Atomic combined helper `upsertParticipantStatusAndClearPending` closes the race window in session-route (upsert + pending-clear now share one `withStoreMutex`). Standalone `clearPendingQuestionsForParticipant` retained for direct testing. Regression: `testCombinedUpsertClearsPending`.
- [x] 12.6 `migrateLegacyProfile` now PRESERVES new required fields when they're already in storage (previously stripped them, which would have caused `isLegacyShape` to clear pending on every routine re-submit by new-shape participants). Bug surfaced by `testCombinedUpsertClearsPending` during apply. Design D6 updated.
- [x] 12.7 Session route uses `isCompleteParticipantProfile` type predicate to narrow `ParticipantProfileDraft → ParticipantProfile` instead of `as ParticipantProfile` cast — `buildPersistedProfile` now reads a guaranteed-complete profile.
- [x] 12.8 `getAdminSnapshot` finance-background bucket counting replaced with `switch (bg)` + `never` exhaustiveness check — adding a new `FinanceBackgroundType` arm without updating the switch becomes a compile error.
- [x] 12.9 Removed duplicate methodology paragraph from `profile-form.tsx` (kept the canonical copy in `study.intro.paragraphs`). Removed misleading "Step 1 / 6" pill (questionnaire is 5 questions, not 6). Replaced ambiguous comment in `buildExportCsv` about migration ordering.
- [x] 12.10 Verify: `npm run typecheck` PASS, `npm run lint` PASS, `npm run verify:profile` 8/8 PASS, `npm run verify:reset-pending` 4/4 PASS, `npm run build` PASS, `openspec validate --strict` PASS.
