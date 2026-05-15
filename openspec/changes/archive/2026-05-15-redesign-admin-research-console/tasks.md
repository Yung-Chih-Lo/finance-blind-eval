## File Plan

- **Modify**: `web/lib/evaluation/types.ts` — extend `AdminSnapshot` with `funnelStages`, `attentionItems`, `latencyStats`
- **Modify**: `web/lib/server/evaluation-storage.ts:436` — `getAdminSnapshot()` derives the three new fields from existing `participants` / `records` / `invites`
- **Modify**: `web/app/admin/page.tsx` — replace 273-line layout with KPI bar + `<AdminTabs>`
- **Modify**: `web/app/globals.css` — add `.admin-shell` token block, remove `.stat-card` / `.admin-link` / `.table-section` / `.admin-page` rules
- **Create** (shadcn add): `web/components/ui/{card,tabs,table,badge,sheet}.tsx`
- **Create**: `web/components/admin/admin-tabs.tsx` (client)
- **Create**: `web/components/admin/metric-card.tsx`, `net-badge.tsx`, `bar-row.tsx`
- **Create**: `web/components/admin/funnel.tsx`, `attention-list.tsx`, `leaderboard.tsx`
- **Create**: `web/components/admin/record-drawer.tsx` (client, wraps shadcn Sheet)
- **Create**: `web/components/admin/records-table.tsx` (client, lifts state for drawer)

## 1. Pre-flight & dependency setup

- [x] 1.1 Grep `/eval` and `/components/evaluation/` for usage of `.stat-card`, `.admin-link`, `.admin-page`, `.table-section`, `.page-shell.admin-page` to confirm they are admin-only before removal
  - **Result**: `.section-heading`, `.table-section`, `.admin-link` are also used by `quality-controls.tsx` (/eval), four `admin-*` evaluation components, and `app/page.tsx`. Only `.stat-card`, `.admin-page`, `.stacked-cell`, `.table-wrap` are safe to delete in task 9.
- [x] 1.2 Run `cd web && npx shadcn@latest add card tabs table badge sheet` and verify five files appear under `web/components/ui/`
- [x] 1.3 Run `cd web && npm run typecheck` — must pass before edits start

## 2. Extend AdminSnapshot type

- [x] 2.1 In `web/lib/evaluation/types.ts:230`, add three optional-but-required new fields to `AdminSnapshot`:
  ```ts
  funnelStages: {
    invited: number
    redeemed: number
    profileCompleted: number
    answeredAny: number
    completed: number
  }
  attentionItems: {
    topWorstFlags: { flagId: string; flagLabel: string; modelId: ModelId; count: number }[]
    latencyOutliers: { recordId: string; latencyMs: number; participantToken: string; questionIndex: number }[]
    stalledParticipants: { token: string; lastActivityAt: string; answeredCount: number }[]
  }
  latencyStats: { p50: number; p95: number; max: number }
  ```
- [x] 2.2 Run `cd web && npm run typecheck` — expect failure in `evaluation-storage.ts` and `app/admin/page.tsx` (missing fields). This is the RED step.
  - **Confirmed RED**: `lib/server/evaluation-storage.ts(438,3): error TS2739: Type ... is missing the following properties from type 'AdminSnapshot': funnelStages, attentionItems, latencyStats`

## 3. Implement derived snapshot fields

- [x] 3.1 In `web/lib/server/evaluation-storage.ts`, add a private helper `function computeFunnel(participants, invites, records): AdminSnapshot["funnelStages"]`:
  - `invited` = sum of `invite.maxUses` across `invites` (codes issued)
  - `redeemed` = `participants.length`
  - `profileCompleted` = `participants.filter(p => p.profile != null).length`
  - `answeredAny` = count of distinct `record.participantToken` in `records`
  - `completed` = `participants.filter(p => p.completionStatus === "completed").length`
- [x] 3.2 Add helper `function computeLatencyStats(records): { p50; p95; max }`:
  - sort `records.map(r => r.responseLatencyMs)` ascending
  - `p50` = value at index `floor(n*0.5)`; `p95` = value at index `floor(n*0.95)`; `max` = last
  - return `{ p50: 0, p95: 0, max: 0 }` when `records.length === 0`
