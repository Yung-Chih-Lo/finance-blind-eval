## Context

平台目前用 invite-codes 表（`InviteCodeRecord`）管理一次性邀請碼。實際使用流程：研究者在 admin 後台批次產生 N 組 `XXXX-XXXX` 形式的碼，每組可生成一張 QR；受測者掃 QR → 落到 `/eval?invite=<code>` → 自動填入欄位 → POST `/api/session/redeem-invite` → 後端在 `redeemInviteCode` 用 SHA-256 hash 比對表中記錄 → 通過後遞增 `uses`、發 `P-XXXXXXXX` participant token、set session cookie。

`P-XXXXXXXX` 這層匿名 token 早已存在於 `createAnonymousParticipantToken()`，邀請碼僅作為「入場驗證」，並非身份識別。因此「一人一組」這個設計只增加了 QR 分發成本，沒有研究上的價值。

系統目前尚未公開招募（`.data/evaluation-store.json` 不存在線上參與者資料），是淨化此設計的最後窗口。部署平台為 Zeabur，環境變數可在 dashboard 設定。

## Goals / Non-Goals

**Goals:**
- 共用一組固定字串作為邀請碼，QR 變成一張靜態圖
- 邀請碼透過環境變數 `SHARED_INVITE_CODE` 供應，不寫死於程式碼也不存進 `platform-settings.json`
- 完成測驗後同瀏覽器硬擋重入；server 端 cookie 雙重防線阻擋繞過前端的 POST
- URL `?invite_code=<code>` 自動填入欄位；首頁路徑改為 `/`
- 後端 admin 介面保留邀請碼分頁，但僅顯示唯讀的碼與 QR 下載

**Non-Goals:**
- 不做 device fingerprint 等更強的反多開機制（cookie 被清會放行，這是設計選擇）
- 不支援同時運作兩組以上的邀請碼（單一字串）
- 不做歷史邀請碼資料 migration（清空 `.data/`）
- 不支援 admin 從介面修改邀請碼（要改就改 env var 並重新部署）

## Decisions

### D1: 邀請碼存於環境變數，不存 platform-settings.json

**選擇**: `process.env.SHARED_INVITE_CODE`，啟動時讀取。

**理由**:
- 部署即固定，admin 無法誤改線上邀請碼
- 不需要新增 platform-settings schema 欄位、不需要 API、不需要 admin 編輯 UI
- Zeabur 已支援透過 dashboard 注入 env var（與現有 `ADMIN_LINK_TOKEN` 等同模式）

**替代方案考量**:
- (a) 存 platform-settings → admin 可改但會多一條設定路徑，增加錯改風險，且必須處理 settings 還未初始化的情境
- (b) hardcode → 改邀請碼需發版，且 git 歷史會留下舊碼

**處理「未設定」**:
- 啟動時不 crash（`getActivePlatformSettings()` 等其他路徑不受影響）
- `redeem-invite` API 與 admin QR panel 在 `SHARED_INVITE_CODE` 為空時各自回應 503 / 顯示「未設定共用邀請碼」橫幅

### D2: 邀請碼比對採直接字串比較 + IP rate limit

**選擇**: 不 hash；大小寫不敏感且去除所有 Unicode whitespace + format 字元（`[\s\p{Cf}]+`），即兩側 normalize 後做 `===` 比較。最終實作為 `lib/server/shared-invite.ts` 的 `matchesSharedInviteCode()`。

**理由**:
- 碼是公開分發（印在 QR 旁邊），不是 secret，不需要 hash
- 仍維持 `checkRateLimit("invite:ip:<ip>")` 每 IP 每小時上限，避免被自動化爆掃 P-token

**替代方案考量**:
- 沿用現有 hash 邏輯 → 對共用碼沒有意義，僅增加複雜度

### D3: 完成測驗時 set `eval_completed=1` cookie，server-side 硬擋重入

**Cookie 屬性**:
- `Name`: `eval_completed`
- `Value`: `"1"`（不放 P-token，避免外洩 anonymization）
- `Max-Age`: 365 天（31536000 秒）
- `Path`: `/`
- `HttpOnly`: true
- `SameSite`: `Lax`
- `Secure`: production 為 true

**Set 時機**: 在記錄第 N 題（`completionStatus = "completed"`）的同一 server response 中 set，避免依賴 client 額外請求。

