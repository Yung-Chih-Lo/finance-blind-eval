import type { AdminAttentionItems } from "@/lib/evaluation/types"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AttentionListProps {
  items: AdminAttentionItems
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) {
    return iso
  }
  const diffMin = Math.round((Date.now() - then) / 60_000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-none">
      <CardHeader className="px-4 pt-3 pb-2">
        <CardTitle className="text-sm font-medium text-[var(--admin-fg)]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">{children}</CardContent>
    </Card>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--admin-muted)]">{children}</p>
}

export function AttentionList({ items }: AttentionListProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Panel title="Top worst-answer flags">
        {items.topWorstFlags.length === 0 ? (
          <EmptyRow>尚無 worst-answer flag。</EmptyRow>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {items.topWorstFlags.map((flag) => (
              <li key={`${flag.modelId}-${flag.flagId}`} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--admin-fg)]">
                  {flag.flagLabel}
                  <span className="ml-1 text-xs text-[var(--admin-muted)]">{flag.modelId}</span>
                </span>
                <span className="font-medium tabular-nums text-[var(--admin-warn)]">{flag.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Latency outliers (> p95)">
        {items.latencyOutliers.length === 0 ? (
          <EmptyRow>尚無延遲離群點。</EmptyRow>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {items.latencyOutliers.map((outlier) => (
              <li key={outlier.recordId} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--admin-fg)]">
                  {outlier.participantToken}
                  <span className="ml-1 text-xs text-[var(--admin-muted)]">#{outlier.questionIndex}</span>
                </span>
                <span className="font-medium tabular-nums text-[var(--admin-muted)]">{outlier.latencyMs} ms</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Stalled participants">
        {items.stalledParticipants.length === 0 ? (
          <EmptyRow>沒有停滯的受測者。</EmptyRow>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {items.stalledParticipants.map((participant) => (
              <li key={participant.token} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--admin-fg)]">
                  {participant.token}
                  <span className="ml-1 text-xs text-[var(--admin-muted)]">
                    {participant.answeredCount} answered
                  </span>
                </span>
                <span className="text-xs text-[var(--admin-muted)]">{formatRelative(participant.lastActivityAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
