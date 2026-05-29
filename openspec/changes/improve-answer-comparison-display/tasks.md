# Tasks

## File Plan

- Create: `web/lib/evaluation/answer-display.ts` — `normalizeAnswerText()` pure function (trim + collapse `\n{3,}`→`\n\n`).
- Create: `web/scripts/verify-answer-display.ts` — regression harness for `normalizeAnswerText()` (node:assert pattern, matching existing `verify-*.ts`).
- Modify: `web/package.json` — add deps `react-markdown`, `remark-gfm`, `remark-breaks`; add script `verify:answer-display`.
- Modify: `web/components/evaluation/question-flow.tsx` — render answers via `<ReactMarkdown>` (remark-gfm + remark-breaks) with normalized text; add in-flight loading spinner block.
- Modify: `web/app/globals.css` — `.answer-card { align-content: start }`, markdown element styles scoped to the answer card, `.answer-loading` spinner styles.

## 1. Text normalization (TDD)

- [x] 1.1 RED: create `web/scripts/verify-answer-display.ts` importing `normalizeAnswerText` from `@/lib/evaluation/answer-display`; assert: trims leading/trailing whitespace; collapses `"a\n\n\n\nb"` → `"a\n\nb"`; preserves a single newline `"1.\n2."` unchanged; preserves one blank line `"a\n\nb"` unchanged; empty/whitespace-only string → `""`.
- [x] 1.2 Add `"verify:answer-display"` script to `web/package.json` mirroring the existing `verify:profile` invocation (tsc + loader against `scripts/.verify-out/scripts/verify-answer-display.js`).
- [x] 1.3 Verify RED: `cd web && npm run verify:answer-display` → FAILS (module `answer-display` not found).
- [x] 1.4 GREEN: create `web/lib/evaluation/answer-display.ts` exporting `normalizeAnswerText(text: string): string` = `text.replace(/\n{3,}/g, "\n\n").trim()`.
- [x] 1.5 Verify GREEN: `cd web && npm run verify:answer-display` → ALL PASS.

## 2. Add markdown dependencies

- [x] 2.1 `cd web && npm install react-markdown remark-gfm remark-breaks` (pins versions into `package.json` + lockfile).
- [x] 2.2 Verify install: `cd web && npm run typecheck` → no resolution errors for the new packages.

## 3. Render answers as uniform markdown

- [x] 3.1 In `web/components/evaluation/question-flow.tsx`, import `ReactMarkdown`, `remarkGfm`, `remarkBreaks`, and `normalizeAnswerText`.
- [x] 3.2 Replace `<p>{answerResponse.answers[label]}</p>` (line ~340) with a `<div className="answer-body">` wrapping `<ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeAnswerText(answerResponse.answers[label])}</ReactMarkdown>` — identical for every label.
- [x] 3.3 In `web/app/globals.css`, update `.answer-card`: add `align-content: start;` (fix short-card gap). Replace the `.answer-card p` block with `.answer-body` markdown styles (paragraph spacing, `ul/ol` list indent, `line-height: 1.75`, keep `color: #1e293b`); ensure list markers render.
- [x] 3.4 Verify build: `cd web && npm run typecheck && npm run lint && npm run build` → all pass.

## 4. Loading feedback during generation (Option 1)

- [x] 4.1 In `question-flow.tsx`, add a conditional block after the prompt form: when `isLoading && !answerResponse`, render `<div className="answer-loading">` with a CSS spinner + text `正在產生回答,約需數秒…`.
- [x] 4.2 In `globals.css`, add `.answer-loading` (centered flex column, gap) and a CSS `@keyframes spin` spinner (`.answer-spinner`).
- [x] 4.3 Verify build: `cd web && npm run typecheck && npm run lint && npm run build` → all pass.

## 5. End-to-end verification

- [x] 5.1 Re-run all checks together: `cd web && npm run verify:answer-display && npm run typecheck && npm run lint && npm run build`.
- [x] 5.2 Verification of answer rendering: (b)(c)(e) verified at render level via `react-dom/server` against representative inputs (plain-text single newline → `<br>`, bold → `<strong>`, `1. 2.` → `<ol><li>`, GFM table, `<script>` sanitized); (a) `align-content: start` is a pure CSS change verified by build; (d) spinner gated on `isLoading && !answerResponse`, verified by code + build. NOTE: pixel-level in-browser verification of the rendered cards is deferred to a gateway-configured environment — local has no `SHARED_INVITE_CODE` / LLM gateway, so the participant flow cannot reach the comparison screen locally.

## 6. Post-review fixes (from /opsxp-verify multi-perspective review)

- [x] 6.1 W2 (copy): in `web/components/evaluation/question-flow.tsx` change the loading message half-width comma `正在產生回答,約需數秒…` → full-width `正在產生回答，約需數秒…` (match every other Chinese string in the file). Update the matching scenario text in `specs/blind-evaluation-app/spec.md` and the mention in `design.md` to the full-width form for consistency.
- [x] 6.2 S1 RED: add CRLF assertions to `web/scripts/verify-answer-display.ts` — `normalizeAnswerText("a\r\n\r\n\r\n\r\nb") === "a\n\nb"` and a lone-`\r` run case; run `cd web && npm run verify:answer-display` → FAILS (CRLF run survives uncollapsed).
- [x] 6.3 S1 GREEN: in `web/lib/evaluation/answer-display.ts` normalize line endings before collapsing — `text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()`; run `cd web && npm run verify:answer-display` → ALL PASS.
- [x] 6.4 W1 (blind-eval integrity): in `web/app/globals.css` add `.answer-body { overflow-wrap: anywhere; }` and `.answer-body img { max-width: 100%; height: auto; }` so a model-emitted image or long unbroken token cannot blow a card's width and leak a presentation cue. Add a scenario "Rendered media does not blow out a card" to the `Answer comparison presentation` requirement in `specs/blind-evaluation-app/spec.md`.
- [x] 6.5 S2 (refactor): hoist `const ANSWER_REMARK_PLUGINS = [remarkGfm, remarkBreaks]` to module scope in `question-flow.tsx` and reference it in the three-card `<ReactMarkdown>` to avoid re-allocating the array on every render.
- [x] 6.6 Verify: `cd web && npm run verify:answer-display && npm run typecheck && npm run lint && npm run build` all pass; re-run `openspec validate "improve-answer-comparison-display" --type change --strict`.