- [x] 3.3 Add helper `function computeAttentionItems(participants, records, worstFlagCounts, latencyP95, config)`:
  - `topWorstFlags`: flatten `worstFlagCounts[modelId][flagId]` → array, sort by count desc, take top 3; resolve `flagLabel` via `config.worstAnswerFlags.find(...)`
  - `latencyOutliers`: records where `responseLatencyMs > latencyP95`, sort desc by latency, take top 5
  - `stalledParticipants`: `participants.filter(p => p.completionStatus !== "completed" && p.profile != null)`, sort `updatedAt` ascending, take 5; `answeredCount` = `records.filter(r => r.participantToken === p.token).length`; `lastActivityAt` = `p.updatedAt`
- [x] 3.4 In `getAdminSnapshot` at `evaluation-storage.ts:436`, compute and attach the three new fields before return
- [x] 3.5 Run `cd web && npm run typecheck` — must pass

## 4. Admin CSS tokens (additive only)

- [x] 4.1 At the bottom of `web/app/globals.css`, add an `.admin-shell { ... }` block defining `--admin-bg`, `--admin-fg`, `--admin-muted`, `--admin-accent`, `--admin-accent-fg`, `--admin-warn`, `--admin-warn-soft` per design.md token table
- [x] 4.2 Add `.admin-shell` background + min-height rule using `var(--admin-bg)` and `text-foreground` resets
- [x] 4.3 Do NOT remove old admin classes yet — happens in task 9

## 5. Primitive admin components

- [x] 5.1 Create `web/components/admin/metric-card.tsx` (server-safe): props `label: string; value: ReactNode; hint?: string`; renders shadcn `Card` with label (slate-500, xs) above value (slate-900, 2xl semibold), optional muted hint below
- [x] 5.2 Create `web/components/admin/net-badge.tsx`: props `value: number`; renders shadcn `Badge` with `variant="default"` when `>=0` using teal palette, `variant="destructive"` when `<0` using rose; prefixes `+` for positive
- [x] 5.3 Create `web/components/admin/bar-row.tsx`: props `label: string; value: number; max: number; suffix?: ReactNode`; renders flex row of label (w-32 truncate) + bar track (`bg-slate-100 h-2 rounded` with inner div `bg-[--admin-accent]` width=`${(value/max)*100}%`) + suffix
- [x] 5.4 Run `cd web && npm run typecheck` — must pass

## 6. Composite admin components

- [x] 6.1 Create `web/components/admin/leaderboard.tsx`: props `comparativeCounts: AdminSnapshot["comparativeCounts"]; modelIds: ModelId[]`; computes max(|best|, |worst|) across models for shared bar scale; sorts rows by net desc; each row uses `<BarRow>` for best + worst stacked, with `<NetBadge>` at end
- [x] 6.2 Create `web/components/admin/funnel.tsx`: props `stages: AdminSnapshot["funnelStages"]`; renders five `<BarRow>` entries (Invited, Redeemed, Profile, Answered, Completed) all scaled to `stages.invited`; shows `n / pct of previous stage` as suffix
- [x] 6.3 Create `web/components/admin/attention-list.tsx`: props `items: AdminSnapshot["attentionItems"]`; renders three sub-cards: "Top worst-answer flags" (list of `flagLabel · modelId · count`), "Latency outliers" (list of `Token #idx · 1234 ms`), "Stalled participants" (list of `Token · n/5 answered · lastActivityAt relative`)
- [x] 6.4 Run `cd web && npm run typecheck` — must pass

## 7. Records table + drawer

- [x] 7.1 Create `web/components/admin/record-drawer.tsx` (client, `"use client"`): props `record: EvaluationRecord | null; config: StudyConfig; onClose: () => void`; wraps shadcn `Sheet` with `open={record != null}`; renders full `userQuestion`, all `facetSelections` (label + resolved model id), `worstAnswerFlags`, `hiddenModelMapping`, `bestReason`, `worstReason`
- [x] 7.2 Create `web/components/admin/records-table.tsx` (client): props `records: EvaluationRecord[]; config: StudyConfig`; uses `useState<EvaluationRecord | null>(null)` for selected row; renders shadcn `Table` with columns `Token · # · 題型 · Best · Worst · Latency`; row `onClick={() => setSelected(record)}`; renders `<RecordDrawer record={selected} config={config} onClose={() => setSelected(null)} />`
- [x] 7.3 Add empty-state row when `records.length === 0` matching prior copy `尚無題目紀錄。`
- [x] 7.4 Run `cd web && npm run typecheck` — must pass

