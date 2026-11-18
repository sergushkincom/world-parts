"use client"

import * as React from "react"
import { OBJECT_PALETTE, worldOf, type CameraPose, type WorldObject } from "@/lib/data"
import {
  calloutButtonName,
  calloutDetail,
  calloutMetrics,
  layoutCallout,
  productCallout,
  type CalloutAvailability,
  type CalloutSide,
} from "@/lib/callouts"
import type { SplatStats } from "@/lib/splat-mask"
import { cn } from "@/lib/utils"
import { useElementSize } from "@/hooks/use-element-size"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import type { Project } from "@/components/world/splat-canvas"

export type MarkersHandle = { place: (project: Project) => void }

/** The centre of the object's own splats (lifted from its still mask), else its hand-measured pose target. */
function anchorOf(
  o: WorldObject,
  stats: Map<string, SplatStats>,
  poses: Record<string, CameraPose>,
): [number, number, number] | null {
  return stats.get(o.id)?.anchor ?? poses[o.id]?.target ?? null
}

function detailTone(availability: CalloutAvailability | null) {
  if (availability === "low") return "text-status-low"
  if (availability === "in stock") return "text-status-lifted"
  return "text-scene-ink/60"
}

type MarkerNode = {
  button?: HTMLButtonElement
  dot?: HTMLSpanElement
  leader?: SVGGElement
}

/**
 * Product callouts for the live world. A dot stays on the object; a leader runs
 * to a card (name, number, stock or availability) on the clearer side of the
 * screen. `place` moves them every frame. React only re-renders for hover,
 * selection, framing, or a resize.
 */
type MarkersProps = {
  stats: Map<string, SplatStats>
  /** Replaces the default click: select, frame and open the card. */
  onPick?: (id: string) => void
}

