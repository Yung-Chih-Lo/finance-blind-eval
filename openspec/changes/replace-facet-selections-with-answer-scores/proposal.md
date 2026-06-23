## Why

Advisor feedback changed the human evaluation design from selecting the best answer for each facet to scoring every blinded answer on the three target facets. The study still needs overall best/worst preference labels, but correctness, completeness, and readability should become 1-5 ratings for A, B, and C.

## What Changes

- Keep the existing overall best / overall worst judgment, reasons, and worst-answer flags.
- Replace `facetSelections` with required `answerScores` for A/B/C x correctness/completeness/readability.
- Update participant UI, record API validation, storage types, admin model results, record drawer, and CSV export.
- Treat this as a new collection schema. Production rollout should wipe `evaluation-store.json` before collecting new responses.

## Capabilities

### Modified Capabilities

- `blind-evaluation-app`: per-question judgments now require full answer scores instead of facet-best label selections.

## Impact

- **Source files**: participant question flow, quality controls, shared types, record API, storage/export helpers, admin dashboard/table/drawer, default study config, verification scripts.
- **Persisted data**: new records use `answerScores`; old records are not mixed into the new score analytics.
- **CSV schema (BREAKING)**: remove `best_by_*` facet columns and add A/B/C score columns plus resolved model score columns.
- **No deps added**.
