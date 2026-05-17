## Why

The deployed participant flow is usable, but several visible copy and UI choices weaken formal study validity before data collection: participants are framed as taking a "test", category instructions are too generic, latency is visible, and the entry page does not clearly warn against sensitive data or investment-advice use.

This change tightens the participant-facing experience so collected records better match the thesis evaluation design and are easier to defend with the advisor.

## What Changes

- Add participant-facing study instructions for expected duration, required question count, privacy, sensitive-data avoidance, and non-investment-advice scope.
- Replace "測驗" wording with questionnaire / blind-evaluation wording across participant-visible UI.
- Restore category-specific prompt guidance and improve the question input placeholder so prompts stay finance-related without becoming fixed questions.
- Hide answer latency from participant comparison screens while preserving latency in admin views and exports.
- Clarify best/worst reason expectations in the judgment form.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `blind-evaluation-app`: tighten participant entry copy, guided prompt instructions, visible comparison metadata, and judgment-form expectations.

## Impact

- Participant-facing config defaults in `web/config/evaluation.config.json`.
- Participant UI components under `web/components/evaluation/`.
- No provider API, model mapping, storage schema, or admin authentication changes.
- Existing admin/export latency fields remain available.
