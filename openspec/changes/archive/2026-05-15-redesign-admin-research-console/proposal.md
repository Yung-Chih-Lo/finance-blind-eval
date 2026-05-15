## Why

`/admin` 目前把 6 個 KPI、3 個 settings 區塊、2 個 actions 區塊與 4 個寬表格全部堆在同一頁，所有 section 都用同款 `<h2>` + 手寫 `<table>`，沒有資訊層級也沒有導航。研究者要找一個受測者狀態或一筆紀錄要捲很久，而且最重要的「模型整體表現」夾在 8 欄表格裡幾乎讀不出來。這份 change 把後台改成「研究操作台」風格：分 tab 收斂、為高頻指標（model leaderboard、受測流程漏斗、需要注意的項目）做視覺化，並把每題紀錄改成 table + drawer，讓主表保持窄。

## What Changes

- 把 `/admin` 改成 Tabbed Single Page，固定七個 tab：`總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料`
- 頂部留一條 KPI bar（受測者、完成、題目、完成率、金融/非金融、邀請碼），其餘指標移入對應 tab
- **總覽 tab** 新增：
  - 受測流程漏斗（Invite → Started → Profile → Answered → Done）以條圖呈現各階段人數與流失率
  - 「需要注意的項目」：worst-answer flags top 3、延遲離群（>p95）、未完成受測者最舊 N 筆
  - 模型 leaderboard（純 CSS bar：net 排序、顯示 best/worst 計數與顏色標 net）
- **模型結果 tab**：保留現有「模型整體與面向比較」+「Worst answer flags」兩張表，但加上 leaderboard 視覺與右對齊數字、用 `Badge` 標 net 正負
- **原始資料 tab**：每題紀錄主表收窄成 `Token · # · 題型 · Best · Worst · Latency`，點任一列開 Sheet/Drawer 顯示完整題目、facet selections、worst-answer flags、hidden mapping
- **Provider 設定 / 問卷文案** 拆成獨立 tab（目前 `AdminProviderSettings`、`AdminStudyCopySettings` 兩個元件原樣搬入）
- **邀請碼 tab**：合併 `AdminInviteActions` 與邀請碼相關統計（既有 `snapshot.invites` 計數）
- 視覺風格：背景 `#F8FAFC`、文字 slate、主色 blue/teal、警示 rose/orange；引入 shadcn `card / tabs / table / badge / sheet`；移除 `admin-link`、`stat-card`、`table-section` 等 admin 專用手寫 CSS
- **BREAKING**：`/admin` 的 DOM 結構與 className 全面改寫，任何依賴既有 CSS class 的外部腳本或測試需更新

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `blind-evaluation-app`: `Admin evaluation dashboard` 需求的呈現方式從「單頁列出全部表格」改為「Tabbed 操作台 + 漏斗 + 模型 leaderboard + 詳情 drawer」；新增「需要注意的項目」呈現需求；資料端點與儲存格式不變

## Impact

- **改寫**：`web/app/admin/page.tsx` — 從單一 server component 拆成「KPI bar + `<AdminTabs>` 客戶端容器」
- **新增**：
  - `web/components/admin/admin-tabs.tsx`（client，Radix Tabs 包裝）
  - `web/components/admin/metric-card.tsx`、`net-badge.tsx`、`bar-row.tsx`
  - `web/components/admin/funnel.tsx`、`attention-list.tsx`
  - `web/components/admin/record-drawer.tsx`（Sheet 包裝）
  - `web/components/admin/leaderboard.tsx`
  - `web/components/ui/{card,tabs,table,badge,sheet}.tsx`（`npx shadcn add`）
- **改動**：`web/lib/server/evaluation-storage.ts` — `getAdminSnapshot` 新增三個衍生欄位：`funnelStages`、`attentionItems`、`latencyStats`（純 computed，不動底層 storage）
- **改動**：`web/app/globals.css` — 移除 admin 專用 class（受測者端 `.page-shell`、`.study-header` 等保留）；在 `:root` / `.dark` 加入 `--admin-bg`、`--admin-accent`、`--admin-warn` token
- **不動**：`/api/admin/*` API endpoints、`AdminStudyCopySettings`、`AdminProviderSettings`、`AdminInviteActions`、`AdminExportActions` 四個既有 client 元件的內部邏輯
- **依賴**：新增 shadcn 元件檔（無新 npm 包，shadcn 已配置 `radix-nova` style）
