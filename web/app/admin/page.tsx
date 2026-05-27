import Link from "next/link"

import { AdminTabs, type AdminTabSpec } from "@/components/admin/admin-tabs"
import { AttentionList } from "@/components/admin/attention-list"
import { Funnel } from "@/components/admin/funnel"
import { Leaderboard } from "@/components/admin/leaderboard"
import { NetBadge } from "@/components/admin/net-badge"
import { RecordsTable } from "@/components/admin/records-table"
import { AdminExportActions } from "@/components/evaluation/admin-export-actions"
import { AdminInviteActions } from "@/components/evaluation/admin-invite-actions"
import { AdminLegacySettingsBanner } from "@/components/evaluation/admin-legacy-settings-banner"
import { AdminProviderSettings } from "@/components/evaluation/admin-provider-settings"
import { AdminStudyCopySettings } from "@/components/evaluation/admin-study-copy-settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AGE_RANGE_OPTIONS,
  AI_USAGE_FREQUENCY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  MAIN_DOMAIN_OPTIONS,
  formatProfileChoice,
} from "@/lib/evaluation/profile"
import type { ModelComparisonCounts } from "@/lib/evaluation/types"
import { getAdminSnapshot } from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"

export const dynamic = "force-dynamic"

interface AdminPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function formatPercent(value: number, total: number) {
  if (!total) {
    return "0%"
  }
  return `${Math.round((value / total) * 100)}%`
}

function pickTab(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "overview"
  }
  return value ?? "overview"
}

