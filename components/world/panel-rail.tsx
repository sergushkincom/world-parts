"use client"

import * as React from "react"
import { LayersIcon, PanelRightOpenIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorld } from "@/components/world/world-provider"
import { STATUS_DOT } from "@/components/world/panel-header"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface PanelRailProps {
  onExpand: () => void
  expandRef: React.Ref<HTMLButtonElement>
}

/** 48 px collapsed state of the desktop panel. Keeps status visible at a glance. */
export function PanelRail({ onExpand, expandRef }: PanelRailProps) {
  const { state } = useWorld()
  const segmenting = state.objects.some((o) => o.status === "segmenting" || o.status === "queued")

  return (
    <div className="hidden flex-col items-center gap-3 py-2.5 panel:flex">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={expandRef}
            variant="ghost"
            size="icon-sm"
            aria-label="Expand segmentation panel"
            aria-expanded={false}
            aria-controls="segmentation-panel"
            onClick={onExpand}
          >
            <PanelRightOpenIcon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Expand panel</TooltipContent>
      </Tooltip>
      <Separator className="w-6" />
      <span
        role="img"
        aria-label={`Server ${state.serverStatus}`}
        className={cn("size-2 rounded-full", STATUS_DOT[state.serverStatus])}
      />
      <span className="flex flex-col items-center gap-0.5 text-label tabular-nums text-muted-foreground">
        <LayersIcon aria-hidden className="size-4" />
        <span aria-label={`${state.objects.length} objects`}>{state.objects.length}</span>
      </span>
      {state.selection.length > 0 && (
        <span
          className="rounded-full bg-primary px-1.5 text-label font-medium tabular-nums text-primary-foreground"
          aria-label={`${state.selection.length} selected`}
        >
          {state.selection.length}
        </span>
      )}
      {segmenting && <Spinner aria-label="Segmenting" className="text-status-active" />}
    </div>
  )
}
