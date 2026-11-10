"use client"

import * as React from "react"
import { LIVE_WORLD, OBJECT_PALETTE, type WorldObject } from "@/lib/data"
import { cn } from "@/lib/utils"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import type { Project } from "@/components/world/splat-canvas"

export type MarkersHandle = { place: (project: Project) => void }

/**
 * The marker sits on the object's own splats: the pose target, which is the centre of the splats inside the
 * object's still-frame mask. It stays on the object from any angle, unlike a 2D label lifted off the still.
 */
function anchorOf(o: WorldObject): [number, number, number] | null {
  return LIVE_WORLD.poses[o.id]?.target ?? null
}

/**
 * Hotspots on the live world. A splat can't be segmented per object yet (the scene is one static cloud),
 * so each object gets a marker pinned to a 3D anchor (see `anchorOf`).
 * The canvas moves them every frame through `place`; React only re-renders on hover, selection or framing.
 */
export const SplatMarkers = React.forwardRef<MarkersHandle>(function SplatMarkers(_, ref) {
  const { state, select, hover, frame, openCard } = useWorld()
  const nodes = React.useRef(new Map<string, HTMLButtonElement>())

  const objects = state.objects.filter((o) => DRAWABLE.includes(o.status) && anchorOf(o))
  const anchors = React.useRef(new Map<string, [number, number, number]>())
  anchors.current = new Map(objects.map((o) => [o.id, anchorOf(o)!]))
  const selected = new Set(state.selection)

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
        const expanded = isSel || isHover || isFramed
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
              "pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-black/75 py-1 pr-2 pl-1.5 text-label font-medium text-scene-ink shadow-sm backdrop-blur-sm",
              "invisible will-change-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              !expanded && "pr-1.5",
              (isSel || isFramed) && "z-10",
            )}
            style={{ borderColor: expanded ? color : "transparent" }}
          >
            <span className="relative grid size-2.5 place-items-center">
              {isFramed && (
                <span
                  aria-hidden
                  className="pin-pulse absolute inset-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              <span aria-hidden className="relative size-2.5 rounded-full" style={{ backgroundColor: color }} />
            </span>
            <span className={cn(!expanded && "sr-only")}>{o.name}</span>
          </button>
        )
      })}
    </div>
  )
})
