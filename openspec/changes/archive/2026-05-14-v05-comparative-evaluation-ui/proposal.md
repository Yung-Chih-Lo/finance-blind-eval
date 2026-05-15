## Why

The current participant evaluation UI uses a single 1-5 quality rating set whose target is ambiguous: it is unclear whether participants are rating the best answer, worst answer, all three answers, or the overall question experience. This weakens the research method because the admin console could incorrectly interpret those ratings as model-level scores.

## What Changes

- Replace the current 1-5 rating fields with facet-level comparative choices where participants select A, B, or C for correctness, financial reasoning, completeness, and readability.
- Keep overall best and overall worst judgments, plus best and worst free-text reasons.
- Make quality flags apply to the selected overall worst answer in the first implementation.
- Update participant UI copy and layout so the evaluation target is explicit on desktop and mobile.
- Update saved records and exports to store facet-selected labels and resolved model mappings.
- Update admin statistics to report model-level selection counts and proportions by facet instead of ambiguous average rating scores.
- Keep the existing minimum five-question participant flow and the v0.4 GPT-like answer comparison direction; this change does not introduce streaming implementation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `blind-evaluation-app`: Change the participant judgment method from ambiguous whole-question ratings to facet-level blind comparative selections, and update admin/export behavior accordingly.

## Impact

- `web/components/evaluation/question-flow.tsx`: participant evaluation form fields, validation, reset behavior, and mobile/desktop layout hooks.
- `web/components/evaluation/quality-controls.tsx`: replace rating controls with facet-level comparative controls or equivalent component split.
- `web/lib/evaluation/config.ts`: quality flag labels and evaluation facet definitions.
- `web/lib/evaluation/types.ts`: record schema for facet selections and worst-answer flags.
- `web/app/api/evaluation/records/route.ts`: request validation and record persistence for facet selections.
- `web/lib/server/evaluation-storage.ts`: admin snapshot aggregation and CSV/JSON export fields.
- `web/app/admin/page.tsx`: research console metrics for overall and facet selections.
- `web/app/globals.css`: responsive styling for the revised evaluation panel.
