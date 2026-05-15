import { Badge } from "@/components/ui/badge"

interface NetBadgeProps {
  value: number
}

export function NetBadge({ value }: NetBadgeProps) {
  const isNonNegative = value >= 0
  const label = isNonNegative ? `+${value}` : `${value}`
  return (
    <Badge
      variant={isNonNegative ? "default" : "destructive"}
      className={
        isNonNegative
          ? "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)] hover:bg-[var(--admin-accent-soft)]"
          : "bg-[var(--admin-warn-soft)] text-[var(--admin-warn)] hover:bg-[var(--admin-warn-soft)]"
      }
    >
      {label}
    </Badge>
  )
}
