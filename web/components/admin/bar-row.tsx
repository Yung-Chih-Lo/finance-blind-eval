import type { ReactNode } from "react"

interface BarRowProps {
  label: ReactNode
  value: number
  max: number
  suffix?: ReactNode
  tone?: "accent" | "warn" | "muted"
}

const TONE_CLASS: Record<NonNullable<BarRowProps["tone"]>, string> = {
  accent: "bg-[var(--admin-accent)]",
  warn: "bg-[var(--admin-warn)]",
  muted: "bg-slate-400",
}

export function BarRow({ label, value, max, suffix, tone = "accent" }: BarRowProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <div className="w-32 shrink-0 truncate text-[var(--admin-fg)]">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${TONE_CLASS[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="w-40 shrink-0 text-right tabular-nums text-[var(--admin-muted)]">{suffix}</div>
    </div>
  )
}
