## Why

The Notion thesis methodology report (`問卷方法設計報告：受試者、提示與分析規劃`, 2026-05-17) reframes the study's participant-background design: the questionnaire is for a *relative preference* study among finance-literate users, not a general-population survey, and background fields must defend sample qualification and enable exploratory stratification at N=30-40 rather than confirmatory subgroup testing. The current `ParticipantProfile` has two near-duplicate background questions (`fieldOrWorkDomain` free text + `isBusinessOrFinance` binary) that are hard to stratify on, asks finance-LLM usage at 5-level granularity that the small sample cannot support, includes an `under_20` age bucket that introduces minor-research ethics risk, and lacks `gender` and `educationLevel` fields that the advisor will expect for sample description.

## What Changes

- **BREAKING** Remove `fieldOrWorkDomain` (free text) and `isBusinessOrFinance` (binary) from `ParticipantProfile`; replace both with a single structured `financeBackgroundType` enum (4 categories + 不願透露).
- Add required `gender` field (女 / 男 / 非二元或其他 / 不願透露; sample-description only, no subgroup inference).
- Add required `educationLevel` field (高中或以下 / 大學在學 / 大學畢業 / 研究所在學或以上 / 不願透露).
- Modify `ageRange`: drop `under_20`; final values `20_24 / 25_29 / 30_39 / 40_plus / prefer_not_to_say`.
- Demote `gradeOrOccupation` from required free text to **optional** free text (질性 sample-description補充).
- Downgrade `financeLlmUsage` from 5-level enum to a Y/N flag (`hasUsedAiForFinance: boolean`), eliminating sparse cells.
- Remove `hasTakenFinanceCourse` (its information is absorbed by `financeBackgroundType` + `financeWorkExperience` + `financeFamiliarity`).
- Reduce `financeSubdomains` options from 9 → 7 (drop `derivatives` and `risk_management`; rename `not_sure` label to「都不熟悉 / 沒接觸過」).
- Add a study briefing paragraph to `study.intro.paragraphs` (or new field) stating that background data is primarily for sample description and finance-relevance gating, with stratification declared as exploratory and `financeWorkExperience` pre-registered as primary stratifier, `financeFamiliarity` as secondary.
- Migrate persisted sessions: legacy profiles missing the new required fields fall back through the existing "incomplete profile returns to form with prefill" scenario (already in spec).
- When a legacy-shape participant successfully resubmits a new-shape profile, the server SHALL remove all pending question entries owned by that participant token to prevent stale `participantProfile` snapshots from leaking into saved records and to prevent 409 deadlock on subsequent generation.
- Admin CSV export SHALL append four `legacy_*` columns (`legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, `legacy_finance_llm_usage`) so legacy completed records remain identifiable for the cohort; new-shape records emit empty values in those columns. JSON export attaches a nested `legacyProfile` block to legacy records only.
- Update admin records UI and CSV/JSON export to show/emit the new fields, drop removed fields from the active-profile columns, and preserve legacy profile data via the trailing `legacy_*` columns.

## Capabilities

### Modified Capabilities
- `blind-evaluation-app`: change `Participant background form`, `Evaluation record storage`, `Data export`, `Admin evaluation dashboard`, and `Configurable study content` requirements to reflect the new profile schema, the briefing copy addition, and admin/export field changes.

## Impact

- `web/lib/evaluation/types.ts` — `ParticipantProfile`, `AgeRange`, new `Gender`, `EducationLevel`, `FinanceBackgroundType` types; remove `IsBusinessOrFinance`, `HasTakenFinanceCourse`, `FinanceLlmUsage` (replaced).
- `web/lib/evaluation/profile.ts` — option lists, `createParticipantProfileDraft`, `validateParticipantProfile`, `isCompleteParticipantProfile`.
- `web/components/evaluation/profile-form.tsx` — render new dropdowns, remove old fields, mark `gradeOrOccupation` optional.
- `web/config/evaluation.config.json` — `study.intro.paragraphs` briefing copy update.
- `web/lib/evaluation/config.ts` — any profile-related defaults/constants.
- `web/lib/server/evaluation-storage.ts` (and related server route handlers) — read/write new profile shape; backward-compatible read of legacy profiles so the existing "legacy profile shape returns to form" scenario fires; new `clearPendingQuestionsForParticipant(token)` helper invoked when a legacy participant resubmits a new-shape profile; CSV/JSON emission paths gain `legacy_*` columns and a nested `legacyProfile` JSON block.
- Admin code: `web/components/evaluation/admin-*` participant table / record drawer / CSV export — show new fields, drop removed columns.
- Tests under `web/tests/` covering profile validation, server profile API, CSV export, admin display.
- No DB migration (storage is JSON file at `.data/evaluation-store.json`); migration handled by validation + form prefill loop.
