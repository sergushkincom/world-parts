"use client"

import * as React from "react"
import { PLAN, ROOMS, type Point, type Room, type RoomId } from "@/lib/data"
import { cn } from "@/lib/utils"

export const planPoints = (polygon: Point[]) => polygon.map((p) => p.join(",")).join(" ")
const at = ([x, y]: Point): React.CSSProperties => ({
  left: `${(x / PLAN.width) * 100}%`,
  top: `${(y / PLAN.height) * 100}%`,
})

export function PlanPin() {
  return (
    <span aria-hidden className="relative flex size-2.5 shrink-0">
      <span className="pin-pulse absolute inset-0 rounded-full bg-status-active" />
      <span className="relative size-2.5 rounded-full bg-status-active" />
    </span>
  )
}

/**
 * The plant floor plan with one clickable zone per room.
 * `hits` is null when no search is active; otherwise rooms in it pulse and the rest dim.
 */
export function FloorPlan({
  hits,
  focusRoom,
  onRoom,
}: {
  hits: Set<RoomId> | null
  focusRoom: RoomId | null
  onRoom: (room: Room) => void
}) {
  const [hovered, setHovered] = React.useState<RoomId | null>(null)

  return (
    <div className="relative w-full" style={{ aspectRatio: `${PLAN.width} / ${PLAN.height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static plan, needs a CSS filter and exact pixel mapping */}
      <img
        src={PLAN.imageSrc}
        alt={PLAN.alt}
        width={PLAN.width}
        height={PLAN.height}
        draggable={false}
        className="plan-invert absolute inset-0 size-full select-none"
      />
      <svg viewBox={`0 0 ${PLAN.width} ${PLAN.height}`} aria-hidden className="absolute inset-0 size-full">
        {ROOMS.map((room) => {
          const lit = hits?.has(room.id) ?? false
          const dim = hits !== null && !lit && focusRoom !== room.id
          const focused = focusRoom === room.id
          return (
            <polygon
              key={room.id}
              data-room-zone={room.id}
              points={planPoints(room.polygon)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={focused ? 3 : 2}
              onPointerEnter={() => setHovered(room.id)}
              onPointerLeave={() => setHovered(null)}
              onClick={() => onRoom(room)}
              className={cn(
                "motion-transition cursor-pointer fill-transparent stroke-transparent transition-[fill,stroke] duration-200",
                hovered === room.id && "fill-foreground/5 stroke-foreground/40",
                lit && "fill-status-active/10 stroke-status-active/70",
                focused && "fill-status-active/20 stroke-status-active",
                dim && "fill-background/60",
              )}
            />
          )
        })}
      </svg>

      {ROOMS.map((room) => {
        const lit = hits?.has(room.id) ?? false
        const dim = hits !== null && !lit && focusRoom !== room.id
        const showName = hovered === room.id || focusRoom === room.id || lit
        const status = room.scanned ? "scanned" : "not scanned"
        return (
          <button
            key={room.id}
            type="button"
            style={at(room.anchor)}
            aria-label={`${room.name}, ${status}${lit ? ", has matches" : ""}${room.scanned ? " — open in 3D" : ""}`}
            onPointerEnter={() => setHovered(room.id)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(room.id)}
            onBlur={() => setHovered(null)}
            onClick={() => onRoom(room)}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card/90 px-2 py-1 text-label font-medium shadow-sm backdrop-blur-sm",
              "motion-transition transition-opacity duration-200",
              dim && "opacity-40",
              focusRoom === room.id && "border-status-active",
            )}
          >
            {lit ? (
              <PlanPin />
            ) : (
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", room.scanned ? "bg-status-lifted" : "bg-status-queued")}
              />
            )}
            <span className={cn(!showName && "hidden [@media(hover:none)]:inline")}>{room.name}</span>
            <span className={cn(room.scanned ? "text-status-lifted" : "text-muted-foreground")}>{status}</span>
          </button>
        )
      })}
    </div>
  )
}
