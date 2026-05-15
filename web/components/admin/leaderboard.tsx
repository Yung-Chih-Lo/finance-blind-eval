import type { AdminSnapshot, ModelId } from "@/lib/evaluation/types"

import { BarRow } from "./bar-row"
import { NetBadge } from "./net-badge"

interface LeaderboardProps {
  comparativeCounts: AdminSnapshot["comparativeCounts"]
  modelIds: ModelId[]
}

export function Leaderboard({ comparativeCounts, modelIds }: LeaderboardProps) {
  const rows = modelIds.map((modelId) => {
    const counts = comparativeCounts[modelId]
    return {
      modelId,
      best: counts?.overallBest ?? 0,
      worst: counts?.overallWorst ?? 0,
      net: counts?.net ?? 0,
    }
  })
  const max = Math.max(1, ...rows.flatMap((row) => [row.best, row.worst]))
  const sorted = rows.sort((a, b) => b.net - a.net)

  return (
    <div className="space-y-1">
      {sorted.map((row) => (
        <div key={row.modelId} className="space-y-0.5">
          <BarRow
            label={row.modelId}
            value={row.best}
            max={max}
            tone="accent"
            suffix={
              <span className="flex items-center justify-end gap-2">
                <span>best {row.best} · worst {row.worst}</span>
                <NetBadge value={row.net} />
              </span>
            }
          />
          <BarRow label="" value={row.worst} max={max} tone="warn" suffix="" />
        </div>
      ))}
      {sorted.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">尚無模型資料。</p>
      ) : null}
    </div>
  )
}
