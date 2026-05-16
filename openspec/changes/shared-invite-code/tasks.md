## File Plan

**Create**:
- `web/lib/server/shared-invite.ts` — single source for `getSharedInviteCode()` reading `process.env.SHARED_INVITE_CODE`
- `web/app/api/admin/invite-qr/route.ts` — server route returning the live QR SVG + plaintext code for the admin tab

**Modify**:
- `web/app/page.tsx` — replace redirect; render EvaluationApp or completion-terminal based on cookie
- `web/app/eval/page.tsx` — convert to 301 redirect to `/`
- `web/app/api/session/redeem-invite/route.ts` — env-var comparison + cookie guard
- `web/app/api/evaluation/answers/route.ts` (or wherever `completionStatus = "completed"` is set) — set `eval_completed` cookie on completion response
- `web/components/evaluation/evaluation-app.tsx` — read `invite_code` searchParam name
- `web/components/evaluation/token-entry.tsx` — no logic change but verify autofill works
- `web/components/evaluation/admin-invite-actions.tsx` — replace contents with read-only QR + code panel
- `web/components/admin/funnel.tsx` — drop `invited` stage
- `web/lib/server/evaluation-storage.ts` — remove invite-codes storage, drop `invites` from `EvaluationStore`, `AdminSnapshot`, export JSON
- `web/lib/evaluation/types.ts` — remove `InviteCodeRecord`, `ParticipantStatus.inviteId`, `EvaluationSession.inviteId`, `AdminSnapshot.invites`, `AdminFunnelStages.invited`, `EvaluationStore.invites`
- `web/app/admin/page.tsx` — drop `inviteCapacityTotal`; keep admin invite tab pointing at refactored panel
- `web/app/api/session/route.ts` — drop `inviteId` propagation
- `web/app/api/evaluation/records/route.ts` — drop `inviteId` propagation
- `web/package.json` — remove `invites:create` script entry
- `web/CLAUDE.md` (project deployment notes) — add `SHARED_INVITE_CODE` to env list

**Delete**:
- `web/app/api/admin/invites/route.ts`
- `web/scripts/create-invites.mjs`

---

## 1. Wiring SHARED_INVITE_CODE env var

- [x] 1.1 Create `web/lib/server/shared-invite.ts` exporting `getSharedInviteCode(): string | null` that trims `process.env.SHARED_INVITE_CODE` and returns `null` when empty
- [x] 1.2 Add a `SHARED_INVITE_CODE` entry to local `.env.example` (or comment in CLAUDE.md if no example file exists) with value `ailab502`
- [x] 1.3 Update `web/CLAUDE.md` env section to list `SHARED_INVITE_CODE` under "Configured" (also note for Zeabur dashboard)
- [x] 1.4 Verify: `grep -r SHARED_INVITE_CODE web/lib web/app | wc -l` is ≥1; `cd web && npm run typecheck` passes

## 2. Redeem-invite API rewrite

- [x] 2.1 In `web/app/api/session/redeem-invite/route.ts`, replace `redeemInviteCode` call with: read `SHARED_INVITE_CODE`, return 503 if null
- [x] 2.2 In the same route, before validating code, read `eval_completed` cookie via `cookies()`; return 403 `{ error: "本裝置已完成測驗。" }` when present
- [x] 2.3 Compare submitted `inviteCode.trim()` (case-insensitive) against `SHARED_INVITE_CODE`; on mismatch return 403 `{ error: "邀請碼不正確。" }`
- [x] 2.4 On match, generate `P-XXXXXXXX` token + session as before (extract participant/session creation into a small helper inside `evaluation-storage.ts` or keep inline)
- [x] 2.5 Keep existing IP rate-limit `checkRateLimit("invite:ip:<ip>")` ahead of cookie check
- [ ] 2.6 Verify manually: `curl -X POST localhost:3000/api/session/redeem-invite -H 'Content-Type: application/json' -d '{"inviteCode":"ailab502"}'` returns 200 with participant; same call with bad code returns 403; same call with `eval_completed=1` cookie returns 403

