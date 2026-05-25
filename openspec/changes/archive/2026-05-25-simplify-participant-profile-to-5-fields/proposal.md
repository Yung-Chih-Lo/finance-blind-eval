## Why

The participant background form currently collects 13 fields, but the 2026-05-20 advisor meeting concluded that only 5 background dimensions are needed to support the planned cross-cohort comparison: age range, education level, current main domain (merging "student vs working" × "finance vs other" into a single 3-bucket field), AI usage frequency, and whether the participant has ever used AI for finance tasks. The advisor explicitly removed gender, finance familiarity 1-5 scale, investment experience, finance subdomains, and the optional grade/occupation free-text. Keeping the existing 13-field schema dilutes analysis, lengthens the questionnaire, and contradicts the "do not collect identifying information" instruction (`knownName` is still a free text field). On top of the schema bloat, the codebase carries a large legacy compatibility layer (`migrateLegacyProfile`, `legacyProfile` JSON block, `legacy_*` CSV trailing columns, `isLegacyShape`-keyed pending-clear path, `upsertParticipantStatusAndClearPending`, `extractLegacyProfileSnapshot`) built for a previous schema migration that no longer needs to be preserved — there are zero real samples in the store, so a clean break is the simpler option than a second migration layer on top of the existing one.

## What Changes

- **BREAKING**: Replace `ParticipantProfile` with a 5-field schema. Drop fields: `knownName`, `gender`, `gradeOrOccupation`, `financeWorkExperience`, `investmentExperience`, `financeFamiliarity`, `financeSubdomains`, `notes` (8 fields removed).
- **BREAKING**: Rename `financeBackgroundType` → `mainDomain` with new 3-option enum: `finance_related` / `business_non_finance` / `other` (was 5 options including `prefer_not_to_say`).
- **BREAKING**: Rename `llmExperience` → `aiUsageFrequency` with new 4-option enum: `never` / `occasional` / `frequent` / `daily` (was 5 options).
- **BREAKING**: Tighten `ageRange` to 4 options (drop `prefer_not_to_say`); tighten `educationLevel` to 3 options (drop `prefer_not_to_say`). All 5 fields are required — no opt-out path.
- **BREAKING**: Keep `hasUsedAiForFinance` boolean but rewrite the participant-facing label to include the scope phrasing ("曾用 ChatGPT、Claude、Gemini 等 AI 工具，查詢、討論或解答金融、投資、財務、會計、總經相關問題").
- **BREAKING**: Remove the entire legacy compatibility layer — `migrateLegacyProfile`, `extractLegacyProfileSnapshot`, `LegacyProfileSnapshot` type, `LEGACY_FIELDS` constant, `isLegacyShape` predicate, `wasLegacy` transition branch in session route, `upsertParticipantStatusAndClearPending` atomic helper, read-time profile migration in storage, JSON export `legacyProfile` block, CSV export `legacy_*` 4 trailing columns, admin drawer legacy section.
- **BREAKING**: Reduce admin KPI bar finance-background breakdown from 4 buckets (finance / non-finance / refusal / unknown) to 3 buckets (finance_related / business_non_finance / other). Rename `AdminSnapshot` bucket count fields accordingly.
- **BREAKING**: Reduce admin participant table columns to match the 5-field schema (Token / 年齡 / 學歷 / 目前主要領域 / AI 使用頻率 / 曾用 AI 處理金融? / 完成狀態 / 已答 ÷ 總題數).
- Rewrite `web/components/evaluation/profile-form.tsx` (341 lines → ~140) to render only the 5 required fields with no legacy prefill or re-prompt scenarios.
- Rewrite `web/scripts/verify-profile-validation.ts` to assert the new schema (no legacy test functions); delete the now-obsolete `web/tests/profile-typecheck.ts` (its assertions all target the legacy machinery being removed).
- Wipe `web/.data/evaluation-store.json` (15 test participants, 15 test records — zero real samples, advisor confirmed wipe is acceptable). Leave `web/.data/platform-settings.json` untouched so 2A's intro copy + system prompt remain effective.

## Capabilities

### New Capabilities

(None — all changes are modifications to the existing `blind-evaluation-app` capability.)

### Modified Capabilities

- `blind-evaluation-app`: Four requirements receive BREAKING modifications:
  - **Participant background form** — schema description switches to 5 fields; 4 legacy-related scenarios are removed (Existing session has legacy profile shape / Legacy session has pending question / Gender prefer-not-to-say accepted / Optional grade or occupation provided + omitted); new scenarios pin down each of the 5 fields as required with no `prefer_not_to_say` option.
  - **Evaluation record storage** — "expanded non-identifying background fields" description is rewritten as the 5-field schema; the persisted profile shape is anchored explicitly.
  - **Admin evaluation dashboard** — KPI bar drops from 4 buckets to 3 (no unknown bucket); participant table column list is rewritten; drawer no longer renders any legacy section.
  - **Data export** — CSV header strips the 4 `legacy_*` trailing columns; JSON record no longer emits the `legacyProfile` block; active-profile column list is rewritten to the 5-field schema.

## Impact

- **Affected source**: `web/lib/evaluation/types.ts`, `web/lib/evaluation/profile.ts`, `web/components/evaluation/profile-form.tsx`, `web/app/api/session/route.ts`, `web/lib/server/evaluation-storage.ts` (~747 lines, deep legacy entanglement), `web/app/admin/page.tsx`.
- **Affected verification harness**: `web/scripts/verify-profile-validation.ts` (full rewrite); `web/tests/profile-typecheck.ts` (deleted).
- **Data**: `web/.data/evaluation-store.json` wiped on deploy (admin reset endpoint or manual delete after this change merges).
- **Spec contract**: 4 requirements in `blind-evaluation-app` get BREAKING modifications. Zero new requirements. Zero requirement removals (the legacy scenarios live inside requirements that remain — they're just deleted via MODIFIED).
- **No interaction with 2A**: 2A's three requirements (Participant intro neutral terminology / Provider default system prompt finance-brain scope / Participant five-question completion gate) operate on study copy + provider settings + completion logic — orthogonal to profile schema.
- **No external API impact**: this is a self-contained schema replacement inside a deployment that has not yet been exposed to real participants.
- **Deployment**: After merge, the admin must reset `.data/evaluation-store.json` on Zeabur (either via `POST /api/admin/settings/reset` if that endpoint covers the store, or a manual file delete). 2A's deferred deployment validation (5.5-5.8 from `align-advisor-feedback-copy-and-prompt`) bundles with this change.
