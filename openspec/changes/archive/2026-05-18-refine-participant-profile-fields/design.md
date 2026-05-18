## Context

The Notion thesis methodology report (`問卷方法設計報告：受試者、提示與分析規劃`, 2026-05-17) reframes the participant questionnaire as a *relative-preference study* for finance-literate users at N=30-40, not a general-population survey. Background fields must (1) describe the sample, (2) defend that participants have finance judgment capacity, and (3) enable **exploratory** stratification — never confirmatory subgroup tests.

Current `ParticipantProfile` (web/lib/evaluation/profile.ts) has 11 required fields, several of which are problematic:

- `fieldOrWorkDomain` (free text) + `isBusinessOrFinance` (yes/no/unsure) → two near-duplicate fields that ask the same thing at different granularity; `fieldOrWorkDomain` also requires post-hoc coding to stratify on, and the binary is too coarse.
- `financeLlmUsage` (5-level) → with N=30-40, the "weekly / daily" cells will be near-empty, contributing noise.
- `hasTakenFinanceCourse` → high collinearity with `financeWorkExperience` and `financeFamiliarity`; same construct measured three ways.
- `under_20` age bucket → minor research-ethics risk and no research value (target sample is undergrads upward).
- Missing `gender` and `educationLevel` → advisor will ask for sample description; absence is a defense gap.

Two persona pressure tests (大學生 + 投信研究員) plus a methodology-reviewer persona converged on the same conclusion: the profile is currently *too long for what little it analyzes* and the rephrasing should reduce friction while making each surviving field have a defensible analysis role.

Persisted evaluation records and pending storage live in `.data/evaluation-store.json` (server-side JSON). Legacy participant sessions may exist on disk (especially in the Zeabur volume mount); we cannot drop records but we can require the participant to re-confirm profile via the existing "incomplete profile returns to form" flow.

## Goals / Non-Goals

**Goals:**
- Replace `fieldOrWorkDomain` + `isBusinessOrFinance` with a single structured `financeBackgroundType` enum that simultaneously answers "is this participant finance-literate?" and "what bucket do they fall into?" without free-text coding.
- Add `gender` and `educationLevel` to support sample description and defense against advisor questions.
- Pre-register `financeWorkExperience` as **primary stratifier** and `financeFamiliarity` as **secondary stratifier** in the analysis-framing briefing copy, so subgroup analyses are declared exploratory in advance.
- Reduce friction on noise-prone fields (`financeLlmUsage` 5-level → Y/N; drop `under_20`; demote `gradeOrOccupation` to optional).
- Keep all evaluation records emitted by the existing schema readable; legacy profiles trigger the existing "return to form with prefill" path.
- Update admin participant table and CSV export to surface new fields and stop emitting removed fields.

**Non-Goals:**
- No change to the question-flow UI, model-comparison UI, judgment form, or facet definitions.
- No new analytics or stratification computation in the admin dashboard (analysis is offline in Jupyter against the CSV export).
- No DB migration tooling — JSON file persistence with backward-compatible read handles it.
- No English-finance-reading-ability field (advisor persona recommended against it; would open new defense battles).

## Decisions

### D1. Merge `fieldOrWorkDomain` + `isBusinessOrFinance` → `financeBackgroundType` enum

```
- student_finance_related     學生：商管、金融、會計、經濟相關
- student_other               學生：非上述領域
- working_finance_related     工作者：金融、會計、投資、銀行、保險、證券相關
- working_other               工作者：非上述領域
- prefer_not_to_say           不願透露
```

- Alternative considered: keep `isBusinessOrFinance` binary plus optional `fieldOrWorkDomain`. Rejected because the binary loses student-vs-worker resolution, which is required for the §7.4 stratification.
- Alternative considered: 6-option (split the working bucket into 金融-銀行-證券 / 會計-審計 / 投資-研究). Rejected at N=30-40 because each cell would average ~7-8 people; per the advisor persona "8 ÷ 35 = 4 per cell is too thin for description". 4 buckets gives ~9 people per cell, healthy enough for description.
- The new field also subsumes the information from `hasTakenFinanceCourse` for non-business participants who took finance courses — covered separately via `financeFamiliarity` self-rating + `financeSubdomains`.

### D2. Pre-register stratifiers in briefing copy, not schema

The schema does not encode "this field is the primary stratifier"; that's a research-methodology decision documented in `study.intro.paragraphs` (or a new `studyMethodologyNote` field — to be decided in implementation, see Open Questions). Either way, the participant-facing copy will explicitly state:

> 背景資料主要用於樣本描述與金融相關性檢核；主要分層變項預先指定為金融工作或實習經驗，金融熟悉度作為次要連續變項；其他人口統計與使用經驗欄位僅作探索性分析，不作為主要推論依據。

