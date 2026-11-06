"use client"

import * as React from "react"
import { ChevronDownIcon, ScanIcon } from "lucide-react"
import { COPY, SERVER_TIERS, TIMING } from "@/lib/data"
import { cn } from "@/lib/utils"
import { useWorld } from "@/components/world/world-provider"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} s`
  return `${Math.round((seconds / 60) * 10) / 10} min`
}

/** Secondary entry to the batch sweep: search and per-concept segmenting are the main path now. */
export function ScanRoomBlock() {
  const { state } = useWorld()
  const [open, setOpen] = React.useState(false)
  const tier = SERVER_TIERS.find((t) => t.id === state.serverTier) ?? SERVER_TIERS[0]
  const total = TIMING.sweepViews * tier.secondsPerCall

  return (
    <section aria-label="Batch sweep" className="border-t px-panel-x py-2">
      <Button
        variant="link"
        size="xs"
        aria-expanded={open}
        aria-controls="scan-room-body"
        className="h-auto px-0 text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {COPY.scanForMore}
        <ChevronDownIcon aria-hidden className={cn("motion-transition transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div id="scan-room-body" className="mt-2 flex flex-col gap-2 pb-1">
          <p className="text-label text-muted-foreground text-pretty">
            {`Sweeps all ${TIMING.sweepViews} views for every concept SAM3 can find. ${TIMING.sweepViews} views × ~${tier.secondsPerCall} s on ${tier.label} ≈ ${formatDuration(total)}.`}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="self-start rounded-md">
                <Button size="sm" variant="secondary" disabled className="pointer-events-none">
                  <ScanIcon aria-hidden data-icon="inline-start" />
                  Start sweep
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Batch sweep isn&apos;t wired to the server yet</TooltipContent>
          </Tooltip>
        </div>
      )}
    </section>
  )
}
