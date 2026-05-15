## Context

`/admin` 是研究者唯一用來監看盲測進度、檢查資料品質、調整 Provider / 問卷文案的工具。目前所有區塊 stack 在同一頁、所有資料都用同款手寫 `<table>`，研究者的三種主要任務（看進度、看模型結果、抓異常）混在一起，視覺上沒有層級。Stack：Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn (style `radix-nova`, neutral base, lucide icons)；shadcn 已配置但 admin 完全沒用。後端 `getAdminSnapshot()` 已經提供大部分需要的衍生資料，僅缺漏斗、注意事項與延遲統計三項。

## Goals / Non-Goals

**Goals:**
- 把高頻指標（受測進度、模型表現、異常）抬到顯眼位置
- 重複利用既有 shadcn 配置，避免引入新圖表 lib
- 不動 API、不動受測者端、不動 storage 格式
- 視覺風格能在研究會議簡報直接截圖（不要 hero、不要漸層）

**Non-Goals:**
- 不做即時推送 / WebSocket — 仍維持 `force-dynamic` SSR，重新整理才更新
- 不做圖表互動（hover tooltip、scrub、zoom），純 CSS bar 只顯示靜態比例
- 不做 mobile-first 響應式 — 後台只在 desktop 用，min-width 1024 即可
- 不重構 `AdminStudyCopySettings` / `AdminProviderSettings` / `AdminInviteActions` / `AdminExportActions` 內部表單，只搬位置 + 換外層 Card

## Decisions

### Tabbed Single Page（不切多路由也不做 sidebar）

採用 Radix Tabs 在 `/admin` 內部切換，**不**拆 `/admin/overview`、`/admin/models`...。

- **Why**：研究者一次 session 通常會跨多個 tab（看進度→看模型→匯出），多路由要每次走 server fetch；單頁 + tab 一次 SSR 拿到全部 snapshot，切換瞬間完成。
- **Alternatives 考慮過**：
  - **Sidebar + 多路由**：最像「正規後台」但工作量翻倍（每路由要寫 page.tsx + loading + 共用 layout），且每次切換都要重 fetch。研究後台只一個人在用，瓶頸不在後端負載。
  - **單頁無 tab，只加分隔線**：等於只解決「醜」沒解決「雜亂」。
- **Trade-off**：客戶端首次 hydrate 會拿到全部 tab 的資料；但目前 snapshot 量級（< 100 受測者、< 500 records）一頁 payload 仍在 KB 級，可接受。

### 視覺化用純 CSS bar，不裝 recharts

- **Why**：Leaderboard、漏斗、worst-flag 分佈都是水平比例條，`<div style={{width: ratio + '%'}}>` 就夠。recharts 會多吃 ~90KB gzipped，而且必須是 client component。
- **Alternatives 考慮過**：
  - **shadcn Charts (recharts)**：能畫 stacked bar / pie，但本案需求都用 bar，殺雞用牛刀。
  - **混合**（worst-flag 用 recharts）：邊界不乾淨，留 inconsistent style。
- **Trade-off**：未來若要做 facet-level heatmap 或時序圖，純 CSS 撐不住，到時再裝 recharts；現在不預付。

### 衍生資料在 server 計算，client 只渲染

`getAdminSnapshot` 新增三個欄位：

```ts
funnelStages: {
  invited: number       // 已發出邀請碼總數
  redeemed: number      // 已兌換 invite session
  profileCompleted: number  // 完成 profile form
  answeredAny: number   // 至少答完 1 題
  completed: number     // 達 max questions or 明確 done
}
attentionItems: {
  topWorstFlags: { flagId: string; modelId: string; count: number }[]  // top 3
  latencyOutliers: { recordId: string; latencyMs: number; participantToken: string }[]  // > p95
  stalledParticipants: { token: string; lastActivityAt: string; answeredCount: number }[]  // 最舊 5 筆未完成
}
latencyStats: { p50: number; p95: number; max: number }
```