- Alternative considered: only update the Notion methodology report. Rejected because the disclaimer should be visible to participants per Notion §5 study-briefing recommendation, and visibility helps participants give more honest answers (knowing demographic fields are *not* used for filtering).

### D3. Downgrade `financeLlmUsage` 5-level → Y/N `hasUsedAiForFinance` with explicit-selection requirement

The 5-level enum (`never/tried/monthly/weekly/daily`) inflates noise at small N. We retain the more relevant `llmExperience` 5-level field (overall LLM usage) and add a binary "have you ever used AI for finance tasks" as a control variable.

**Tri-state in draft, binary when stored**: the form draft uses `boolean | null` (via a new `ParticipantProfileDraft` type); the persisted `ParticipantProfile.hasUsedAiForFinance` is `boolean`. The form renders two radios with NO default selection. `validateParticipantProfile` rejects `null` so a participant who skips the field cannot accidentally have it persisted as `false`.

- Alternative considered: 3-level (never / occasional / regular). Rejected because Y/N has clearer interpretation and zero ambiguity for participants.
- Alternative considered: default-seed draft to `false`. Rejected because "未填" would silently get coded as "明確選了否", contaminating analysis (caught by Codex adversarial review, 2026-05-17).

### D4. Demote `gradeOrOccupation` to optional free text

Persona tests showed two participants (大學生 and 投信研究員) explicitly resented being asked to free-text-type something already implied by other fields. Making it optional preserves the质性 sample-description value (advisor persona explicitly wanted "free text retained for later qualitative description") while removing the friction.

### D5. Drop `derivatives` and `risk_management` from `financeSubdomains`

These two have no corresponding `promptCategories` and would yield near-empty cells at N=30-40. The 7 surviving subdomains map cleanly onto the 5 prompt categories plus two life-domain options (個人理財, 都不熟悉).

### D6. Backward-compatible read of legacy profiles

