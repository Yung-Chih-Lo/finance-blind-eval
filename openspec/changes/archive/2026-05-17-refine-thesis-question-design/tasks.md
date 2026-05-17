## 1. Study Briefing Homepage

- [x] 1.1 Update `web/config/evaluation.config.json` homepage copy so the first screen reads like a structured research briefing, not a generic letter.
- [x] 1.2 Refactor `web/components/evaluation/token-entry.tsx` to show study purpose, time/question scope, blind comparison tasks, privacy/sensitive-data warnings, and non-investment-advice boundary.
- [x] 1.3 Add minimal CSS for the briefing layout without creating nested cards.

## 2. Profile Fields and Validation

- [x] 2.1 Extend `ParticipantProfile` with age range, field/work domain, finance work experience, investment experience, finance-task LLM usage, and finance subdomain familiarity.
- [x] 2.2 Add shared profile options and validation helpers in `web/lib/evaluation/profile.ts`.
- [x] 2.3 Refactor `ProfileForm` to render the new fields and validate them before submit.
- [x] 2.4 Update `EvaluationApp` so old incomplete profile sessions return to the profile form.
- [x] 2.5 Update `POST /api/session` to reject incomplete expanded profiles.

## 3. Research Export and Admin Visibility

- [x] 3.1 Add the new profile fields to CSV export.
- [x] 3.2 Surface useful new fields in the admin participant table.
- [x] 3.3 Show the profile snapshot in the record drawer for per-record audit context.

## 4. Verification

- [x] 4.1 Update any verification fixtures that construct `ParticipantProfile`.
- [x] 4.2 Run `cd web && npm run typecheck`.
- [x] 4.3 Run `cd web && npm run lint`.
- [x] 4.4 Run `openspec validate refine-thesis-question-design --strict`.
- [x] 4.5 Run `cd web && npm run build` and confirm the production build succeeds.