const FACET_COLUMNS: { key: keyof Pick<ModelComparisonCounts, "correctness" | "completeness" | "readability">; label: string }[] = [
  { key: "correctness", label: "Correctness" },
  { key: "completeness", label: "Complete" },
  { key: "readability", label: "Readability" },
]

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {}
  const defaultTab = pickTab(params.tab)
  let settings: Awaited<ReturnType<typeof getActivePlatformSettings>>
  try {
    settings = await getActivePlatformSettings()
  } catch (error) {
    if (error instanceof PlatformSettingsError) {
      if (error.message.startsWith("Legacy provider schema")) {
        return (
          <main className="admin-shell admin-tokens">
            <AdminLegacySettingsBanner issues={error.issues} kind="legacy-provider" />
          </main>
        )
      }
      if (
        error.message.startsWith("Runtime platform settings validation failed.") ||
        error.message.startsWith("Platform settings validation failed.")
      ) {
        return (
          <main className="admin-shell admin-tokens">
            <AdminLegacySettingsBanner issues={error.issues} kind="validation-failed" />
          </main>
        )
      }
    }
    throw error
  }
  const config = settings.config
  const snapshot = await getAdminSnapshot(config)
  const recordCount = snapshot.records.length
  const totalParticipants = snapshot.participants.length
  const completionRate = formatPercent(snapshot.completedCount, totalParticipants)

  const answeredByToken = new Map<string, number>()
  for (const record of snapshot.records) {
    answeredByToken.set(record.participantToken, (answeredByToken.get(record.participantToken) ?? 0) + 1)
  }

  const overview = (
    <div className="space-y-6">
      <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
        <CardHeader className="px-5 pt-4 pb-2">
          <CardTitle className="text-base">受測流程漏斗</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Funnel stages={snapshot.funnelStages} />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--admin-muted)]">
          需要注意的項目
        </h2>
        <AttentionList items={snapshot.attentionItems} />
      </section>

      <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
        <CardHeader className="px-5 pt-4 pb-2 flex flex-row items-baseline justify-between">
          <CardTitle className="text-base">模型 leaderboard</CardTitle>
          <span className="text-xs text-[var(--admin-muted)]">sorted by net</span>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Leaderboard comparativeCounts={snapshot.comparativeCounts} modelIds={config.modelIds} />
        </CardContent>
      </Card>
    </div>
  )

  const participants = (
    <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
      <CardHeader className="px-5 pt-4 pb-2">
        <CardTitle className="text-base">受測者完成狀態</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>年齡</TableHead>
              <TableHead>學歷</TableHead>
              <TableHead>目前主要領域</TableHead>
              <TableHead>AI 使用頻率</TableHead>
              <TableHead>曾用 AI 處理金融?</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="text-right">完成題數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.participants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-[var(--admin-muted)]">
                  尚無受測者紀錄。
                </TableCell>
              </TableRow>
            ) : (
              snapshot.participants.map((participant) => {
                const answered = answeredByToken.get(participant.token) ?? 0
                const hasUsedAi = participant.profile?.hasUsedAiForFinance
                return (
                  <TableRow key={participant.token}>
                    <TableCell className="font-mono text-xs">{participant.token}</TableCell>
                    <TableCell>{formatProfileChoice(AGE_RANGE_OPTIONS, participant.profile?.ageRange)}</TableCell>
                    <TableCell>{formatProfileChoice(EDUCATION_LEVEL_OPTIONS, participant.profile?.educationLevel)}</TableCell>
                    <TableCell>{formatProfileChoice(MAIN_DOMAIN_OPTIONS, participant.profile?.mainDomain)}</TableCell>
                    <TableCell>{formatProfileChoice(AI_USAGE_FREQUENCY_OPTIONS, participant.profile?.aiUsageFrequency)}</TableCell>
                    <TableCell>{hasUsedAi === true ? "Y" : hasUsedAi === false ? "N" : "-"}</TableCell>
                    <TableCell>{participant.completionStatus}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {answered} / {config.limits.maxQuestionsPerParticipant}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )

  const models = (
    <div className="space-y-6">
      <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
        <CardHeader className="px-5 pt-4 pb-2">
          <CardTitle className="text-base">模型 leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Leaderboard comparativeCounts={snapshot.comparativeCounts} modelIds={config.modelIds} />
        </CardContent>
      </Card>

      <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
        <CardHeader className="px-5 pt-4 pb-2">
          <CardTitle className="text-base">模型整體與面向比較</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Overall best</TableHead>
                <TableHead className="text-right">Overall worst</TableHead>
                <TableHead className="text-right">Net</TableHead>
                {FACET_COLUMNS.map((facet) => (
                  <TableHead key={facet.key} className="text-right">{facet.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.modelIds.map((modelId) => {
                const counts = snapshot.comparativeCounts[modelId]
                return (
                  <TableRow key={modelId}>
                    <TableCell>{modelId}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {counts.overallBest} <span className="text-xs text-[var(--admin-muted)]">{formatPercent(counts.overallBest, recordCount)}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {counts.overallWorst} <span className="text-xs text-[var(--admin-muted)]">{formatPercent(counts.overallWorst, recordCount)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <NetBadge value={counts.net} />
                    </TableCell>
                    {FACET_COLUMNS.map((facet) => (
                      <TableCell key={facet.key} className="text-right tabular-nums">
                        {counts[facet.key]} <span className="text-xs text-[var(--admin-muted)]">{formatPercent(counts[facet.key], recordCount)}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
        <CardHeader className="px-5 pt-4 pb-2">
          <CardTitle className="text-base">Worst answer flags</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                {config.worstAnswerFlags.map((flag) => (
                  <TableHead key={flag.id} className="text-right">{flag.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.modelIds.map((modelId) => (
                <TableRow key={modelId}>
                  <TableCell>{modelId}</TableCell>
                  {config.worstAnswerFlags.map((flag) => (
                    <TableCell key={flag.id} className="text-right tabular-nums">
                      {snapshot.worstFlagCounts[modelId][flag.id] ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )

  const invitesTab = (
    <div className="space-y-6">
      <AdminInviteActions />
    </div>
  )

  const records = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--admin-muted)]">每題紀錄</h2>
        <AdminExportActions />
      </div>
      <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
        <CardContent className="px-2 py-2">
          <RecordsTable records={snapshot.records} config={config} />
        </CardContent>
      </Card>
    </div>
  )

  const tabs: AdminTabSpec[] = [
    { id: "overview", label: "總覽", content: overview },
    { id: "participants", label: "受測者", content: participants },
    { id: "models", label: "模型結果", content: models },
    { id: "invites", label: "邀請碼", content: invitesTab },
    {
      id: "provider",
      label: "Provider 設定",
      content: (
        <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
          <CardContent className="px-5 py-4">
            <AdminProviderSettings initialSettings={settings} />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "study-copy",
      label: "問卷文案",
      content: (
        <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
          <CardContent className="px-5 py-4">
            <AdminStudyCopySettings initialSettings={settings} />
          </CardContent>
        </Card>
      ),
    },
    { id: "records", label: "原始資料", content: records },
  ]

  const brand = (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)]">Research admin</p>
      <h1 className="text-base font-semibold leading-tight tracking-tight text-[var(--admin-fg)]">
        盲測資料後台
      </h1>
    </div>
  )

  const kpi = (
    <div className="space-y-2 text-sm" aria-label="研究狀態統計">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)]">KPI</p>
      <SidebarMetric label="受測者" value={totalParticipants} />
      <SidebarMetric label="完成" value={snapshot.completedCount} />
      <SidebarMetric label="題目紀錄" value={recordCount} />
      <SidebarMetric label="完成率" value={completionRate} />
      <SidebarMetric
        label="財經類 / 商學非財經"
        value={`${snapshot.financeRelatedCount} / ${snapshot.businessNonFinanceCount}`}
      />
    </div>
  )

  const sidebarFooter = (
    <Link
      className="block rounded-md border border-[var(--admin-border)] bg-white px-3 py-2 text-center text-sm text-[var(--admin-fg)] transition-colors hover:bg-[var(--admin-accent-soft)] hover:text-[var(--admin-accent)]"
      href="/"
    >
      開啟受測者入口
    </Link>
  )

  const mainHeaderRight = (
    <span>
      v{settings.settingsVersion} · {settings.source}
    </span>
  )

  return (
    <main className="admin-shell admin-tokens">
      <AdminTabs
        tabs={tabs}
        defaultTab={defaultTab}
        brand={brand}
        kpi={kpi}
        sidebarFooter={sidebarFooter}
        mainHeaderRight={mainHeaderRight}
      />
    </main>
  )
}

interface SidebarMetricProps {
  label: string
  value: React.ReactNode
}

function SidebarMetric({ label, value }: SidebarMetricProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-[var(--admin-muted)]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[var(--admin-fg)]">{value}</span>
    </div>
  )
}
