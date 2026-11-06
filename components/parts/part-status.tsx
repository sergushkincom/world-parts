import type { Part } from "@/lib/data"
import { partStatuses, type PartStatus } from "@/lib/parts"
import { cn } from "@/lib/utils"

const TONE: Record<PartStatus["id"], string> = {
  in_stock: "bg-status-lifted/15 text-status-lifted",
  low: "bg-status-low/15 text-status-low",
  installed_only: "bg-muted text-muted-foreground",
  idle: "bg-status-queued/15 text-status-queued",
}

export function PartStatusChips({ part, className }: { part: Part; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {partStatuses(part).map((s) => (
        <span
          key={s.id}
          className={cn("inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-label font-medium", TONE[s.id])}
        >
          {s.label}
        </span>
      ))}
    </span>
  )
}
