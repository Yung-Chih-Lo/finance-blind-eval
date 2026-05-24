## File Plan

- Modify: `web/config/evaluation.config.json` — `study.intro.greeting / paragraphs / tasks` and `study.signature.thesisTitle` default values.
- Modify: `web/lib/server/provider-settings.ts` — replace the `DEFAULT_SYSTEM_PROMPT` constant content (lines 7-8 area).
- Modify: `web/app/api/evaluation/records/route.ts:112` — change `isCompleted = pending.questionIndex >= config.promptCategories.length` to use `answeredCount >= config.limits.maxQuestionsPerParticipant`.
- Create: `web/scripts/verify-intro-copy.ts` — static checks on default config `study.intro` paragraphs / tasks / signature.thesisTitle (forbidden-keyword scan, paragraph/task count, thesisTitle pattern).
- Create: `web/scripts/verify-system-prompt-defaults.ts` — checks `getDefaultProviderSettings().systemPrompt` keyword presence (finance-brain identity, refusal, Traditional Chinese, no model-name leak).
- Create: `web/scripts/verify-completion-gate.ts` — exercises `records/route.ts` completion derivation via direct call into the storage helpers with fake records.
- Modify: `web/package.json` — add three new `verify:*` scripts mirroring the existing pattern (`verify:provider-url`, `verify:reset-pending`, `verify:profile`).
- No new dependencies.

## 1. Set up failing tests (TDD RED)

- [x] 1.1 Read `web/scripts/verify-profile-validation.ts` end-to-end as the canonical template for verify scripts in this codebase (entry shape, exit codes, console output).
- [x] 1.2 Create `web/scripts/verify-intro-copy.ts` that imports the default `StudyConfig` from `web/config/evaluation.config.json` via the same require pattern as `platform-settings.ts` and asserts:
  - `study.intro.paragraphs.length === 4`
  - `study.intro.tasks.length === 3`
  - The concatenated paragraphs contain none of: `大型語言模型`, `APT`, `H1`, `H2`, `TAIDE`, `validation loss`, `validation roles`, `盲測`, `H1-base`, `H2-base`, `主要分層變項`, `預先指定`
  - The concatenated paragraphs contain at least one occurrence of `金融語言模型` (or `金融腦` — either satisfies the scope)
  - `study.signature.thesisTitle` matches the regex `/^(?!.*(Augmentative|Residual|Adapter|APT)).+$/`
  - Exit code 1 on any failure with a structured `[FAIL]` line listing which assertion broke; exit 0 with `[OK]` lines on success.
- [ ] 1.3 Create `web/scripts/verify-system-prompt-defaults.ts` that calls `getDefaultProviderSettings()` from `web/lib/server/provider-settings.ts` after `delete process.env.OPENAI_COMPAT_SYSTEM_PROMPT` and asserts the returned `systemPrompt`:
  - Contains at least one of `金融腦` or `金融語言模型`
  - Contains all of: `金融`, `投資`, `財務`, `會計`, `總經`, `市場` (topical scope listing)
  - Contains a string indicating refusal of non-finance questions (must match the regex `/不|無法|拒|範圍|無法回答/`)
  - Contains a string indicating refusal of real-time / live data (must match the regex `/即時|實時|最新|查詢|工具/`)
  - Contains the string `繁體中文`
  - Does NOT contain any of: `A/B/C`, `盲測`, `model`, `H1`, `H2`, `TAIDE`
  - Exit code 1 on any failure with `[FAIL]` per broken assertion; exit 0 with `[OK]` on success.
- [ ] 1.4 Create `web/scripts/verify-completion-gate.ts` that exercises the completion-derivation logic by reproducing the snippet from `web/app/api/evaluation/records/route.ts:112` inline (since the route handler is not directly callable from a script):
  - Imports `getActivePlatformSettings` from `@/lib/server/platform-settings` and reads `config.limits.maxQuestionsPerParticipant` (asserts it equals 5).
  - For `answeredCount` in `[1, 2, 3, 4]`: computes `isCompleted = answeredCount >= config.limits.maxQuestionsPerParticipant` and asserts `isCompleted === false`.
  - For `answeredCount === 5`: asserts `isCompleted === true`.
  - For `answeredCount === 6`: asserts `isCompleted === true` (defensive — sixth would never legitimately reach the gate; see scenario `Sixth record write is impossible`).
  - Does NOT directly invoke the route handler (avoids needing Next.js runtime stub) — it tests the formula that the handler uses.
  - Exit code 1 on mismatch; exit 0 on success.
