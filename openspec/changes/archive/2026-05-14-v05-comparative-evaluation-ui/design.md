## Context

The current Next.js evaluation app already supports participant tokens, background profiles, server-side A/B/C answer generation, hidden model mapping, pending question storage, saved judgments, admin counts, and CSV/JSON export. Its evaluation panel still follows the older survey design: participants select best/worst, enter reasons, then fill a single set of quality ratings. That rating target is ambiguous and cannot safely be aggregated as model-level evidence.

The v0.5 survey method changes the evaluation unit from absolute 1-5 ratings to comparative facet selections. Participants still compare the same three anonymous answers, but each quantitative field asks which answer is best for a specific facet.

## Goals / Non-Goals

**Goals:**

- Make every participant evaluation control point at a clear answer label.
- Store facet selections as first-class record fields.
- Keep the participant workload close to the current form: six label choices plus two short reasons and flags.
- Let admin metrics resolve each selected label through hidden mapping into model-level counts and percentages.
- Preserve existing server-only gateway boundaries and hidden mapping behavior.

**Non-Goals:**

- Do not implement token-by-token streaming in this change.
- Do not redesign the full entry/profile flow.
- Do not require participants to rate every answer on every facet with Likert scales.
- Do not introduce a database migration framework; the local JSON store remains append-compatible for pilot use.
- Do not add authentication to `/admin` in this change.

## Decisions

### Use Facet-Level Relative Choice Instead of Per-Answer Likert Ratings

Each facet is represented as one A/B/C selection:

- Overall best
- Overall worst
- Best by financial correctness
- Best by financial reasoning
- Best by completeness
- Best by readability

This keeps the task close to natural blind comparison and produces directly resolvable model-level data. The alternative, rating A/B/C separately for four facets, would create 12 rating interactions per question and likely reduce completion quality.

### Keep Worst Flags Attached to Overall Worst

Quality flags apply to the participant's selected overall worst answer. This gives flags a clear target while avoiding a per-answer flag matrix. The admin console can resolve those flags to the model behind the worst label.

### Retain Existing Pending Question Flow

The app will continue creating a pending question after answer generation and turning it into a record after judgment submission. New facet fields are added to the record payload and persistence model. Existing old records may not have these fields; aggregation code should treat missing facet selections as absent rather than failing.

### Rename UI Concepts, Not Only Field Names

The participant panel should stop presenting this as "品質標記與量表". It should present "面向比較" so the task is explicitly comparative. Desktop can remain inline; mobile uses the existing responsive layout rather than introducing a new bottom sheet in this change.

### Admin Metrics Are Counts and Percentages

Admin should not show average quality ratings for these facets. It should show count and percentage by resolved model for overall best, overall worst, correctness, reasoning, completeness, and readability. This better matches the v0.5 method and avoids unsupported mean-score claims.

## Risks / Trade-offs

- [Risk] Existing local records may lack new facet fields. -> Mitigation: aggregation and export code tolerate missing fields and include empty values for older rows.
- [Risk] Participants may select the same answer for all positive facets by default. -> Mitigation: labels are explicit and reasons remain required; admin can inspect patterns and free-text reasons.
- [Risk] Worst flags only describe one answer, not all answer issues. -> Mitigation: v0.5 intentionally prioritizes lower burden; later changes can add per-answer flags if the study requires it.
- [Risk] Removing Likert-style ratings reduces compatibility with common survey analysis. -> Mitigation: the chosen method is more defensible for blind comparative evaluation because every quantitative field maps to a model.

## Migration Plan

1. Add new TypeScript fields while keeping old `qualityRatings` optional or unused for backward compatibility.
2. Update the participant record API to require all facet selections for new submissions.
3. Update storage aggregation and export to include facet fields.
4. Update admin UI to display comparative facet summaries.
5. Run lint, typecheck, and build from `web/`.
