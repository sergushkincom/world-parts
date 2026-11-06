"use client"

import * as React from "react"
import { PLAN, ROOMS, type Point, type Room, type RoomId } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PlanViewport, type PlanView, type ViewportSize } from "@/components/plant/plan-viewport"

export const planPoints = (polygon: Point[]) => polygon.map((p) => p.join(",")).join(" ")

export function PlanPin() {
  return (
    <span aria-hidden className="relative flex size-2.5 shrink-0">
      <span className="pin-pulse absolute inset-0 rounded-full bg-status-active" />
      <span className="relative size-2.5 rounded-full bg-status-active" />
    </span>
  )
}

const EDGE = 6
const PIN_H = 26
const PIN_GAP = 4
const DOT = 24

type Rect = { left: number; top: number; right: number; bottom: number }
type PinLayout = { room: Room; mode: "label" | "dot"; left: number; top: number }

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right + PIN_GAP && b.left < a.right + PIN_GAP && a.top < b.bottom + PIN_GAP && b.top < a.bottom + PIN_GAP

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Full labels are placed in priority order (focused, matching, scanned, rest); a label that would
 * overlap one already placed, or can't fit the viewport width, collapses to a dot. Rooms whose
 * anchor is panned out of view get no pin.
 */
function layoutPins(
  view: PlanView,
  size: ViewportSize,
  widths: Partial<Record<RoomId, number>>,
  hits: Set<RoomId> | null,
  focusRoom: RoomId | null,
): PinLayout[] {
  const rank = (r: Room) => (r.id === focusRoom ? 0 : hits?.has(r.id) ? 1 : r.scanned ? 2 : 3)
  const ordered = ROOMS.map((room, i) => ({ room, i })).sort((a, b) => rank(a.room) - rank(b.room) || a.i - b.i)
  const visible = ordered.flatMap(({ room }) => {
    const ax = view.x + room.anchor[0] * view.s
    const ay = view.y + room.anchor[1] * view.s
    if (ax < 0 || ax > size.w || ay < 0 || ay > size.h) return []
    const left = clamp(ax - DOT / 2, EDGE, size.w - EDGE - DOT)
    const top = clamp(ay - DOT / 2, EDGE, size.h - EDGE - DOT)
    return [{ room, ax, ay, dot: { left, top, right: left + DOT, bottom: top + DOT } }]
  })

  // Every room's dot is an obstacle, so a label never covers another room's position.
  const placed: Rect[] = []
  const out: PinLayout[] = []
  for (const { room, ax, ay, dot } of visible) {
    const w = widths[room.id]
    const blockers = [...placed, ...visible.filter((v) => v.room.id !== room.id).map((v) => v.dot)]
    const spot =
      w !== undefined && w <= size.w - EDGE * 2
        ? [ay - PIN_H / 2, ay - PIN_H - DOT / 2, ay + DOT / 2]
            .map((y) => {
              const left = clamp(ax - w / 2, EDGE, size.w - EDGE - w)
              const top = clamp(y, EDGE, size.h - EDGE - PIN_H)
              return { left, top, right: left + w, bottom: top + PIN_H }
            })
            .find((rect) => !blockers.some((b) => overlaps(b, rect)))
        : undefined
    if (spot) {
      placed.push(spot)
      out.push({ room, mode: "label", left: spot.left, top: spot.top })
    } else {
      out.push({ room, mode: "dot", left: dot.left, top: dot.top })
    }
  }
  return out
}

function PinContent({ room, lit }: { room: Room; lit: boolean }) {
  const status = room.scanned ? "scanned" : "not scanned"
  return (
    <>
      {lit ? (
        <PlanPin />
      ) : (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", room.scanned ? "bg-status-lifted" : "bg-status-queued")}
        />
      )}
      <span>{room.name}</span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <span className={cn(room.scanned ? "text-status-lifted" : "text-muted-foreground")}>{status}</span>
    </>
  )
}

const LABEL_CLASS =
  "flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card/90 px-2 py-1 text-label font-medium shadow-sm backdrop-blur-sm"

/**
 * The plant floor plan with one clickable zone per room, inside a pan/zoom viewport.
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
  const [widths, setWidths] = React.useState<Partial<Record<RoomId, number>>>({})
  const measureRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    const measure = () => {
      const next: Partial<Record<RoomId, number>> = {}
      el.querySelectorAll<HTMLElement>("[data-measure]").forEach((n) => {
        next[n.dataset.measure as RoomId] = Math.ceil(n.getBoundingClientRect().width)
      })
      setWidths(next)
    }
    measure()
    document.fonts?.ready.then(measure)
  }, [hits])

  const layer = (
    <>
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
    </>
  )

  const overlay = (view: PlanView, size: ViewportSize) => (
    <div className="pointer-events-none absolute inset-0">
      {layoutPins(view, size, widths, hits, focusRoom).map(({ room, mode, left, top }) => {
        const lit = hits?.has(room.id) ?? false
        const dim = hits !== null && !lit && focusRoom !== room.id
        const status = room.scanned ? "scanned" : "not scanned"
        const label = `${room.name}, ${status}${lit ? ", has matches" : ""}${room.scanned ? " — open in 3D" : ""}`
        const common = {
          type: "button" as const,
          "aria-label": label,
          onPointerEnter: () => setHovered(room.id),
          onPointerLeave: () => setHovered(null),
          onFocus: () => setHovered(room.id),
          onBlur: () => setHovered(null),
          onClick: () => onRoom(room),
          style: { left, top },
        }
        const stateClass = cn(
          "pointer-events-auto absolute motion-transition transition-opacity duration-200",
          dim && "opacity-40",
        )

        if (mode === "label") {
          return (
            <button
              key={room.id}
              {...common}
              className={cn(stateClass, LABEL_CLASS, focusRoom === room.id && "border-status-active")}
            >
              <PinContent room={room} lit={lit} />
            </button>
          )
        }
        return (
          <Tooltip key={room.id}>
            <TooltipTrigger asChild>
              <button
                {...common}
                className={cn(stateClass, "flex items-center justify-center rounded-full")}
                style={{ ...common.style, width: DOT, height: DOT }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-3 items-center justify-center rounded-full border-2 border-background shadow-sm",
                    lit ? "bg-status-active" : room.scanned ? "bg-status-lifted" : "bg-status-queued",
                    focusRoom === room.id && "ring-2 ring-status-active",
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {room.name} · {status}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )

  return (
    <>
      <PlanViewport layer={layer} overlay={overlay} />
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible fixed top-0 left-0 flex flex-col items-start">
        {ROOMS.map((room) => (
          <span key={room.id} data-measure={room.id} className={LABEL_CLASS}>
            <PinContent room={room} lit={hits?.has(room.id) ?? false} />
          </span>
        ))}
      </div>
    </>
  )
}
