import type { AdminFunnelStages } from "@/lib/evaluation/types"

import { BarRow } from "./bar-row"

interface FunnelProps {
  stages: AdminFunnelStages
}

const STAGE_ORDER: { id: keyof AdminFunnelStages; label: string }[] = [
  { id: "redeemed", label: "Redeemed" },
  { id: "profileCompleted", label: "Profile" },
  { id: "answeredAny", label: "Answered" },
  { id: "completed", label: "Completed" },
]

function retentionLabel(current: number, previous: number) {
  if (previous <= 0) {
    return "—"
  }
  const pct = Math.round((current / previous) * 100)
  return `${pct}% of prev`
}

export function Funnel({ stages }: FunnelProps) {
  // Cover all 5 stages in case downstream counts exceed earlier ones (data drift
  // from manual JSON edits, profile resets, etc.) — prevents bar overflow.
  const max = Math.max(1, ...STAGE_ORDER.map((stage) => stages[stage.id]))
  return (
    <div className="space-y-1">
      {STAGE_ORDER.map((stage, index) => {
        const value = stages[stage.id]
        const previousValue = index === 0 ? value : stages[STAGE_ORDER[index - 1].id]
        const suffix = (
          <span className="text-[var(--admin-muted)]">
            {value} <span className="opacity-70">·</span> {index === 0 ? "issued" : retentionLabel(value, previousValue)}
          </span>
        )
        return (
          <BarRow key={stage.id} label={stage.label} value={value} max={max} suffix={suffix} />
        )
      })}
    </div>
  )
}