export const SplatMarkers = React.forwardRef<MarkersHandle, MarkersProps>(function SplatMarkers({ stats, onPick }, ref) {
  const { state, select, hover, frame, openCard } = useWorld()
  const poses = worldOf(state.roomId).poses
  const rootRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const nodes = React.useRef(new Map<string, MarkerNode>())
  const sides = React.useRef(new Map<string, CalloutSide>())
  const size = useElementSize(rootRef)
  const compact = size.width > 0 && size.width < 900

  const objects = state.objects.filter((o) => DRAWABLE.includes(o.status) && anchorOf(o, stats, poses))
  const anchors = React.useRef(new Map<string, [number, number, number]>())
  anchors.current = new Map(objects.map((o) => [o.id, anchorOf(o, stats, poses)!]))
  const chrome = React.useRef({ cardOpen: false })
  chrome.current.cardOpen = state.cardId != null

  const focusId =
    (state.hoveredId && anchors.current.has(state.hoveredId) ? state.hoveredId : null) ??
    (state.framedId && anchors.current.has(state.framedId) ? state.framedId : null) ??
    (state.selection.length === 1 && anchors.current.has(state.selection[0]) ? state.selection[0] : null)
  const ordered = focusId ? [...objects.filter((o) => o.id !== focusId), ...objects.filter((o) => o.id === focusId)] : objects

  const bind = <K extends keyof MarkerNode>(id: string, key: K) => (el: MarkerNode[K] | null) => {
    const current = nodes.current.get(id)
    if (!el) {
      if (!current) return
      delete current[key]
      if (!current.button && !current.dot && !current.leader) nodes.current.delete(id)
      return
    }
    const next = current ?? {}
    next[key] = el
    nodes.current.set(id, next)
  }

  React.useImperativeHandle(ref, () => ({
    place: (project) => {
      const root = rootRef.current
      if (!root) return
      const viewportWidth = root.clientWidth
      const viewportHeight = root.clientHeight
      if (viewportWidth <= 0 || viewportHeight <= 0) return
      const metrics = calloutMetrics(viewportWidth)
      svgRef.current?.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`)
      // Clear the toolbar and the view pill. On a narrow pane also clear the map
      // button and the door chip; with the part card open on a wide pane, leave
      // the right side for that card.
      const insets = metrics.compact
        ? { top: 60, right: 100, bottom: 68, left: 60 }
        : { top: 44, right: chrome.current.cardOpen ? 336 : 0, bottom: 44, left: 0 }
      for (const [id, node] of nodes.current) {
        const anchor = anchors.current.get(id)
        if (!node.button || !node.dot || !node.leader || !anchor) continue
        const projected = project(anchor)
        const visibility = projected.visible ? "visible" : "hidden"
        const dotOnly = node.button.dataset.mode === "dot"
        node.button.style.visibility = visibility
        node.dot.style.visibility = dotOnly ? "hidden" : visibility
        node.leader.style.visibility = dotOnly ? "hidden" : visibility
        if (!projected.visible) continue
        if (dotOnly) {
          node.button.style.transform = `translate3d(${projected.x}px, ${projected.y}px, 0) translate(-50%, -50%)`
          continue
        }
        const cardWidth = node.button.offsetWidth || (metrics.compact ? 132 : 168)
        const cardHeight = node.button.offsetHeight || (metrics.compact ? 36 : 56)
        const layout = layoutCallout({
          anchorX: projected.x,
          anchorY: projected.y,
          viewportWidth,
          viewportHeight,
          cardWidth,
          cardHeight,
          gap: metrics.gap,
          margin: metrics.margin,
          previousSide: sides.current.get(id) ?? null,
          slack: metrics.slack,
          insets,
        })
        sides.current.set(id, layout.side)
        node.button.style.transform = `translate3d(${layout.card.x}px, ${layout.card.y}px, 0)`
        node.dot.style.transform = `translate3d(${projected.x}px, ${projected.y}px, 0) translate(-50%, -50%)`
        const attach = layout.attach
        for (const line of node.leader.querySelectorAll("line")) {
          line.setAttribute("x1", String(attach ? projected.x : 0))
          line.setAttribute("y1", String(attach ? projected.y : 0))
          line.setAttribute("x2", String(attach ? attach.x : 0))
          line.setAttribute("y2", String(attach ? attach.y : 0))
        }
      }
    },
  }))

  const pick = (id: string) => {
    if (onPick) return onPick(id)
    select(id, "only")
    frame(id)
    openCard(id, "part")
  }

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 overflow-hidden" role="group" aria-label="Objects in the 3D world">
      <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
        {ordered.map((o) => {
          const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
          const dimmed = focusId != null && focusId !== o.id
          return (
            <g
              key={o.id}
              ref={bind(o.id, "leader")}
              className={cn(
                "invisible motion-transition transition-opacity duration-200",
                dimmed && "opacity-40",
                compact && focusId !== o.id && "hidden",
              )}
            >
              <line stroke="black" strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" />
              <line stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )
        })}
      </svg>
      {ordered.map((o) => {
        const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
        const emphasized = focusId === o.id
        const dimmed = focusId != null && !emphasized
        const framed = state.framedId === o.id && !dimmed
        const dotOnly = compact && !emphasized
        return (
          <span
            key={o.id}
            ref={bind(o.id, "dot")}
            aria-hidden
            hidden={dotOnly}
            onPointerEnter={() => hover(o.id)}
            onPointerLeave={() => hover(null)}
            onClick={() => pick(o.id)}
            className={cn(
              "pointer-events-auto invisible absolute top-0 left-0 grid size-6 cursor-pointer place-items-center will-change-transform",
              "motion-transition transition-opacity duration-200",
              emphasized && "z-10",
              dimmed && "opacity-40",
            )}
          >
            <span className="relative grid size-2.5 place-items-center">
              {framed && <span className="pin-pulse absolute inset-0 rounded-full" style={{ backgroundColor: color }} />}
              <span className="relative size-2.5 rounded-full ring-2 ring-black/50" style={{ backgroundColor: color }} />
              <span className="absolute size-1 rounded-full bg-white" />
            </span>
          </span>
        )
      })}
      {ordered.map((o) => {
        const product = productCallout(o)
        const detail = calloutDetail(product)
        const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
        const emphasized = focusId === o.id
        const dimmed = focusId != null && !emphasized
        const dotOnly = compact && !emphasized
        const showDetail = Boolean(detail) && (!compact || emphasized)
        return (
          <button
            key={o.id}
            ref={bind(o.id, "button")}
            type="button"
            data-callout={o.id}
            data-mode={dotOnly ? "dot" : "card"}
            aria-label={calloutButtonName(product)}
            aria-pressed={state.selection.includes(o.id)}
            onPointerEnter={() => hover(o.id)}
            onPointerLeave={() => hover(null)}
            onFocus={() => hover(o.id)}
            onBlur={() => hover(null)}
            onClick={() => pick(o.id)}
            className={cn(
              "pointer-events-auto invisible absolute top-0 left-0 will-change-transform",
              "motion-transition transition-opacity duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              dotOnly
                ? "grid size-6 place-items-center rounded-full"
                : "w-max max-w-48 rounded-md border bg-black/80 px-2.5 py-1.5 text-left text-scene-ink shadow-md backdrop-blur-sm",
              !dotOnly && compact && "max-w-36 px-2 py-1",
              emphasized && "z-10 shadow-lg",
              dimmed && "opacity-40",
            )}
            style={dotOnly ? undefined : { borderColor: emphasized ? color : "transparent" }}
          >
            {dotOnly ? (
              <span className="relative grid size-2.5 place-items-center">
                <span className="size-2.5 rounded-full ring-2 ring-black/50" style={{ backgroundColor: color }} />
                <span className="absolute size-1 rounded-full bg-white" />
              </span>
            ) : (
              <>
                <span className="block truncate text-row font-medium leading-4">{product.name}</span>
                {product.partNo && (
                  <span className="block truncate font-mono text-label leading-4 text-scene-ink/70">{product.partNo}</span>
                )}
                {showDetail && (
                  <span className={cn("block truncate text-label leading-4", detailTone(product.availability))}>{detail}</span>
                )}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
})