- **Why server**：避免 client 對 records 做 sort/pXX 計算；SSR 拿到就能直接顯示。
- **Trade-off**：`getAdminSnapshot` 變胖，但邏輯都是 pure functions over existing arrays。

### 每題紀錄主表 + Drawer 詳情

主表 6 欄：`Token · # · 題型 · Best · Worst · Latency`。點列觸發 shadcn `Sheet`（右側抽屜），顯示：完整 user question、facet selections、worst-answer flags、hidden mapping、reason 文字。

- **Why**：原本 10 欄寬表把超長題目文字塞進 `<td>` 會撐爆 viewport；Drawer 給長文留垂直空間。
- **Trade-off**：點兩下才看得到完整資訊；但平時瀏覽只需要 token + best/worst，需要 deep dive 才開。

### 配色用 CSS variables，不改 shadcn `:root`

在 `globals.css` 加 admin 專用 token：

```css
.admin-shell {
  --admin-bg: #f8fafc;       /* slate-50 */
  --admin-fg: #0f172a;       /* slate-900 */
  --admin-muted: #64748b;    /* slate-500 */
  --admin-accent: #0d9488;   /* teal-600 */
  --admin-accent-fg: #ccfbf1;/* teal-100 */
  --admin-warn: #e11d48;     /* rose-600 */
  --admin-warn-soft: #ffe4e6;/* rose-100 */
}
```

- **Why**：受測者端 (`/eval`) 視覺保留現狀（深色 + 漸層）；只在 `<main className="admin-shell">` 範圍切換 token。
- **Alternatives**：覆寫 shadcn `--primary` / `--background` — 會污染受測者端。

## Risks / Trade-offs

- **[漏斗階段定義可能與既有 storage 不對齊]** → `getAdminSnapshot` 實作時要對 `Participant` 物件的欄位（`profile`、`completionStatus`、`answeredCount`）盤點，若沒有 `lastActivityAt` 之類時間欄則先用「最新一筆 record 的 createdAt」近似。
- **[hydration mismatch]**：Tabs 是 client，預設 tab 由 URL search param 帶（`/admin?tab=overview`），server render 時要讀同樣 param。
- **[視覺迴歸]**：受測者端共用 `globals.css`，移除 admin class 時要 grep 確認 `/eval` 沒在用 `.stat-card` / `.admin-link` / `.table-section`。
- **[既有 admin 元件樣式衝突]**：四個既有 Admin* 元件內部可能依賴外層 `.page-shell` 的 padding / max-width；包進新 Card 時要視覺檢查不破版。
- **[Drawer + 大量 records]**：若 records > 1000，主表不分頁會卡；先依現況不分頁，超過 200 列再加 shadcn `Pagination`。

## Migration Plan

1. 先 `npx shadcn add card tabs table badge sheet`，確認生成檔在 `components/ui/`
2. 改 `getAdminSnapshot` 加三個衍生欄位（純加，不動既有 keys）
3. 拆 `app/admin/page.tsx` 成 server 部分（fetch snapshot + 渲染 KPI bar + 包 `<AdminTabs>`）
4. 一個一個 tab 寫，每寫完一個 tab 在 dev 跑一次目測
5. 全部寫完後刪 `globals.css` 內的 admin 專用 class
6. 回歸測試：`/eval` 仍正常、`/admin` 七個 tab 都能點、drawer 開得起來、KPI 數字與舊頁一致

**Rollback**：直接 `git revert` — 後端與 API 完全沒動，前端是純取代。

## Open Questions

- 漏斗階段 `redeemed` 與 `profileCompleted` 的判定要看 `Participant.profile` 是否存在 vs `Participant.completionStatus === "profile"` — 等動 `evaluation-storage.ts` 時對著現有 schema 再決定（不阻塞 spec）。
- `latencyOutliers` 用 p95 還是固定 threshold（例：> 5000ms）— 先做 p95，研究者實際看一輪再調。