- [ ] 1.5 Edit `web/package.json` to add three scripts under `scripts`, modeled on the existing `verify:profile`:
  - `"verify:intro-copy": "tsc -p scripts/verify-tsconfig.json && node --experimental-loader=./scripts/.verify-loader.mjs scripts/.verify-out/scripts/verify-intro-copy.js"`
  - `"verify:system-prompt": "tsc -p scripts/verify-tsconfig.json && node --experimental-loader=./scripts/.verify-loader.mjs scripts/.verify-out/scripts/verify-system-prompt-defaults.js"`
  - `"verify:completion-gate": "tsc -p scripts/verify-tsconfig.json && node --experimental-loader=./scripts/.verify-loader.mjs scripts/.verify-out/scripts/verify-completion-gate.js"`
- [ ] 1.6 Run `cd web && npm run verify:intro-copy` — expect FAIL (current paragraphs contain `大型語言模型` and thesisTitle contains `Augmentative Residual Adapter`).
- [ ] 1.7 Run `cd web && npm run verify:system-prompt` — expect FAIL (current `DEFAULT_SYSTEM_PROMPT` is one neutral sentence with none of the required keywords).
- [ ] 1.8 Run `cd web && npm run verify:completion-gate` — expect PASS for the formula itself BUT the production handler at `records/route.ts:112` still uses `pending.questionIndex >= config.promptCategories.length` — note this as a documentation gap; the verify script tests the new formula, the actual handler change is task 4.1.

## 2. Intro copy and signature title (TDD GREEN)

- [ ] 2.1 Open `web/config/evaluation.config.json` and replace `study.intro.greeting` with `"您好，"`.
- [ ] 2.2 Replace `study.intro.paragraphs` with the four neutral paragraphs (verified against advisor transcript and Codex review):
  - Paragraph 1: thank-you + finance language model study purpose + different-background users subjective evaluation framing.
  - Paragraph 2: 5 questions × 3 anonymous answers + select the one you find better + rate correctness / completeness / readability.
  - Paragraph 3: 8-12 minutes duration + background data + 5 finance Q&A comparison content scope.
  - Paragraph 4: data use scope (academic research, aggregate) + sensitive-data prohibition (name, ID, account, holdings, internal info) + non-investment-advice disclaimer.
  - NO mention of `大型語言模型`, `主要分層變項`, `預先指定為金融工作或實習經驗`, `金融熟悉度作為次要連續變項`.
- [ ] 2.3 Replace `study.intro.tasks` with exactly three task strings:
  - `"輸入一個金融相關的問題。"`
  - `"閱讀並比較三個匿名回答。"`
  - `"選出您認為整體較好的回答，並就正確性、完整性、可讀性三個面向給出評估與理由。"`
- [ ] 2.4 Replace `study.signature.thesisTitle` from `"The Augmentative Residual Adapter Approach to Pre-training"` to `"金融語言模型回答品質之研究"`.
- [ ] 2.5 Run `cd web && npm run verify:intro-copy` — expect PASS.
- [ ] 2.6 Run `cd web && npm run lint` — expect PASS (config-only change, lint should not regress).
- [ ] 2.7 Run `cd web && npm run typecheck` — expect PASS.

## 3. Provider default system prompt (TDD GREEN)

