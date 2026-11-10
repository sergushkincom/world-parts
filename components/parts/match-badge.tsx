import { MATCH_LABEL, type MatchType } from "@/lib/data"
import { cn } from "@/lib/utils"

const TONE: Record<MatchType, string> = {
  exact_duplicate: "bg-status-lifted/15 text-status-lifted",
  functional_substitute: "bg-status-active/15 text-status-active",
  related: "bg-muted text-muted-foreground",
}

/** Resourcly-style verdict on a pair of parts: can I swap this in, or is it only related? */
export function MatchBadge({ match, className }: { match: MatchType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-label font-medium",
        TONE[match],
        className,
      )}
    >
      {MATCH_LABEL[match]}
    </span>
  )
}
