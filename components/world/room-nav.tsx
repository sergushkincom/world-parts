"use client"

import { ArrowLeftIcon } from "lucide-react"
import { COPY, PLAN, type RoomId } from "@/lib/data"
import { getRoom } from "@/lib/search"
import { navigate } from "@/hooks/use-hash-route"
import { planPoints } from "@/components/plant/floor-plan"
import { Button } from "@/components/ui/button"

export function BackToPlant({ q }: { q: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className="pointer-events-auto shadow-sm"
      aria-keyshortcuts="Escape"
      onClick={() => navigate({ level: "plant", q })}
    >
      <ArrowLeftIcon aria-hidden data-icon="inline-start" />
      {COPY.backToPlant}
    </Button>
  )
}

/** Small floor plan with this room highlighted and the camera position; click to go back up. */
export function RoomMinimap({ roomId, q }: { roomId: RoomId; q: string }) {
  const room = getRoom(roomId)
  const [cx, cy] = PLAN.camera
  return (
    <button
      type="button"
      aria-label={`${room.name} on the plant floor plan — back to plant overview`}
      onClick={() => navigate({ level: "plant", q })}
      className="absolute bottom-3 left-3 z-10 overflow-hidden rounded-md border border-white/15 bg-black/70 shadow-lg backdrop-blur-sm transition-colors hover:border-white/40 max-panel:hidden"
      style={{ width: PLAN.minimapWidth }}
    >
      <span className="relative block" style={{ aspectRatio: `${PLAN.width} / ${PLAN.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- same static plan as the overview, CSS-filtered */}
        <img src={PLAN.imageSrc} alt="" draggable={false} className="plan-invert absolute inset-0 size-full opacity-70" />
        <svg viewBox={`0 0 ${PLAN.width} ${PLAN.height}`} aria-hidden className="absolute inset-0 size-full">
          <polygon
            points={planPoints(room.polygon)}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.5}
            className="fill-status-active/25 stroke-status-active"
          />
          <circle cx={cx} cy={cy} r={48} className="fill-status-active/30" />
          <circle cx={cx} cy={cy} r={22} className="fill-status-active stroke-black" strokeWidth={6} />
        </svg>
      </span>
    </button>
  )
}
