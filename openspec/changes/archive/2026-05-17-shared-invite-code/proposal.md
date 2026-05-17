## Why

研究分發單張 QR code 比一人一張容易得多，但目前系統設計是「一人一組一次性邀請碼」，研究者必須產生 N 張碼、印 N 張 QR、用試算表追蹤。受測者也常因為碼用過了而誤判系統故障。系統目前尚未公開招募，仍在設計階段，是把這層脫鉤改成「全研究共用一組邀請碼」的最後機會。

匿名 participant token (`P-XXXXXXXX`) 在後端早已自動產生，因此「邀請碼」這層除了驗證身份外沒有提供額外資訊；改成單一固定字串即可滿足進入控管，並讓 QR 分發退化為單張靜態圖片。

## What Changes

- **BREAKING**: 移除整套 invite-codes 表與相關 storage / API / admin UI（包含 `InviteCodeRecord`、`createInviteCodes`、`redeemInviteCode` 內部對 hash 表的查詢、`/api/admin/invites` 路由與 `AdminInviteActions` 元件）
- **BREAKING**: 邀請碼驗證改為比對環境變數 `SHARED_INVITE_CODE`（部署值 `ailab502`，缺值時 admin API 與 redeem API 直接 503）
- **BREAKING**: 進入網址改用 `/?invite_code=<code>` —— 拿掉 `/eval` 的根層跳板，並把 query param 從 `invite` rename 為 `invite_code`
- 完成測驗時 set `eval_completed=1` cookie（`Max-Age=365d`, `SameSite=Lax`, `HttpOnly`），下次進入時 server-side 偵測該 cookie 並顯示「已完成測驗」終端頁，徹底不顯示邀請碼欄位
- `redeem-invite` API 在 cookie 已存在時直接回 403，作為前端硬擋的二次防線
- Admin Settings 區改為唯讀顯示「目前共用邀請碼」與一張可下載的 QR（從環境變數即時生成，不寫入磁碟）
- `EvaluationSession`、`ParticipantStatus` 等型別中與 `inviteId` 相關的欄位移除；funnel 的 `Invited` 階段移除（改為 4 階段：Redeemed / Profile / Answered / Completed）

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `blind-evaluation-app`: 邀請流程從「一人一組一次性碼 + 後台批次產生」改為「環境變數固定共用碼 + cookie 硬擋重入」；admin 的「邀請碼」分頁從產生器改為唯讀展示；funnel 移除 Invited 階段。

## Impact

**Code 移除（高信心）**:
- `web/lib/server/evaluation-storage.ts` — `createInviteCodes`、`redeemInviteCode`、`getInviteCodes`、`hashInviteCode`、`normalizeInviteCode` 全砍；`EvaluationStore.invites` 欄位刪除；`computeFunnelStages` 拿掉 `invited` 計算
- `web/lib/evaluation/types.ts` — `InviteCodeRecord`、`EvaluationStore.invites`、`AdminSnapshot.invites`、`AdminFunnelStages.invited`、`ParticipantStatus.inviteId`、`EvaluationSession.inviteId` 全部移除
- `web/app/api/admin/invites/route.ts` — 整檔刪除
- `web/components/evaluation/admin-invite-actions.tsx` — 整檔刪除
- `web/components/admin/funnel.tsx` — 移除 `invited` STAGE_ORDER 項目
- `web/app/admin/page.tsx` — 移除 `inviteCapacityTotal`、`AdminInviteActions` 引用，邀請碼 tab 換成新的唯讀 panel
- `web/app/api/admin/export/route.ts`（若有）— JSON export 拿掉 invites 區段

**Code 改寫**:
- `web/app/api/session/redeem-invite/route.ts` — 改為比對 `process.env.SHARED_INVITE_CODE`
- `web/app/page.tsx` — 從 `redirect("/eval")` 改為渲染 EvaluationApp（並讀取 `eval_completed` cookie 決定是否顯示終端頁）
- `web/app/eval/page.tsx` — 刪除（合併到 `/`）或保留 redirect 至 `/`
- `web/components/evaluation/evaluation-app.tsx` — `initialInviteCode` prop 從 `invite` 改為 `invite_code` 參數來源；完成時呼叫新 API set cookie
- `web/components/evaluation/token-entry.tsx` — UI 字串可保留（仍寫「邀請碼」）

**Env / Deploy**:
- 新增 `SHARED_INVITE_CODE` env var（值 `ailab502`），需於 Zeabur dashboard 設定
- 缺值時：app 不會 crash，但 redeem API 回 503、admin QR panel 顯示「未設定」狀態

**資料**:
- `.data/evaluation-store.json` 既存資料的 `invites: [...]` 欄位將被忽略（讀取時不複製到新 store）；participants 中既有的 `inviteId` 欄位讀取時忽略
- 不需要 migration 腳本（仍在 design 階段、無線上資料）

**測試**:
- 既有 redeem-invite / invite generation 測試需移除或改寫
- 新增 cookie 硬擋的 server-side 行為測試
