## Context

`web/app/api/evaluation/answers/route.ts` creates one `PendingQuestion` row per `(participantToken, questionIndex)` on POST and enforces uniqueness with HTTP 409. The pending row is the source of truth for resume-after-refresh: `GET /api/session` (`web/app/api/session/route.ts:88`) returns the first pending row to the client, which rehydrates `QuestionFlow` with an `initialAnswerResponse`.

Today, `resetForQuestion()` in `web/components/evaluation/question-flow.tsx:133` only clears React state. So the server still considers the question pending, blocking re-submits with 409 and silently restoring the stale comparison view on refresh.

This is a small, localized correctness fix to an already-shipped feature. A delete path for the pending row is the cleanest expression of "reset" — it converges client and server back to the same pre-submit state.

## Goals / Non-Goals

**Goals:**
- A reset click reliably discards both client-side state and the server-side pending row for the current participant.
- Idempotency: pressing reset when there is no pending row (e.g. race after refresh) is a no-op success, not an error the user has to recover from.
- Auth boundary stays tight: only the owning participant's session can delete their own pending row.
- POST 409 guard against accidental double-submits stays in place.

**Non-Goals:**
- No changes to evaluation record storage, judgment flow, or admin views.
- No support for deleting pending rows belonging to other participants, or admin-side cleanup.
- No history of resets — we don't audit-log the action; it has no research value.

## Decisions

### D1: Delete endpoint shape — `DELETE /api/evaluation/answers` with `{ questionId }` in body

Rationale: keeps the route file co-located with the existing POST handler that owns pending lifecycle. The single resource id is the only identifier the client carries (`AnswerResponse.questionId`), so a body-payload DELETE is clearer than overloading query params.

Alternatives considered:
- `DELETE /api/evaluation/answers/[questionId]` (dynamic segment). Cleaner REST shape, but requires a new file (`[questionId]/route.ts`) just for one verb. Cost outweighs benefit for a single-call surface.
- Relax POST to overwrite an existing pending row of the same `(participantToken, questionIndex)`. Smaller diff, but weakens the 409 idempotency check that currently protects against double-submits and accidental LLM cost.

### D2: Ownership check lives in the storage helper, not the route

`deletePendingQuestion(questionId, participantToken)` returns a typed result (`{ status: "deleted" | "not_found" | "forbidden" }`) so the route maps it to 204 / 204 / 403 consistently. Putting the check in the helper keeps the storage layer the single owner of "what counts as authorized mutation," matching how `saveEvaluationRecord` and `savePendingQuestion` are already the gatekeepers for write semantics.

`not_found` returns 204 (not 404) because reset must be idempotent from the client's view — a missing row means "already in the target state," which is success.

### D3: Frontend resets local state only after the server confirms

`resetForQuestion` becomes async: it awaits the DELETE call first, then clears state. On non-2xx it shows a toast and leaves the comparison view intact so the participant isn't stranded with neither client state nor a way to resume. The button stays disabled (`isLoading`) during the in-flight call.

Alternative considered: fire-and-forget DELETE while clearing state optimistically. Rejected — if the DELETE fails (network blip, server error), the participant ends up with a stale server pending and no signal that a refresh will resurrect it. The user-visible cost of a 300 ms wait is much smaller than the cost of a confused participant during a research session.

### D4: Skip rate limiting on DELETE

DELETE doesn't call the LLM gateway and only removes a row owned by the requester's session. The existing IP/session rate limits on POST already cap how often a participant can churn pending rows.

## Risks / Trade-offs

- **Race: participant clicks reset twice quickly.** First DELETE removes the row, second hits `not_found`. Mitigation: `not_found` → 204, frontend treats both as success and clears state once.
- **Race: reset clicks during in-flight POST.** Today the POST button is hidden once `answerResponse` is set, and reset is disabled via `isLoading`. The new DELETE inherits the same `isLoading` guard, so no new race surface.
- **Server crash between DELETE write and the participant's next POST.** The in-memory `memoryStore` is replaced first, then the file is written; a crash mid-write leaves the in-memory store ahead of disk. On restart the older disk snapshot is read back — the pending row may reappear and the next POST will hit 409. Acceptable for this single-instance research deployment; documenting the trade-off rather than introducing a write-ahead log.
- **Reset abuse to spam LLM regenerations.** Each new POST after reset costs one LLM call. Existing IP and session rate limits in `web/lib/server/rate-limit.ts` (configured via `config.limits.rateLimit.answerRequestsPerIpPerMinute` / `...PerSessionPerMinute`) already bound this — no extra limiter needed.

## Migration Plan

No data migration. The fix is purely additive (one new route verb, one new helper, one wired-up button). Roll forward by deploying the change; on the rare chance an old client without the DELETE call is in the field, behavior is unchanged from today (the reset bug persists for that client only).
