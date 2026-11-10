"use client"

import * as React from "react"
import { LIVE_WORLD, OBJECT_PALETTE, type WorldObject } from "@/lib/data"
import { formatCount } from "@/lib/geometry"
import type { SplatStats } from "@/lib/splat-mask"
import { cn } from "@/lib/utils"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import type { Project } from "@/components/world/splat-canvas"

export type MarkersHandle = { place: (project: Project) => void }

/** The centre of the object's own splats (lifted from its still mask), else its hand-measured pose target. */
function anchorOf(o: WorldObject, stats: Map<string, SplatStats>): [number, number, number] | null {
  return stats.get(o.id)?.anchor ?? LIVE_WORLD.poses[o.id]?.target ?? null
}

/**
 * The still's object labels, pinned to the live world. Same pill as on the still frame (dot, name, splat count),
 * but anchored in 3D, so it stays on the object from any angle. The canvas moves them every frame through
 * `place`; React only re-renders on hover, selection or framing.
 */
export const SplatMarkers = React.forwardRef<MarkersHandle, { stats: Map<string, SplatStats> }>(function SplatMarkers(
  { stats },
  ref,
) {
  const { state, select, hover, frame, openCard } = useWorld()
  const nodes = React.useRef(new Map<string, HTMLButtonElement>())

  const objects = state.objects.filter((o) => DRAWABLE.includes(o.status) && anchorOf(o, stats))
  const selected = new Set(state.selection)
  const anchors = React.useRef(new Map<string, [number, number, number]>())
  anchors.current = new Map(objects.map((o) => [o.id, anchorOf(o, stats)!]))

  React.useImperativeHandle(ref, () => ({
    place: (project) => {
      for (const [id, el] of nodes.current) {
        const anchor = anchors.current.get(id)
        if (!anchor) continue
        const p = project(anchor)
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`
        el.style.visibility = p.visible ? "visible" : "hidden"
      }
    },
  }))

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" role="group" aria-label="Objects in the 3D world">
      {objects.map((o) => {
        const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
        const isSel = selected.has(o.id)
        const isHover = state.hoveredId === o.id
        const isFramed = state.framedId === o.id
        const active = isSel || isHover || isFramed
        // As on the still: under the panel breakpoint only the active object keeps its text.
        const compact = !active
        return (
          <button
            key={o.id}
            ref={(el) => {
              if (el) nodes.current.set(o.id, el)
              else nodes.current.delete(o.id)
            }}
            type="button"
            aria-label={`${o.name}: show in the world`}
            aria-pressed={isSel}
            onPointerEnter={() => hover(o.id)}
            onPointerLeave={() => hover(null)}
            onFocus={() => hover(o.id)}
            onBlur={() => hover(null)}
            onClick={() => {
              select(o.id, "only")
              frame(o.id)
              openCard(o.id, "part")
            }}
            className={cn(
              "pointer-events-auto invisible absolute top-0 left-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-black/75 px-2 py-0.5 text-label font-medium text-scene-ink shadow-sm backdrop-blur-sm will-change-transform",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              compact && "max-panel:p-1.5",
              active && "z-10",
            )}
            style={{ borderColor: active ? color : "transparent" }}
          >
            <span className="relative grid size-2 place-items-center">
              {isFramed && (
                <span aria-hidden className="pin-pulse absolute inset-0 rounded-full" style={{ backgroundColor: color }} />
              )}
              <span aria-hidden className="relative size-2 rounded-full" style={{ backgroundColor: color }} />
            </span>
            <span className={cn(compact && "max-panel:hidden")}>{o.name}</span>
            <span className={cn("tabular-nums text-scene-ink/60", compact && "max-panel:hidden")}>
              {formatCount(o.splats ?? 0)}
            </span>
          </button>
        )
      })}
    </div>
  )
})