When the server reads a persisted profile, the read path:
1. Drops the legacy fields (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`) without erroring.
2. For legacy inputs (no new fields in storage): the new required fields (`gender`, `educationLevel`, `financeBackgroundType`, `hasUsedAiForFinance`) are NOT defaulted — they stay absent from the returned partial. `isLegacyShape` keys off this absence to trigger the legacy → new transition (pending clear + form re-prompt).
3. For new-shape inputs (new fields already in storage): the read path PRESERVES the new fields verbatim. This is required so a returning participant who already submitted the new profile reads back identical data on subsequent requests — without preservation, every read would look "legacy" and `isLegacyShape` would clear pending on every profile resubmit. (Bug uncovered by verify-driven follow-up regression test `testCombinedUpsertClearsPending`.)
4. `validateParticipantProfile` reports the missing new fields, triggering the existing "legacy profile returns to form with prefill" scenario.

The form pre-fills compatible legacy fields (ageRange, financeFamiliarity, llmExperience, financeWorkExperience, investmentExperience, financeSubdomains, optional gradeOrOccupation). The participant fills the new fields and re-submits; the server then writes the new shape.

- Alternative considered: explicit JSON migration on read (best-effort map `isBusinessOrFinance="yes"` → `financeBackgroundType=student_finance_related` etc.). Rejected because `isBusinessOrFinance` can't disambiguate student-vs-worker without `fieldOrWorkDomain` content inspection, and silent guesses would corrupt the sample-description claims.

**Pending-question side effect (added per Codex review, 2026-05-17)**: when a participant with a legacy profile resubmits a new-shape profile, the server SHALL also remove any pending-question entries owned by that participant token. Reason: pending questions carry a `participantProfile` snapshot that would otherwise persist the legacy shape into the saved evaluation record, and the existing `/api/evaluation/answers` 409 logic blocks regenerating the same question index until the pending entry is cleared. We choose **clear-and-regenerate over rehydrate-with-new-snapshot** because (a) it is simpler, (b) at N=30-40 legacy mid-flight sessions are expected to be near zero, and (c) clearing avoids a "answers generated under legacy context, judged under new-profile context" mixed-cohort artifact.

- Alternative considered: rehydrate the pending question's `participantProfile` with the new shape and keep the previously generated A/B/C answers. Rejected for cohort-integrity reasons above.

### D7. Admin participant table: replace `field/work domain` column with `financeBackgroundType` + render `hasUsedAiForFinance` as Y/N

The "受測者" tab scenario currently lists `field/work domain` and `finance-task LLM usage`. After the change:
- `field/work domain` column → `financeBackgroundType` (rendered with the Chinese label from the option list).
- `finance-task LLM usage` column → `hasUsedAiForFinance` Y/N.

KPI bar's "finance-vs-non-finance breakdown" derives from `financeBackgroundType ∈ {student_finance_related, working_finance_related}` vs. other (excluding `prefer_not_to_say` which is reported separately).

### D8. CSV export columns

- **Add**: `gender`, `educationLevel`, `financeBackgroundType`, `hasUsedAiForFinance`.
- **Remove**: `fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`.
- **Preserve**: all other existing columns (token, ageRange, gradeOrOccupation, financeWorkExperience, investmentExperience, financeFamiliarity, llmExperience, financeSubdomains, judgment fields, model IDs, settings metadata, etc.).

JSON export emits the same fields under their canonical names.

### D9. Preserve legacy profile data in `legacy_*` export columns (added per Codex review, 2026-05-17)

Legacy completed records (saved under the old profile schema before this change ships) keep their original profile snapshot inside `.data/evaluation-store.json`. The new CSV export must surface that data so the legacy cohort remains identifiable for sample description; otherwise legacy rows would appear in exports with only token/age/etc. and the original `fieldOrWorkDomain` / `isBusinessOrFinance` / `hasTakenFinanceCourse` / `financeLlmUsage` would be invisible to analysis tooling — directly contradicting the "completed legacy records remain cohort-identifiable" claim earlier in this design doc.

- CSV appends four trailing columns after the active-profile columns: `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, `legacy_finance_llm_usage`. The headers are ALWAYS present (deterministic schema). New-shape records emit empty cells in those four columns. Legacy records emit their stored values verbatim.
- JSON export attaches a nested `legacyProfile` block to legacy records only; new-shape records do NOT include the block.

- Alternative considered: drop legacy records from CSV entirely and document JSON export as the authoritative source for legacy rows. Rejected because Yung's primary analysis path is CSV → Jupyter; silently dropping rows would be a worse defense gap than four extra always-present columns.
- Alternative considered: write a one-shot migration script that promotes legacy fields into the new schema using heuristics. Rejected for the same reason as D6 — silent guesses corrupt sample-description claims.

## Risks / Trade-offs

- **[Legacy data on production volume becomes partially unreadable]** → existing records (in `.data/evaluation-store.json` on the Zeabur volume) keep their original profile snapshot verbatim; only *active sessions* are forced back through the profile form. Already-completed records exported to CSV will have empty cells in the new columns and have values in legacy columns — research should treat these as a separate sample cohort, since the briefing copy did not yet declare exploratory framing when those participants filled the form. Mitigation: tag exported records with `settingsVersion` (already implemented) so the cohort is identifiable.
- **[Briefing paragraph adds reading load before the invite-code field]** → Notion §5 explicitly endorses this; persona tests did not flag pre-invite text as a friction driver compared with profile-form questions. Keep paragraph short.
- **[`gender` reduces participant comfort]** → label includes "（僅供樣本描述）" to defuse motivation question; `prefer_not_to_say` option provides escape valve. Per investment-researcher persona, friction here is low.
- **[Dropping `hasTakenFinanceCourse` loses a granular dimension]** → covered by `financeBackgroundType` + `financeFamiliarity` + `financeSubdomains`; advisor persona accepted this consolidation in the iterated proposal.
- **[`financeBackgroundType` enum buckets too coarse for some niche participants (e.g., 金融科系畢業但在科技業工作)]** → 4 buckets force a choice; participant can use the optional `gradeOrOccupation` free text to clarify. Acceptable trade-off for N=30-40.

## Migration Plan

1. Ship spec + code update behind no flag (this app is participant-facing only and has no live production cohort that we want to keep mid-flight under the old schema — confirm with Yung before deploy).
2. On first request after deploy, any in-progress participant session with a legacy profile is sent back to the profile form via the existing legacy-shape scenario; new required fields default to empty / `prefer_not_to_say`.
3. Already-completed records remain untouched; admin tab continues to render them with whatever legacy columns the underlying record has (the admin renderer must tolerate missing new fields).
4. Rollback: revert deploy; sessions written under the new shape that have not yet completed must re-enter through the legacy-form path on the reverted deploy. Acceptable because pre-completion sessions are inherently transient.

## Open Questions

- Should the analysis-framing briefing paragraph go into `study.intro.paragraphs` (so it renders as the next paragraph after the existing intro) **OR** become a new `study.intro.methodologyNote` field rendered as a separate visually-distinct block? Default: append into `study.intro.paragraphs`. Either way is content-level; spec scenario doesn't change.
- (Resolved 2026-05-17 by spec scenario "KPI bar reports finance-background breakdown"): `prefer_not_to_say` is a separate refusal bucket; legacy records counted in an `unknown` bucket.
