## Decisions

### D1: Keep overall best/worst, replace only facet-best selections

Overall best/worst is still useful as a direct preference measure. The three facets become answer-level scores so the analysis can report average correctness, completeness, and readability per model.

### D2: Require the full 3x3 score matrix

All A/B/C x facet scores are required and must be integers from 1 to 5. This avoids per-facet missingness and keeps admin averages straightforward.

### D3: New collection schema, no legacy mixing

Old records may remain on disk during development, but score analytics only use records with `answerScores`. Production should wipe `evaluation-store.json` before collecting new responses.

### D4: Keep runtime provider settings untouched

The rollout should clear response data only. Do not clear `platform-settings.json`, because it carries provider configuration.
