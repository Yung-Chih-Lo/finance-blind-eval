## Context

The app already supports runtime study copy, guided prompt categories, blind A/B/C comparison, admin records, and CSV/JSON export. The issue is not core architecture; it is that participant-facing wording and visible metadata can weaken formal-study validity before data collection begins.

The deployed runtime copy can also diverge from repository defaults, so this change must improve both default copy and hardcoded participant UI labels.

## Goals / Non-Goals

**Goals:**

- Make the entry page clearly state duration, five-question scope, privacy, sensitive-data boundaries, and non-investment-advice scope.
- Replace participant-visible "test" wording with questionnaire / blind-evaluation wording.
- Keep prompts finance-related while preserving flexible participant-authored questions.
- Remove participant-visible latency from comparison screens.
- Make judgment-form reason expectations explicit.

**Non-Goals:**

- Do not add new participant profile fields in this change.
- Do not add analysis dashboards or background segmentation in this change.
- Do not change model mapping, provider settings, or admin authentication.
- Do not remove latency from admin records or exports.

## Decisions

1. Keep study-copy edits in `StudyConfig` defaults plus existing admin runtime settings.
   - Rationale: the platform already treats participant-facing copy as config.
   - Alternative considered: hardcode all new copy in React components. Rejected because admins would not be able to tune formal-study wording.

2. Use concise, formal Traditional Chinese on participant pages.
   - Rationale: participants need enough context without feeling like they are reading a thesis chapter.
   - Alternative considered: add a long consent-style page. Rejected for v1 because it increases drop-off and is not needed for the current thesis pilot.

3. Hide latency only from participant comparison UI.
   - Rationale: speed can bias subjective judgment, but latency is still useful for admin troubleshooting.
   - Alternative considered: remove latency from records entirely. Rejected because it would reduce observability.

4. Clarify reason expectations without introducing new data fields.
   - Rationale: current storage already captures `bestReason` and `worstReason`; this change should improve UI behavior without expanding schema.
   - Alternative considered: require both reasons server-side. Deferred until the advisor confirms that added burden is acceptable.

## Risks / Trade-offs

- Runtime settings may already contain older copy on production -> update repository defaults and ensure admins can re-save/reset production copy after deployment.
- More instruction text can increase entry-page length -> keep copy short and scannable.
- Stronger finance-scope hints can feel like fixed questions -> keep examples clickable but allow participant-authored wording.