- [ ] 3.1 Open `web/lib/server/provider-settings.ts` and replace the `DEFAULT_SYSTEM_PROMPT` constant (currently a single neutral sentence at lines 7-8) with the finance-brain system prompt. Required content elements:
  - Opening line declares the assistant as `金融語言模型` / `金融腦` (use one or both).
  - Lists in-scope topics covering at least: `金融`, `投資`, `財務`, `會計`, `總經`, `市場`, `債券`, `利率`, `匯率`, `企業財報`.
  - Refusal rule for non-finance questions with service-scope explanation (e.g., `若使用者詢問非金融問題，請禮貌拒絕並說明本系統僅服務金融、投資、財務、會計、總經、市場相關問題`).
  - Refusal rule for real-time / external-tool-dependent queries (e.g., `對需要即時報價、即時新聞、即時匯率或需查詢工具才能準確回答的問題，請說明本系統無法存取即時資料`).
  - Restriction on investment advice (e.g., `不對個別商品提供具體買賣建議，可以解釋概念、分析框架、風險面向`).
  - Forbids leaking evaluation metadata (e.g., `回答中不要提及模型名稱、盲測流程、A/B/C 標籤`).
  - Requires `繁體中文` output.
- [ ] 3.2 Run `cd web && npm run verify:system-prompt` — expect PASS.
- [ ] 3.3 Run `cd web && npm run lint` — expect PASS.
- [ ] 3.4 Run `cd web && npm run typecheck` — expect PASS.

## 4. Five-question completion gate (TDD GREEN)

- [ ] 4.1 Edit `web/app/api/evaluation/records/route.ts` line 112 from `const isCompleted = pending.questionIndex >= config.promptCategories.length` to `const isCompleted = answeredCount >= config.limits.maxQuestionsPerParticipant`. Confirm `answeredCount` is already in scope at line 108 (it is — `const answeredCount = (await getEvaluationRecordsByParticipant(pending.participantToken)).length`).
- [ ] 4.2 Sanity-check the same handler at line 125 (`completionStatus: isCompleted ? "completed" : "in_progress"`) — no change needed, it just reads the new `isCompleted`.
- [ ] 4.3 Run `cd web && npm run verify:completion-gate` — expect PASS.
- [ ] 4.4 Run `cd web && npm run lint` — expect PASS.
- [ ] 4.5 Run `cd web && npm run typecheck` — expect PASS.

## 5. End-to-end verification

- [ ] 5.1 Run `cd web && npm run verify:intro-copy && npm run verify:system-prompt && npm run verify:completion-gate` chained — expect all PASS.
- [ ] 5.2 Run the full existing verify suite to confirm no regression: `cd web && npm run verify:provider-url && npm run verify:reset-pending && npm run verify:profile`.
- [ ] 5.3 Run `cd web && npm run build` — expect successful Next.js production build.
- [ ] 5.4 Start dev server `cd web && npm run dev` in a side terminal and manually open `http://localhost:3000/?invite_code=ailab502`:
  - Confirm intro renders four paragraphs with the new neutral copy.
  - Confirm signature shows `金融語言模型回答品質之研究`.
  - Confirm no occurrence of `大型語言模型`, `APT`, `H1`, `H2`, `TAIDE`, `盲測` in visible page text.
- [ ] 5.5 With the dev server running and the gateway env vars set (or with a mocked provider if gateway is unavailable):
  - Submit a non-finance question (`今天天氣如何？`) for the first generated answer set.
  - Confirm all three A/B/C answers contain refusal phrasing referencing the finance scope rather than answering the weather.
  - (If gateway env not set, this manual step is deferred to Zeabur smoke test in 5.7.)
- [ ] 5.6 With the dev server running:
  - Complete answers 1 through 4.
  - Refresh the page after answering question 4 — confirm the completion page does NOT render (i.e., `eval_completed` cookie is not set).
  - Complete question 5 — confirm redirect to completion page after the save.
- [ ] 5.7 Deploy to Zeabur via `cd web && npx zeabur@latest deploy --project-id 69b00f05d00471cc19a0b524 --service-id 6a06c9fdeb6e67d8262aba62 --json` and re-run the manual checks (5.4-5.6) on the deployed URL.
- [ ] 5.8 In `/admin` on the deployed site, call `POST /api/admin/settings/reset` (or use the reset button if surfaced) so the new finance-brain `DEFAULT_SYSTEM_PROMPT` becomes the active runtime setting — verify the system prompt field in the provider settings UI reflects the new content.
