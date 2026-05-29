## Context

The participant answer-comparison view ([web/components/evaluation/question-flow.tsx](../../../web/components/evaluation/question-flow.tsx)) renders each answer as `<p>{answers[label]}</p>` with `white-space: pre-line` styling. Answers come from a single POST to `/api/evaluation/answers`, which calls all three models via `Promise.all` server-side and returns all three at once ([web/lib/server/gateway-client.ts](../../../web/lib/server/gateway-client.ts) already trims each answer's leading/trailing whitespace). There is no markdown dependency in the project today, and the only in-flight cue after submit is the send button text turning into "...".

This change is presentation-only: backend generation, blinding, mapping, judgment, and storage are untouched. The driving constraint is research validity — this is a blind-evaluation instrument, so any presentation treatment must be applied identically to all three answers.

## Goals / Non-Goals

**Goals:**
- Top-align answer-card content so a short answer (e.g. answer C) no longer shows a large empty gap below its label.
- Render all three answers as GitHub-flavored Markdown through one shared pipeline, preserving single-newline line breaks for existing plain-text answers.
- Show a clear, centered loading indicator during answer generation (wait-then-reveal, Option 1).

**Non-Goals:**
- No streaming / SSE (rejected: per-model stream-speed differences would become a visible quality cue and bias the blind comparison; also the largest engineering change).
- No per-card skeleton spinners (the API returns all three at once, so per-card progress would be cosmetic).
- No backend, API, data-schema, blinding, or admin changes.

## Decisions

### Layout gap fix: `align-content: start` on `.answer-card`
`.answer-card` is `display: grid` + `min-height: 280px`. Grid's default `align-content` is `stretch`, so when card content is shorter than `min-height`, free vertical space is distributed into the auto rows, pushing the `<p>` down. Adding `align-content: start` makes content top-aligned and keeps `min-height` as a visual floor. Chosen over removing `min-height` (keeps uniform card heights) and over switching to flexbox (smaller diff, same grid layout).

### Markdown rendering: `react-markdown` + `remark-gfm` + `remark-breaks`
No existing dependency renders markdown, so a library is justified. `react-markdown` is the standard, sanitizes by default (no raw HTML execution → no XSS from model output), and is tree-shakeable. `remark-gfm` adds tables, strikethrough, task lists, and autolinks. `remark-breaks` maps single newlines to `<br>`, which is required because existing answers are plain text with single-newline line breaks that standard markdown would otherwise collapse into spaces. All three answers pass through the *same* `<ReactMarkdown>` instance and the same CSS scope, satisfying the blind-fairness constraint.

Alternatives considered: (a) keep plain text — rejected, user wants formatted output; (b) hand-rolled regex markdown — rejected, fragile and unsafe; (c) `react-markdown` without `remark-breaks` — rejected, would silently reflow every existing plain-text answer.

### Text normalization before render
Normalize with `text.replace(/\n{3,}/g, "\n\n").trim()` at render time (client-side). Done at render rather than in the gateway so it also covers any already-stored pending answers and is a pure display concern. Server-side trim stays as-is.

### Loading UX: wait-then-reveal + centered spinner (Option 1)
Keep the existing control flow (`isLoading` gates the comparison panel on `answerResponse`). Add a conditional block: when `isLoading` and no `answerResponse`, render a centered spinner + "正在產生回答，約需數秒…". The send button already disables and shows "..."; the new block gives a prominent, legible wait state. CSS-only spinner (no animation library).

## Risks / Trade-offs

- [Markdown reflows existing plain-text answers] → `remark-breaks` preserves single-newline breaks; verify against a representative plain-text answer (full-width numbered list) that line structure is unchanged.
- [Markdown could let a model "look nicer"] → Mitigated by applying the identical renderer + styles to all three answers; this is the same treatment for every label, so it does not advantage any single model.
- [Bundle size from three remark packages] → Small, client-side, and the participant flow is the core of the app; acceptable.
- [`react-markdown` default sanitization strips raw HTML] → Acceptable/desirable for a participant-facing surface fed by model output (defense against HTML/script injection).

## Migration Plan

Pure additive UI change. Deploy via the normal PR→merge→Zeabur flow. No data migration, no env var, no volume change. Rollback = revert the PR (no persisted state depends on this change).
