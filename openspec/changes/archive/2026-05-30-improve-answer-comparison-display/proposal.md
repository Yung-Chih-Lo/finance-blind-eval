## Why

The A/B/C answer comparison cards have three participant-facing display problems that hurt readability and perceived professionalism of the blind-eval tool: (1) shorter answers (e.g. answer C) render with a large empty gap under the label because the grid card stretches its rows to fill `min-height`; (2) model answers are shown as raw text, so any markdown a model emits (`**bold**`, headings, lists, tables) appears literally instead of formatted; (3) after submitting a question the participant sees only a tiny "..." on the send button while all three models generate, which reads as a frozen UI.

## What Changes

- Fix the empty-gap layout bug on answer cards so content is top-aligned regardless of answer length (the short-answer card no longer pushes its text down).
- Render all three answers (A/B/C) through a markdown renderer **uniformly** — every answer goes through the same pipeline so no model gains a presentation advantage in the blind comparison. Existing plain-text answers (full-width numbered lists, single-newline line breaks) must keep their line breaks.
- Normalize answer text before display (collapse 3+ consecutive blank lines, trim) as a defensive measure against model-emitted whitespace runs.
- Show an in-flight loading state after the participant submits a question: keep the current "wait until all three answers are ready, then reveal the comparison panel" behavior, but display a centered spinner plus a "正在產生回答，約需數秒…" message during generation so the wait is legible. (No streaming; the answers API still returns all three at once.)

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `blind-evaluation-app`: add a participant-facing answer-presentation requirement covering uniform markdown rendering of A/B/C answers, whitespace/layout normalization so card content is top-aligned, and a visible loading indicator during server-mediated answer generation. No change to generation, mapping, judgment, storage, or admin requirements.

## Impact

- `web/components/evaluation/question-flow.tsx` — render answers via a markdown component, normalize text, add the loading spinner UI during `isLoading`.
- `web/app/globals.css` — fix `.answer-card` row stretch (top-align content), markdown element styles inside `.answer-card`, spinner styles.
- `web/package.json` — add `react-markdown`, `remark-gfm` (GFM tables/lists/strikethrough/autolinks), and `remark-breaks` (preserve single-newline line breaks from existing plain-text answers). No existing dependency covers markdown rendering.
- No backend / API / data-schema changes. The answers route still returns all three answers in one response; blinding, mapping, and storage are untouched.
- Research-validity note: markdown is applied identically to all three answers to avoid introducing a presentation confound into the blind comparison.
