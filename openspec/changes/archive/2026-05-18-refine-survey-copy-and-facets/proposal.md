## Why

Pre-launch survey polish based on advisor-facing readability review:
- The in-form intro paragraph duplicates the study briefing on the landing page and adds vertical weight before the first question.
- The "high school or below" education option is unreachable given the recruited age range (20-24+).
- The "曾否用 AI 處理金融問題" Y/N radio has visually inconsistent spacing vs the surrounding `<select>` controls.
- The four-facet best-answer comparison includes `reasoning`, but advisor feedback found it overlaps too much with `correctness` — analytically the marginal information is low for a sample of N=30-40 and adds cognitive load per question. Dropping it tightens the per-question judgment burden by 25%.

## What Changes

- Remove the `<section className="form-intro">` block at the top of the participant background form.
- Remove the `high_school_or_below` option from `EducationLevel` union and `EDUCATION_LEVEL_OPTIONS`.
- Convert the `hasUsedAiForFinance` input from two radio buttons to a `<select>` with placeholder + Yes/No options.
- **BREAKING**: Remove the `reasoning` facet from `EvaluationFacetId`, `ModelComparisonCounts`, `evaluationFacets` config, admin facet table, CSV export columns (`best_by_reasoning_*`), and platform-settings validation list. Historical records keep their `facetSelections.reasoning` JSON field but it is no longer surfaced.
- Rename the `correctness` facet label from `金融正確性最好` to `正確性最好` (drop the redundant 金融 prefix; participants already know this is a finance study).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `blind-evaluation-app`: drop `reasoning` from the per-question facet selections required, the persisted record's facet-best labels, and the admin export's facet columns.

## Impact

- **Source files**:
  - `web/components/evaluation/profile-form.tsx` (intro section, radio→select)
  - `web/lib/evaluation/profile.ts` (EDUCATION_LEVEL_OPTIONS)
  - `web/lib/evaluation/types.ts` (`EducationLevel`, `EvaluationFacetId`, `ModelComparisonCounts`)
  - `web/config/evaluation.config.json` (`evaluationFacets` array — remove reasoning entry, rename correctness label)
  - `web/lib/server/evaluation-storage.ts` (zeroed counter init, CSV `best_by_reasoning_*` columns, comparative-counts assembly)
  - `web/lib/server/platform-settings.ts` (`EVALUATION_FACET_IDS`)
  - `web/app/admin/page.tsx` (`FACET_COLUMNS`)
  - `web/scripts/verify-profile-validation.ts` (any draft seed that referenced reasoning)
- **Persisted data**: existing `.data/evaluation-store.json` records with `facetSelections.reasoning` are left intact but ignored by reader code. No migration required.
- **CSV schema (BREAKING)**: 3 columns removed from export — `best_by_reasoning_label`, `best_by_reasoning_model`, `best_by_reasoning_gateway_model`. Downstream analysis scripts (if any) must drop reasoning references.
- **No deps added**.
