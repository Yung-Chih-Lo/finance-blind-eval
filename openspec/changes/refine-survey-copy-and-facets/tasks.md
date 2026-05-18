# Tasks

## File Plan

- **Modify**: `web/components/evaluation/profile-form.tsx` — drop `<section className="form-intro">`; replace the `hasUsedAiForFinance` `<div className="radio-row">` block with the same `<select>` pattern used for `gender` / `educationLevel`.
- **Modify**: `web/lib/evaluation/profile.ts` — remove `{ value: "high_school_or_below", ... }` from `EDUCATION_LEVEL_OPTIONS`. The `EDUCATION_LEVEL_VALUES` Set is derived from `EDUCATION_LEVEL_OPTIONS.map(...)` so it updates automatically.
- **Modify**: `web/lib/evaluation/types.ts` — remove `"high_school_or_below"` from `EducationLevel`; remove `"reasoning"` from `EvaluationFacetId`; remove the `reasoning: number` field from `ModelComparisonCounts`.
- **Modify**: `web/config/evaluation.config.json` — remove the `{ "id": "reasoning", ... }` entry from `evaluationFacets`; change `correctness.label` from `金融正確性最好` to `正確性最好`; update `study.intro.tasks[3]` to drop the "金融推理" word.
- **Modify**: `web/lib/server/evaluation-storage.ts` — drop `reasoning: 0` from the counter init at `~L402`; delete the three `best_by_reasoning_*` CSV columns at `~L709-711`.
- **Modify**: `web/lib/server/platform-settings.ts` — drop `"reasoning"` from `EVALUATION_FACET_IDS`.
- **Modify**: `web/app/admin/page.tsx` — drop the `{ key: "reasoning", label: "Reasoning" }` entry from `FACET_COLUMNS`.
- **Modify**: `web/scripts/verify-profile-validation.ts` — add `testEducationOptionsExcludeHighSchool` and `testFacetsExcludeReasoning`, register them in `main()`.

## 1. Intro section removal

- [x] 1.1 Delete the `<section className="form-intro">` block (lines 103-110) from `profile-form.tsx`
- [ ] 1.2 Confirm visually that the next heading-level block (the first `<fieldset>`) renders without spacing regression (manual UI smoke)

## 2. Education option narrowing

- [x] 2.1 RED: add `testEducationOptionsExcludeHighSchool` to `verify-profile-validation.ts` asserting `EDUCATION_LEVEL_OPTIONS.find(o => o.value === "high_school_or_below")` is `undefined`, and that `validateParticipantProfile({...completeDraft, educationLevel: "high_school_or_below"})` includes an issue mentioning 學歷
- [x] 2.2 Verify RED: `cd web && npm run verify:profile` — confirm the new test fails (option still present)
- [x] 2.3 GREEN: in `EducationLevel` (types.ts) remove the `"high_school_or_below"` arm; in `EDUCATION_LEVEL_OPTIONS` (profile.ts) remove the first entry
- [x] 2.4 Verify GREEN: re-run the verify script — the new test must pass and all 9 prior tests must still pass
- [x] 2.5 Run `cd web && npm run typecheck` — ensure no residual reference to `"high_school_or_below"` (the literal type is gone, references would surface)

## 3. hasUsedAiForFinance radio → select swap

- [x] 3.1 Replace the `<div className="field-group">…<div className="radio-row">…</div>…</div>` block (profile-form.tsx ~L308-331) with a `<label>` containing a `<select>` whose options are: disabled placeholder `請選擇` (value `""`), `是` (value `"true"`), `否` (value `"false"`)
- [x] 3.2 In the `onChange` handler, branch on `event.target.value`: `""` → `null`, `"true"` → `true`, `"false"` → `false`. Cast: `hasUsedAiForFinance: value === "" ? null : value === "true"`
- [x] 3.3 Run `cd web && npm run typecheck` — confirm the boolean / null tri-state still types
- [x] 3.4 Run `cd web && npm run lint`
- [ ] 3.5 Manual UI smoke: profile-form renders the select, validation rejects placeholder, both Yes and No submit and persist correctly (deferred — visual check before merge)

## 4. Reasoning facet removal (schema-wide)

- [ ] 4.1 RED: add `testFacetsExcludeReasoning` to `verify-profile-validation.ts` asserting (a) the config's `evaluationFacets` does NOT contain an entry with `id === "reasoning"`, (b) `EVALUATION_FACET_IDS` from platform-settings does NOT include `"reasoning"`, (c) the CSV-export row builder output keys do NOT include `best_by_reasoning_label`
- [ ] 4.2 Verify RED: `npm run verify:profile` — confirm the new test fails on all three assertions
- [ ] 4.3 GREEN — types.ts: drop `"reasoning"` from `EvaluationFacetId` union; drop `reasoning: number` field from `ModelComparisonCounts` interface
- [ ] 4.4 GREEN — config: remove the `{ "id": "reasoning", "label": "金融推理最清楚", "helper": "..." }` object from `evaluationFacets`
- [ ] 4.5 GREEN — platform-settings.ts: remove `"reasoning"` from `EVALUATION_FACET_IDS` literal array
- [ ] 4.6 GREEN — evaluation-storage.ts: remove `reasoning: 0` from the counter-init at L402; remove the three `best_by_reasoning_*` keys from the CSV row at L709-711
- [ ] 4.7 GREEN — admin/page.tsx: remove `{ key: "reasoning", label: "Reasoning" }` from `FACET_COLUMNS`
- [ ] 4.8 Verify GREEN: re-run `npm run verify:profile` — new test must pass, prior 9 tests must still pass
- [ ] 4.9 Run `npm run typecheck` — confirm no `reasoning` literal type / property remains anywhere
- [ ] 4.10 Run `npm run lint`
- [ ] 4.11 Run `npm run build` — confirm Next.js production build succeeds with the reduced facet schema

## 5. Correctness facet label rename + tasks copy update

- [ ] 5.1 In `evaluation.config.json` change `evaluationFacets[0].label` from `金融正確性最好` to `正確性最好`
- [ ] 5.2 In `evaluation.config.json` change `study.intro.tasks[3]` from `依金融正確性、金融推理、完整性與可讀性選出各面向較佳的回答。` to `依正確性、完整性與可讀性選出各面向較佳的回答。`
- [ ] 5.3 In `evaluation.config.json` change `study.intro.paragraphs[0]` — drop the `、金融推理` substring so the line reads `…並依正確性、完整性與可讀性進行比較…`

## 6. Self-review and strict validation

- [ ] 6.1 Run `openspec validate refine-survey-copy-and-facets --type change --strict` and confirm exit 0
- [ ] 6.2 Re-grep the codebase for any stray reference to `reasoning` (in `web/` excluding `.next/`, `node_modules/`, `verify-out/`, and `.data/`) — if any non-`reasoning`-the-word matches remain (e.g., comments), evaluate keep vs delete
- [ ] 6.3 Re-grep for `high_school_or_below` in `web/` source — must be zero matches
- [ ] 6.4 Re-grep for `金融正確性最好` and `金融推理` in `web/` source — must be zero matches (config + UI copy fully updated)