## 3. Completion cookie issuance

- [x] 3.1 Locate the response path where `completionStatus` becomes `"completed"` (likely `web/app/api/evaluation/answers/route.ts` or `records/route.ts` after final answer saved)
- [x] 3.2 When the response transitions a participant to `completed`, attach `Set-Cookie: eval_completed=1; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure` (Secure only in production — mirror `setSessionCookie` style in `lib/server/session.ts`)
- [ ] 3.3 Verify: complete a full 5-question run in browser; DevTools Application → Cookies shows `eval_completed=1`

## 4. Route consolidation (`/eval` → `/`)

- [x] 4.1 Rewrite `web/app/page.tsx` to a server component: load `getActivePlatformSettings()`, read `eval_completed` cookie from `cookies()`, read `invite_code` from `searchParams`
- [x] 4.2 If cookie present, render a minimal terminal component (reuse `CompletionPage` or a new `CompletedTerminalView`) — no EvaluationApp, no invite input
- [x] 4.3 If cookie absent, render `<EvaluationApp config={...} initialInviteCode={invite_code ?? ""} />` (same as today)
- [x] 4.4 Replace `web/app/eval/page.tsx` with a redirect: `redirect("/")` (or remove the file entirely if Next routing tolerates it)
- [ ] 4.5 Verify: open `/` → invite entry; open `/?invite_code=ailab502` → field pre-filled; open `/eval` → redirects to `/`

## 5. URL param rename `invite` → `invite_code`

- [x] 5.1 In page server component (`app/page.tsx`), read `searchParams.invite_code` (NOT `invite`)
- [x] 5.2 In `evaluation-app.tsx`, ensure the URL cleanup `router.replace(...)` after redeem also strips `invite_code` (currently it just calls `router.replace("/eval")`)
- [x] 5.3 Search for any string literal `invite=` in remaining code; replace with `invite_code=` where referring to the public URL param
- [ ] 5.4 Verify: `grep -rn "invite=" web/ --include='*.ts' --include='*.tsx'` returns no participant-facing matches

## 6. Server-rendered completion terminal view

- [x] 6.1 Decide: reuse existing `CompletionPage` (which expects to be inside `evaluation-app`) or extract a new `<CompletedTerminalView config={...} />` server component → reused `CompletionPage` (pure presentational, no client hooks)
- [x] 6.2 If extracting, place at `web/components/evaluation/completed-terminal-view.tsx`; render `config.study.title`, a "已完成測驗" headline, and a thank-you message — NO start button, NO invite input → reused existing CompletionPage instead
- [x] 6.3 Wire it into `app/page.tsx` branch
- [ ] 6.4 Verify: set `eval_completed=1` cookie in DevTools manually; reload `/` → terminal view shows, no invite field

## 7. Admin invite panel (read-only QR)

- [x] 7.1 Create `web/app/api/admin/invite-qr/route.ts` GET handler: read `SHARED_INVITE_CODE`; if null return 503 `{ error: "未設定共用邀請碼" }`; else build `${url.origin}/?invite_code=<code>`, render QR SVG via `QRCode.toString({type: "svg"})`, return `{ code, link, qrSvg }`
- [x] 7.2 Rewrite `web/components/evaluation/admin-invite-actions.tsx` to fetch `/api/admin/invite-qr` on mount and render: panel title, plaintext code, QR SVG (via `dangerouslySetInnerHTML`), one "下載 SVG" button (Blob download), error state when 503
- [x] 7.3 Drop the count input, baseUrl input, and "產生邀請碼" button entirely
- [ ] 7.4 Verify: `/admin?tab=invites` shows the code `ailab502`, the QR image, and a working download button; unsetting `SHARED_INVITE_CODE` locally shows the warning state

## 8. Remove `/api/admin/invites` route and CLI script

