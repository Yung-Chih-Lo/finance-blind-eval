## Why

The current participant entry page and background form are usable, but they still do not fully support formal thesis data collection. The homepage renders the intro letter as plain paragraphs instead of a clear research consent-style briefing, and the background form only captures coarse finance background. That leaves the study weaker in two ways: participants do not get a scannable explanation of what they are doing, and exports do not contain enough demographic or experience fields to segment results defensibly.

## What Changes

- Restructure the participant entry page into a clearer study briefing: title, purpose, time/question scope, blind-comparison tasks, privacy/sensitive-data warnings, and non-investment-advice boundary.
- Add non-identifying demographic and background fields: age range, field/major or work domain, finance work/internship experience, investment experience, finance-task LLM usage, and finance subdomain familiarity.
- Validate the expanded profile on the client and server; old incomplete profile sessions should return to the profile form instead of skipping to questions.
- Persist new fields in participant profiles, pending questions, records, admin participant views, and CSV export.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `blind-evaluation-app`: the participant entry and background form requirements gain research-validity scenarios for structured study briefing and analysis-ready non-identifying profile fields.

## Impact

- Code: `web/components/evaluation/token-entry.tsx`, `web/components/evaluation/profile-form.tsx`, `web/components/evaluation/evaluation-app.tsx`, `web/app/api/session/route.ts`, `web/lib/evaluation/types.ts`, `web/lib/evaluation/profile.ts`, `web/lib/server/evaluation-storage.ts`, admin record/participant views.
- Storage: new profile fields are additive in `.data/evaluation-store.json`; no migration is required for old records.
- Exports: CSV gains the new profile columns; JSON already exports participant/profile objects.
- No provider, prompt-generation, model mapping, or auth changes.
