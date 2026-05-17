## 1. Entry Copy and Terminology

- [x] 1.1 Update `web/config/evaluation.config.json` study intro copy to include 8-12 minute duration, 5-question scope, model anonymity, privacy, sensitive-data avoidance, and non-investment-advice wording.
- [x] 1.2 Replace participant-facing "測驗" wording in `web/components/evaluation/token-entry.tsx` with questionnaire / blind-evaluation wording.
- [x] 1.3 Replace participant-facing "測驗" wording in `web/components/evaluation/profile-form.tsx` with questionnaire / blind-evaluation wording.
- [x] 1.4 Search participant-facing files for remaining unintended "測驗" copy and keep only wording that refers to blind evaluation or questionnaire flow.

## 2. Guided Prompt UI

- [x] 2.1 Confirm `web/config/evaluation.config.json` keeps category-specific instructions for all five prompt categories instead of generic "自由發揮" copy.
- [x] 2.2 Update the question input placeholder in `web/components/evaluation/question-flow.tsx` to request a finance-related question and warn against personal holdings, internal data, real-time price questions, and buy/sell advice.
- [x] 2.3 Ensure clickable examples remain unchanged as suggestions and do not become required fixed questions.

## 3. Comparison and Judgment UI

- [x] 3.1 Remove participant-visible response latency from `web/components/evaluation/question-flow.tsx`.
- [x] 3.2 Verify admin record tables, record drawer, attention items, and CSV export still expose latency for research operations.
- [x] 3.3 Add helper copy near best/worst reason fields explaining that at least one short reason is required and both are preferred.
- [x] 3.4 Update the no-reason validation toast to match the new helper copy.

## 4. Verification

- [x] 4.1 Run `openspec validate improve-participant-study-validity-ui --strict` and fix artifact issues.
- [x] 4.2 Run `cd web && npm run lint`.
- [x] 4.3 Run `cd web && npm run typecheck`.
- [x] 4.4 Run `cd web && npm run build`.
- [ ] 4.5 After deploy, update or reset production runtime study copy if `.data/platform-settings.json` still contains older participant instructions.