**擋的地方**:
1. `/` page server component 讀 cookie → 若存在 → 直接 render「已完成測驗」終端 UI，不渲染 EvaluationApp（避免閃爍與資料載入）
2. `POST /api/session/redeem-invite` 在進入正常流程前讀 cookie → 若存在 → 回 403 with `{ error: "本裝置已完成測驗。" }`（防止前端被繞）

**理由**:
- 純 cookie 比 IP 擋誤差小（NAT 後共用 IP 不誤傷）
- HttpOnly + SameSite=Lax 對 CSRF 與 JS 竊取有基本防護
- 受測者若真要再來一次，清 cookie 即可（符合使用者「不擋自己」的隱性需求）

**替代方案考量**:
- localStorage flag → JS 可改、不能被 server 讀，做不到二次防線
- IP 級擋 → 誤傷實驗室 / 咖啡廳同 NAT 群眾
- DB-side 紀錄「device fingerprint」→ 過度工程，超出研究需求

### D4: 完全移除 invite-codes 表與相關 schema

**選擇**: 不保留 `InviteCodeRecord` 型別、`invites` 欄位、`createInviteCodes` / `redeemInviteCode` 內 hash-table 查詢、`/api/admin/invites` 路由、`AdminInviteActions` 元件。

**理由**:
- 系統處於 design 階段、無線上資料、無向前相容需求
- 留著「死代碼」會誤導未來維護者以為仍可走批次邀請碼路徑
- `EvaluationStore.invites` 欄位移除後 `funnelStages.invited` 也跟著消失，funnel 從 5 階段縮成 4 階段（Redeemed / Profile / Answered / Completed）

**Migration**: 程式不嘗試讀舊資料，若 `.data/evaluation-store.json` 已有舊欄位，讀取時忽略（仍走 `Partial<EvaluationStore>` 寬容解析）。建議手動 `rm -f .data/evaluation-store.json` 確保乾淨啟動。

### D5: URL 與路由整併 — `/?invite_code=<code>`

**選擇**:
- 主入口 `/`（拿掉現有的 `redirect("/eval")`），首頁 server component 直接讀 cookie + searchParams 並渲染 EvaluationApp
- 保留 `/eval` 路徑作為 301 redirect 到 `/`，以容錯舊書籤（後續可清理）
- Query param 改名：`invite` → `invite_code`

**理由**:
- 受測者看到的 URL 短一點、語意清楚
- `invite_code` 比 `invite` 更不會跟「邀請名單」混淆

### D6: Admin QR Panel 即時生成、不寫入磁碟

**選擇**: `/admin` 邀請碼分頁顯示：
- 當前 `SHARED_INVITE_CODE`（讀環境變數、未設定時顯示警告）
- 一張 SVG QR（用 `qrcode` 套件即時生成，內容為 `${origin}/?invite_code=<code>`）
- 一顆「下載 PNG」按鈕（client-side 將 SVG 轉 PNG，或 server route 回 PNG buffer）

**理由**:
- 邀請碼固定，沒有「批次產生」需求
- QR 不寫入 `.data/`，避免 stale 圖片（env var 改了 QR 自動跟著變）
- 沿用既有 `qrcode` 依賴，不新增套件

## Risks / Trade-offs

- **Cookie 被清 → 重複參加** → 接受。研究者可手動透過 `participantToken` 比對 profile 內容判斷可疑重複。
- **跨瀏覽器 / 跨裝置 → 同一人重入** → 接受。實際研究情境受測者不太會這樣做；硬擋會反而誤傷友善受測者。
- **`SHARED_INVITE_CODE` 未設定就上線** → redeem API 回 503，admin QR panel 顯示「未設定」紅字。建議在 Zeabur deploy checklist 中標記為必填。
- **客戶端 bundle 可能誤帶 env var** → Next.js 預設 `process.env.X` 在 server-side 才可讀；確保不寫進任何 `'use client'` 元件，並避免命名為 `NEXT_PUBLIC_*`。
- **`/eval` redirect 期間搜尋引擎 / 舊書籤可能短期失效** → 加 301 redirect 緩解；無線上資料，影響極小。

## Migration Plan

1. **部署前**: 在 Zeabur dashboard 新增 env var `SHARED_INVITE_CODE=ailab502`
2. **部署**: 推上 main 後重啟服務（Zeabur 會自動重新部署）
3. **資料**: 部署完成後手動清空 `.data/evaluation-store.json`（或保留，新代碼會忽略 `invites` 欄位）
4. **回退**: 若發現問題，回退到前一 commit 即可；env var 可保留無害

## Open Questions

無。所有設計決策已在 explore 階段與 user 對齊。
