"use client"

import { AlertTriangleIcon, ClockIcon } from "lucide-react"
import { VOTE_THRESHOLD, type WorldObject } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const base = "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-label font-medium whitespace-nowrap"

export function lowConfidenceReason(o: WorldObject) {
  return `Only ${o.votes} of ${o.views} views voted for these splats — the threshold is ${VOTE_THRESHOLD}. Segment from more views to confirm.`
}

export function StatusBadge({ object, tabIndex }: { object: WorldObject; tabIndex: number }) {
  switch (object.status) {
    case "queued":
      return (
        <span className={cn(base, "border-border text-status-queued")}>
          <ClockIcon aria-hidden className="size-3" />
          queued
        </span>
      )
    case "segmenting":
      return (
        <span className={cn(base, "border-status-active/40 text-status-active")}>
          <Spinner aria-hidden className="size-3" />
          segmenting
        </span>
      )
    case "lifted":
      return (
        <span className={cn(base, "border-status-lifted/30 text-status-lifted")}>
          <span aria-hidden className="size-1.5 rounded-full bg-status-lifted" />
          lifted
        </span>
      )
    case "low_confidence":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              tabIndex={tabIndex}
              aria-label={`Low confidence. ${lowConfidenceReason(object)}`}
              className={cn(base, "cursor-help border-status-low/40 text-status-low")}
            >
              <AlertTriangleIcon aria-hidden className="size-3" />
              low confidence
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-56">
            {lowConfidenceReason(object)}
          </TooltipContent>
        </Tooltip>
      )
    case "failed":
      return (
        <span className={cn(base, "border-status-failed/40 text-status-failed")}>
          <AlertTriangleIcon aria-hidden className="size-3" />
          failed
        </span>
      )
  }
}
