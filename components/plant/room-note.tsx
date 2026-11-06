"use client"

import { ScanIcon, XIcon } from "lucide-react"
import { COPY, type Room } from "@/lib/data"
import { placeLabel } from "@/lib/parts"
import type { InventoryHit } from "@/lib/search"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Shown when an unscanned room is picked: what's in stock there, and why it can't open in 3D. */
export function RoomNote({ room, hits, onClose }: { room: Room; hits: InventoryHit[]; onClose: () => void }) {
  return (
    <section
      aria-label={`${room.name} — not scanned`}
      aria-live="polite"
      className="w-[min(26rem,calc(100vw-2rem))] rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-row font-semibold">{room.name}</h2>
          <p className="text-label text-muted-foreground">{COPY.notScannedNote}</p>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="Close note" onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      </div>

      {hits.length > 0 && (
        <ul aria-label={`Inventory in ${room.name}`} className="mt-2 flex flex-col gap-1 border-t pt-2">
          {hits.map(({ part, location }, i) => (
            <li key={`${part.partNo}-${i}`} className="flex items-baseline justify-between gap-3 text-label">
              <span className="min-w-0 truncate">
                <span className="font-mono">{part.partNo}</span>
                <span className="text-muted-foreground">{` · ${placeLabel(location)}`}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{`${location.qty} in stock`}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Disabled buttons don't emit pointer/focus events, so the wrapper carries the tooltip. */}
            <span tabIndex={0} className="rounded-md">
              <Button size="sm" variant="secondary" disabled className="pointer-events-none">
                <ScanIcon aria-hidden data-icon="inline-start" />
                Scan room
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{COPY.scanRoomTooltip}</TooltipContent>
        </Tooltip>
      </div>
    </section>
  )
}
