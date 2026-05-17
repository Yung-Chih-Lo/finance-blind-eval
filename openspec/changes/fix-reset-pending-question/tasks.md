## File Plan

- **Modify**: `web/lib/server/evaluation-storage.ts` — add `deletePendingQuestion(questionId, participantToken)` returning `{ status: "deleted" | "not_found" | "forbidden" }`.
- **Modify**: `web/app/api/evaluation/answers/route.ts` — add `DELETE` handler that requires session, parses `{ questionId }` body, calls the helper, and maps result to 204 / 204 / 403.
- **Modify**: `web/components/evaluation/question-flow.tsx` — convert `resetForQuestion` to `async`, call `DELETE /api/evaluation/answers`, only clear state on success; show toast on failure.
- **Create**: `web/scripts/verify-reset-pending.ts` — assert-based unit checks against `deletePendingQuestion` covering deleted / not_found / forbidden paths.
- **Create**: `web/scripts/verify-reset-pending-flow.mjs` — HTTP smoke test against a running dev server: POST → DELETE → POST same question index succeeds; refresh-equivalent `GET /api/session` returns no `pendingQuestion` after delete.
- **Modify**: `web/scripts/verify-tsconfig.json` — add the new TS verify file + `evaluation-storage.ts` to `include`.
- **Modify**: `web/package.json` — add `verify:reset-pending` script wrapping the existing TS compile + node loader pattern.

## 1. Storage helper (TDD — pure in-memory state)

- [x] 1.1 RED: write `web/scripts/verify-reset-pending.ts` that imports `savePendingQuestion`, `deletePendingQuestion`, `getPendingQuestionsByParticipant`, `resetEvaluationData`; seed one pending row for participant `P-OWNER` with `questionId="q-1"`, then assert `deletePendingQuestion("q-1", "P-OWNER")` returns `{ status: "deleted" }` and the participant has zero pending rows. Compile fails because `deletePendingQuestion` is not exported.
- [x] 1.2 Verify RED: `cd web && npx tsc -p scripts/verify-tsconfig.json` → fails on missing export.
- [x] 1.3 GREEN: in `web/lib/server/evaluation-storage.ts`, add `export async function deletePendingQuestion(questionId: string, participantToken: string): Promise<{ status: "deleted" | "not_found" | "forbidden" }>`. Implement inside `withStoreMutex`: read store, find row by `id === questionId`; if missing → `not_found`; if `participantToken !== normalizeToken(participantToken)` mismatch with row's `participantToken` → `forbidden`; otherwise filter the row out and `writeStore`.
- [x] 1.4 Add `verify:reset-pending` script to `web/package.json` (mirror `verify:provider-url` pattern: `tsc -p scripts/verify-tsconfig.json && node --experimental-loader=./scripts/.verify-loader.mjs scripts/.verify-out/scripts/verify-reset-pending.js`).
- [x] 1.5 Update `web/scripts/verify-tsconfig.json` `include` to add `verify-reset-pending.ts` and `../lib/server/evaluation-storage.ts`.
- [x] 1.6 Verify GREEN: `cd web && npm run verify:reset-pending` → PASS for the deleted-row case.
- [ ] 1.7 Extend the verify script with the `not_found` case: after the first delete, call `deletePendingQuestion("q-1", "P-OWNER")` again, assert `{ status: "not_found" }` and zero pending rows.
- [ ] 1.8 Extend with `forbidden` case: seed `q-2` for `P-OWNER`, call `deletePendingQuestion("q-2", "P-OTHER")`, assert `{ status: "forbidden" }` and that `q-2` is still in storage.
- [ ] 1.9 Run `npm run verify:reset-pending` → all three cases PASS.

## 2. DELETE route handler

- [ ] 2.1 RED: write `web/scripts/verify-reset-pending-flow.mjs` (mirror `verify-invite-flow.mjs` style) — start a dev server externally; the script issues a redeem to get a session cookie, posts a profile, posts a question to get `{ questionId, ... }`, then `DELETE /api/evaluation/answers` with `{ questionId }`; assert HTTP 204 and that a subsequent `GET /api/session` returns `pendingQuestion: null`. Run it once and confirm it fails (route returns 405 because DELETE is unimplemented).
- [ ] 2.2 Verify RED: `node web/scripts/verify-reset-pending-flow.mjs` → fail on DELETE.
- [ ] 2.3 GREEN: in `web/app/api/evaluation/answers/route.ts`, export `async function DELETE(request: Request)`. Steps: call `requireEvaluationSession(request)` → 401 if absent; parse JSON body, validate `questionId` is a non-empty string → 400 otherwise; call `deletePendingQuestion(questionId, activeSession.participant.token)`; map `deleted`/`not_found` → `new NextResponse(null, { status: 204 })`, `forbidden` → 403 JSON `{ error: "You cannot delete another participant's pending question." }`.
- [ ] 2.4 Verify GREEN: re-run `verify-reset-pending-flow.mjs` → PASS on the delete and the session-cleared assertions.
- [ ] 2.5 Extend the smoke test with the re-submit case: after DELETE, POST the same `questionIndex` again and assert HTTP 200 (no 409). Verify PASS.
- [ ] 2.6 Extend with auth case: DELETE without a session cookie → 401. Verify PASS.

## 3. Frontend reset wiring

- [ ] 3.1 In `web/components/evaluation/question-flow.tsx`, change `resetForQuestion` from sync to `async function resetForQuestion()`. Guard with `if (!answerResponse) { clear-local-state-only; return }` so reset before a question is submitted still works.
- [ ] 3.2 Set `setIsLoading(true)` before the call; in a `try` block call `fetch("/api/evaluation/answers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: answerResponse.questionId }) })`. If `!response.ok` throw with the server's error message (parse JSON best-effort, fall back to `"目前無法重設本題，請稍後再試。"`).
- [ ] 3.3 On success, run the existing local-clear block (the original body of `resetForQuestion`). On error catch, `toast.error(message)` and DO NOT clear local state.
- [ ] 3.4 In `finally`, `setIsLoading(false)`.
- [ ] 3.5 Confirm the reset button at `web/components/evaluation/question-flow.tsx:379` already has `disabled={isLoading}` (it does) — no JSX change needed there.
- [ ] 3.6 Run `cd web && npm run typecheck` → PASS.
- [ ] 3.7 Run `cd web && npm run lint` → PASS.

## 4. End-to-end manual verification

- [ ] 4.1 `cd web && npm run dev`, redeem invite, complete profile, submit a question, click 「重新輸入本題」 — verify the input is reset to empty and the comparison panel is gone.
- [ ] 4.2 Re-submit the same question text — verify A/B/C answers appear without any 409 toast.
- [ ] 4.3 After clicking 「重新輸入本題」 and before re-submitting, hard-refresh the browser — verify the page lands on the empty input view (not the prior A/B/C panel).
- [ ] 4.4 Tail server logs while doing 4.1–4.3 — confirm DELETE returns 204 and POST returns 200 the second time.

## 5. Self-review before archive

- [ ] 5.1 Re-read `proposal.md`, `design.md`, `specs/blind-evaluation-app/spec.md`, `tasks.md` — confirm each spec scenario maps to at least one task.
- [ ] 5.2 Grep `web/` for residual `"This question is already pending judgment."` matches — only the POST 409 path should reference it; reset should no longer trigger it under normal flow.
- [ ] 5.3 Run `openspec validate fix-reset-pending-question --strict` (or fallback to `openspec validate fix-reset-pending-question`) — confirm change is valid.
