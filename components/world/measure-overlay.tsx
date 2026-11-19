"use client"

import * as React from "react"
import { distanceMetres, formatMetres, measureStatus, midpoint, type MeasureIssue, type MeasurePoint } from "@/lib/measure"
import type { Project } from "@/components/world/splat-canvas"

export type MeasureOverlayHandle = { place: (project: Project) => void }

/**
 * The tape, in the same screen space as the callouts. Nothing here moves on its own, so reduced
 * motion has no animation to turn off. The status line is the accessible reading; the midpoint
 * label repeats it for the eye.
 */
export const MeasureOverlay = React.forwardRef<
  MeasureOverlayHandle,
  { points: readonly MeasurePoint[]; issue: MeasureIssue }
>(function MeasureOverlay({ points, issue }, ref) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const lineRef = React.useRef<SVGLineElement>(null)
  const edgeRef = React.useRef<SVGLineElement>(null)
  const aRef = React.useRef<HTMLSpanElement>(null)
  const bRef = React.useRef<HTMLSpanElement>(null)
  const labelRef = React.useRef<HTMLSpanElement>(null)
  const pointsRef = React.useRef(points)
  pointsRef.current = points
  const reading = points.length >= 2 ? `≈ ${formatMetres(distanceMetres(points[0], points[1]))}` : null

  React.useImperativeHandle(ref, () => ({
    place: (project) => {
      const svg = svgRef.current
      const current = pointsRef.current
      if (!svg) return
      const width = svg.clientWidth
      const height = svg.clientHeight
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`)
      const show = (el: HTMLElement | null, at: { x: number; y: number; visible: boolean } | null) => {
        if (!el) return
        if (!at?.visible) {
          el.style.visibility = "hidden"
          return
        }
        el.style.visibility = "visible"
        el.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) translate(-50%, -50%)`
      }
      const a = current[0] ? project([current[0].x, current[0].y, current[0].z]) : null
      const b = current[1] ? project([current[1].x, current[1].y, current[1].z]) : null
      show(aRef.current, a)
      show(bRef.current, b)
      const line = lineRef.current
      const edge = edgeRef.current
      const both = Boolean(a?.visible && b?.visible && line && edge && a && b)
      for (const node of [line, edge]) {
        if (!node) continue
        if (!both || !a || !b) {
          node.style.visibility = "hidden"
          continue
        }
        node.style.visibility = "visible"
        node.setAttribute("x1", String(a.x))
        node.setAttribute("y1", String(a.y))
        node.setAttribute("x2", String(b.x))
        node.setAttribute("y2", String(b.y))
      }
      if (current.length >= 2 && labelRef.current) {
        const mid = midpoint(current[0], current[1])
        const at = project([mid.x, mid.y, mid.z])
        show(labelRef.current, at.visible ? { ...at, y: at.y - 16 } : null)
      }
    },
  }))

  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-measure-overlay>
      <svg ref={svgRef} className="absolute inset-0 h-full w-full" aria-hidden>
        <line ref={edgeRef} stroke="black" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round" visibility="hidden" />
        <line ref={lineRef} stroke="#e6aa3c" strokeWidth="2" strokeLinecap="round" visibility="hidden" />
      </svg>
      <Mark nodeRef={aRef} />
      {points.length >= 2 && <Mark nodeRef={bRef} />}
      {reading && (
        <span
          ref={labelRef}
          aria-hidden
          data-measure-label
          className="invisible absolute top-0 left-0 rounded-full bg-black/80 px-2 py-0.5 text-label font-medium text-scene-ink tabular-nums shadow-lg"
        >
          {reading}
        </span>
      )}
      <p
        role="status"
        data-measure-status
        className="absolute bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] left-1/2 max-w-[min(22rem,calc(100vw-8rem))] -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-center text-label text-scene-ink shadow-lg"
      >
        {measureStatus(points, issue)}
      </p>
    </div>
  )
})

function Mark({ nodeRef }: { nodeRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <span
      ref={nodeRef}
      aria-hidden
      className="invisible absolute top-0 left-0 size-3 rounded-full border-2 border-black bg-white shadow"
    />
  )
}
