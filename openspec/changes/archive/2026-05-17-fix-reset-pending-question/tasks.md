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
- [x] 1.7 Extend the verify script with the `not_found` case: after the first delete, call `deletePendingQuestion("q-1", "P-OWNER")` again, assert `{ status: "not_found" }` and zero pending rows.
- [x] 1.8 Extend with `forbidden` case: seed `q-2` for `P-OWNER`, call `deletePendingQuestion("q-2", "P-OTHER")`, assert `{ status: "forbidden" }` and that `q-2` is still in storage.
- [x] 1.9 Run `npm run verify:reset-pending` → all three cases PASS.

## 2. DELETE route handler

**Strategy note**: an automated HTTP smoke test for the full POST→DELETE→POST flow needs a running dev server with a live LLM gateway configured (POST hits `generateBlindAnswers`). That's too heavy for this fix. The route stays thin (parse → call storage helper → map status to NextResponse); business policy lives in `deletePendingQuestion`, which is already covered by section 1's verify script. The HTTP wiring itself is validated by section 4 manual end-to-end testing.

- [x] 2.1 Add `DELETE` export to `web/app/api/evaluation/answers/route.ts` with signature `export async function DELETE(request: Request)`.
- [x] 2.2 In the handler: call `await requireEvaluationSession(request)`; if absent, return `NextResponse.json({ error: "Invite session is required." }, { status: 401 })`.
- [x] 2.3 Parse the JSON body. If parsing fails or `questionId` is not a non-empty string, return `NextResponse.json({ error: "questionId is required." }, { status: 400 })`.
- [x] 2.4 Call `deletePendingQuestion(questionId, activeSession.participant.token)`. Map results: `"deleted"` and `"not_found"` → `new NextResponse(null, { status: 204 })`; `"forbidden"` → `NextResponse.json({ error: "You cannot delete another participant's pending question." }, { status: 403 })`.
- [x] 2.5 Import `deletePendingQuestion` from `@/lib/server/evaluation-storage` alongside the existing storage imports at the top of the route file.
- [x] 2.6 Run `cd web && npm run typecheck` → PASS (catches signature mistakes; route handlers are otherwise covered by section 4 manual UI testing).

## 3. Frontend reset wiring

- [x] 3.1 In `web/components/evaluation/question-flow.tsx`, change `resetForQuestion` from sync to `async function resetForQuestion()`. Guard with `if (!answerResponse) { clear-local-state-only; return }` so reset before a question is submitted still works.
- [x] 3.2 Set `setIsLoading(true)` before the call; in a `try` block call `fetch("/api/evaluation/answers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: answerResponse.questionId }) })`. If `!response.ok` throw with the server's error message (parse JSON best-effort, fall back to `"目前無法重設本題，請稍後再試。"`).
- [x] 3.3 On success, run the existing local-clear block (the original body of `resetForQuestion`). On error catch, `toast.error(message)` and DO NOT clear local state.
- [x] 3.4 In `finally`, `setIsLoading(false)`.
- [x] 3.5 Confirm the reset button at `web/components/evaluation/question-flow.tsx:379` already has `disabled={isLoading}` (it does) — no JSX change needed there. (Bonus: replaced the `resetForQuestion()` call inside `saveJudgment`'s success path with `clearQuestionState()` since the pending row is already consumed by `saveEvaluationRecord` — avoids a wasted DELETE roundtrip.)
- [x] 3.6 Run `cd web && npm run typecheck` → PASS.
- [x] 3.7 Run `cd web && npm run lint` → PASS.

## 4. End-to-end manual verification

- [ ] 4.1 `cd web && npm run dev`, redeem invite, complete profile, submit a question, click 「重新輸入本題」 — verify the input is reset to empty and the comparison panel is gone.
- [ ] 4.2 Re-submit the same question text — verify A/B/C answers appear without any 409 toast.
- [ ] 4.3 After clicking 「重新輸入本題」 and before re-submitting, hard-refresh the browser — verify the page lands on the empty input view (not the prior A/B/C panel).
- [ ] 4.4 Tail server logs while doing 4.1–4.3 — confirm DELETE returns 204 and POST returns 200 the second time.

## 5. Self-review before archive

- [x] 5.1 Re-read `proposal.md`, `design.md`, `specs/blind-evaluation-app/spec.md`, `tasks.md` — confirm each spec scenario maps to at least one task. Mapping: reset-success scenario → 1.3 + 2.1–2.5 + 3.1–3.5; reset-failure scenario → 3.3; owner-delete scenario → 1.3 + 2.4; delete-without-session → 2.2; cross-participant-delete → 1.3 + 2.4; unknown-id-delete (idempotent 204) → 1.3 + 2.4.
- [x] 5.2 Grep `web/` for residual `"This question is already pending judgment."` matches — only the POST 409 path (`web/app/api/evaluation/answers/route.ts:98`) references it. Reset path no longer triggers this string.
- [x] 5.3 Run `openspec validate fix-reset-pending-question --strict` — output: `Change 'fix-reset-pending-question' is valid`.

## 6. Verify-driven follow-ups (post `/opsxp-verify`)

- [x] 6.1 Fix token normalization asymmetry in `deletePendingQuestion` (`web/lib/server/evaluation-storage.ts:262`) — compare normalized to normalized so the row can still be deleted if a future writer stores a non-uppercase token.
- [x] 6.2 Add lowercase-token coverage to `verify-reset-pending.ts` (new case `1.10 normalize`) so the normalize branch is locked in against regressions.
- [x] 6.3 Comment the implicit `record.id === pending.id` contract on `saveEvaluationRecord` (`web/lib/server/evaluation-storage.ts:277`) so a future record-id refactor won't silently leak pending rows.
- [x] 6.4 Comment the `not_found → 204` idempotency collapse on the DELETE handler (`web/app/api/evaluation/answers/route.ts`) so a future maintainer doesn't "fix" it to 404.
- [x] 6.5 Comment the `clearQuestionState` extraction rationale in `question-flow.tsx` so the saveJudgment-skips-DELETE shortcut is discoverable from code, not just tasks.md.