## 8. AdminTabs container + page rewrite

- [x] 8.1 Create `web/components/admin/admin-tabs.tsx` (client, `"use client"`): props `tabs: { id: string; label: string; content: ReactNode }[]; defaultTab: string`; wraps shadcn `Tabs` with `defaultValue={defaultTab}`; reads/writes `tab` URL param via `useRouter` + `useSearchParams` so deep-links work
- [x] 8.2 Rewrite `web/app/admin/page.tsx`:
  - keep `getActivePlatformSettings()` + `getAdminSnapshot(config)` calls
  - wrap return in `<main className="admin-shell">`
  - header row: `<h1>盲測資料後台</h1>` (slate-900, 2xl) on left, settings version + `開啟受測者入口` link on right
  - KPI bar: grid of six `<MetricCard>` (受測者, 完成, 題數, 完成率, 金融/非金融, 邀請碼)
  - render `<AdminTabs defaultTab={searchParams.tab ?? "overview"} tabs={[...]} />` with seven tab definitions
- [x] 8.3 Wire tab contents:
  - `overview`: `<Funnel>` + `<AttentionList>` + `<Leaderboard>`
  - `participants`: existing 受測者表 (now styled with shadcn `Table`)
  - `models`: existing 模型整體與面向比較 + Worst flag tables (shadcn `Table`, right-aligned numerics) + `<Leaderboard>` at top
  - `invites`: `<AdminInviteActions />` + invite count summary
  - `provider`: `<AdminProviderSettings initialSettings={settings} />` inside `Card`
  - `study-copy`: `<AdminStudyCopySettings initialSettings={settings} />` inside `Card`
  - `records`: `<RecordsTable records={snapshot.records} config={config} />` + `<AdminExportActions />` above table
- [x] 8.4 Run `cd web && npm run typecheck` — must pass
- [x] 8.5 Run `cd web && npm run lint` — must pass

## 9. Remove deprecated admin CSS

- [x] 9.1 Re-grep for `.stat-card`, `.admin-link`, `.admin-page`, `.table-section`, `.section-heading`, `.stacked-cell`, `.table-wrap` outside `globals.css` to confirm zero callers remain
  - **Result**: only `.stat-card`, `.stacked-cell`, `.table-wrap` had zero callers; `.admin-link`, `.section-heading`, `.table-section` still used by `/eval` and `admin-*` evaluation components (scope narrowed at task 1.1).
- [x] 9.2 Delete the corresponding rule blocks from `web/app/globals.css` (keep `.page-shell` since `/eval` uses it; only remove admin-specific selectors)
- [x] 9.3 Run `cd web && npm run build` — must pass; check there are no CSS unused-class warnings in stderr

## 10. Manual smoke verification

- [x] 10.1 Start `cd web && npm run dev -- --port 5174` and open `/admin?token=<ADMIN_LINK_TOKEN>` (verify `ADMIN_LINK_TOKEN` is set in `.env.local`)
- [x] 10.2 Confirm KPI bar shows the same six numbers as the old page (compare against current production snapshot for one fixture)
- [x] 10.3 Click each of the seven tabs — content appears; reloading `/admin?tab=models` lands directly on 模型結果
- [x] 10.4 In `原始資料` tab, click any record row — Sheet opens with full question text + facet selections + hidden mapping; closing returns focus to the row
- [x] 10.5 In `總覽` tab, verify funnel adds up: invited ≥ redeemed ≥ profileCompleted ≥ answeredAny ≥ completed
- [x] 10.6 In `總覽` tab, verify attention list shows expected outliers (cross-check with `worstFlagCounts` and latency from old page)
- [x] 10.7 Visit `/eval` — confirm visual regression on participant flow is zero (no broken header / cards / scale inputs)
  - **Verified through iterative visual QA**: user reviewed sidebar layout, collapsible behavior, active-tab styling, header alignment, and dark-mode token contrast across multiple turns; `/eval` confirmed unchanged (token override scoped to `.admin-tokens` only).

## 11. Spec validation

- [x] 11.1 Run `openspec validate redesign-admin-research-console --strict` — must report 0 errors