- [x] 8.1 Delete `web/app/api/admin/invites/route.ts`
- [x] 8.2 Delete `web/scripts/create-invites.mjs`
- [x] 8.3 Remove `"invites:create"` from `web/package.json` scripts
- [x] 8.4 Verify: `grep -rn "/api/admin/invites\|create-invites\|invites:create" web/ --include='*.ts' --include='*.tsx' --include='*.json' --include='*.mjs'` returns no hits

## 9. Storage layer cleanup

- [ ] 9.1 In `web/lib/server/evaluation-storage.ts`, remove: `createInviteCodes`, `getInviteCodes`, `redeemInviteCode`, `hashInviteCode`, `normalizeInviteCode` (keep `normalizeToken`, `hashSecret`)
- [x] 9.2 Extract participant + session creation (formerly inside `redeemInviteCode`) into a new exported `createAnonymousParticipantSession(options): { participant, sessionToken, session }`; called by the redeem-invite route in §2
- [ ] 9.3 Remove `invites` from `EMPTY_STORE`, `cloneStore`, `readStore` (still tolerate old JSON: just skip the key)
- [ ] 9.4 Remove `invites` from `EvaluationStore.invites`, `AdminSnapshot.invites`, `buildExportJson` (drop the `invites` field in JSON output)
- [ ] 9.5 In `computeFunnelStages`, drop the `invited` calculation and the `invites` parameter; return type now omits `invited`
- [ ] 9.6 Update `getAdminSnapshot` accordingly
- [ ] 9.7 Verify: `cd web && npm run typecheck` passes

## 10. Type cleanup

- [ ] 10.1 In `web/lib/evaluation/types.ts`, remove `InviteCodeRecord` interface
- [ ] 10.2 Remove `inviteId` from `ParticipantStatus`
- [ ] 10.3 Remove `inviteId` from `EvaluationSession`
- [ ] 10.4 Remove `invites: InviteCodeRecord[]` from `EvaluationStore` and `AdminSnapshot`
- [ ] 10.5 Remove `invited` from `AdminFunnelStages`
- [ ] 10.6 Verify: `cd web && npm run typecheck` passes (will catch any forgotten reader)

## 11. Drop inviteId propagation

- [ ] 11.1 In `web/app/api/session/route.ts`, drop the `inviteId: existing?.inviteId || activeSession.session.inviteId` line — `ParticipantStatus` no longer has the field
- [ ] 11.2 In `web/app/api/evaluation/records/route.ts`, same cleanup at line referencing `inviteId`
- [ ] 11.3 Verify: `grep -rn "inviteId" web/ --include='*.ts' --include='*.tsx'` returns no hits

## 12. Funnel UI update (5 → 4 stages)

- [ ] 12.1 In `web/components/admin/funnel.tsx`, remove the `{ id: "invited", label: "Invited" }` entry from `STAGE_ORDER`
- [ ] 12.2 In `web/app/admin/page.tsx`, remove `inviteCapacityTotal` (and any KPI tile referencing invite count)
- [ ] 12.3 Verify: admin dashboard `總覽` tab renders 4 funnel rows; no broken KPI tile

## 13. JSON export field cleanup

- [ ] 13.1 In `web/lib/server/evaluation-storage.ts` `buildExportJson`, drop the `invites: store.invites` line from the export object
- [ ] 13.2 Verify: `/api/admin/export?format=json` returns no `invites` key

## 14. Lint, typecheck, manual smoke

- [ ] 14.1 `cd web && npm run lint` — fix any warnings introduced
- [ ] 14.2 `cd web && npm run typecheck` — must pass
- [ ] 14.3 `cd web && npm run build` — must pass (Next dynamic page constraints)
- [ ] 14.4 Manual: start dev server (`npm run dev`), set `SHARED_INVITE_CODE=ailab502` in `.env.local`; walk through: `/` → input wrong code → 403 toast; correct code → profile form; complete 5 questions → completion page; reload `/` → terminal view; clear cookie → can re-enter

## 15. OpenSpec verify

- [ ] 15.1 Run `openspec validate shared-invite-code --strict` — must report valid
- [ ] 15.2 Run `openspec status --change shared-invite-code` — all artifacts done
