"use client"

import { ArrowLeftIcon } from "lucide-react"
import { navigate } from "@/hooks/use-hash-route"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Where am I: one control back to the plant. The room name sits beside the arrow on a wide screen. */
export function RoomBreadcrumb({ q, roomName }: { q: string; roomName: string }) {
  return (
    <nav aria-label="Where you are" className="contents">
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Back to plant, ${roomName}`}
          aria-keyshortcuts="Escape"
          onClick={() => navigate({ level: "plant", q })}
          className="flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm text-scene-ink outline-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white panel:h-10 panel:w-auto panel:justify-self-start panel:justify-start panel:bg-black/75 panel:px-3 panel:shadow-lg panel:backdrop-blur-sm"
        >
          <ArrowLeftIcon aria-hidden className="size-4 shrink-0" />
          <span className="hidden panel:inline">Plant</span>
          <span aria-hidden className="hidden text-scene-ink/40 panel:inline">
            /
          </span>
          <span className="hidden max-w-40 truncate font-medium panel:inline">{roomName}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Back to plant · Esc</TooltipContent>
    </Tooltip>
    </nav>
  )
}
