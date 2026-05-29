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

- [ ] 3.1 In `web/components/evaluation/question-flow.tsx`, import `ReactMarkdown`, `remarkGfm`, `remarkBreaks`, and `normalizeAnswerText`.
- [ ] 3.2 Replace `<p>{answerResponse.answers[label]}</p>` (line ~340) with a `<div className="answer-body">` wrapping `<ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeAnswerText(answerResponse.answers[label])}</ReactMarkdown>` — identical for every label.
- [ ] 3.3 In `web/app/globals.css`, update `.answer-card`: add `align-content: start;` (fix short-card gap). Replace the `.answer-card p` block with `.answer-body` markdown styles (paragraph spacing, `ul/ol` list indent, `line-height: 1.75`, keep `color: #1e293b`); ensure list markers render.
- [ ] 3.4 Verify build: `cd web && npm run typecheck && npm run lint && npm run build` → all pass.

## 4. Loading feedback during generation (Option 1)

- [ ] 4.1 In `question-flow.tsx`, add a conditional block after the prompt form: when `isLoading && !answerResponse`, render `<div className="answer-loading">` with a CSS spinner + text `正在產生回答,約需數秒…`.
- [ ] 4.2 In `globals.css`, add `.answer-loading` (centered flex column, gap) and a CSS `@keyframes spin` spinner (`.answer-spinner`).
- [ ] 4.3 Verify build: `cd web && npm run typecheck && npm run lint && npm run build` → all pass.

## 5. End-to-end verification

- [ ] 5.1 Re-run all checks together: `cd web && npm run verify:answer-display && npm run typecheck && npm run lint && npm run build`.
- [ ] 5.2 Manual/preview verification of participant flow: (a) short answer card is top-aligned, no gap; (b) a markdown answer renders formatted; (c) an existing plain-text answer (full-width numbered list, single newlines) keeps per-line breaks; (d) after submit, the centered spinner + message shows, then the comparison panel reveals; (e) all three cards render through the same markdown styling.
