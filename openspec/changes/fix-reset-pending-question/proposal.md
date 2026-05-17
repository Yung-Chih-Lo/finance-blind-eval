## Why

When a participant clicks 「重新輸入本題」 after answers were already generated, the front-end clears local state and routes back to the question input — but the server-side `pendingQuestion` row stays put. Two regressions follow: (1) re-submitting the same question is blocked by the existing `(participantToken, questionIndex)` uniqueness check with HTTP 409 `This question is already pending judgment.`; (2) a page refresh re-hydrates the stale A/B/C comparison view because `GET /api/session` rehydrates from the pending row. The reset action must therefore discard server-side pending state too.

## What Changes

- Add a participant-scoped delete path for an in-flight pending question (server route + storage helper) so 「重新輸入本題」 has somewhere to call.
- Wire the reset button in the question flow to await the delete call before clearing local state; on failure, surface a toast and keep current state so the participant doesn't end up wedged.
- Preserve the existing POST-side 409 idempotency guard against accidental double-submits — only the reset path should remove pending rows.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `blind-evaluation-app`: the `Guided flexible prompt flow` requirement gains a "reset clears server pending" scenario, and `Server-mediated model answer generation` gains a delete-pending scenario covering ownership and session checks.

## Impact

- Code: `web/lib/server/evaluation-storage.ts`, `web/app/api/evaluation/answers/route.ts`, `web/components/evaluation/question-flow.tsx`.
- APIs: new `DELETE /api/evaluation/answers` (body: `{ questionId }`); existing POST behavior unchanged.
- Storage: removes one row from `pendingQuestions` in `.data/evaluation-store.json` when reset is invoked.
- No new dependencies, no schema migration, no settings change.
