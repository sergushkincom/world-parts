"use client"

import * as React from "react"
import {
  MEASURE_DRAW_MS,
  distanceMetres,
  formatCountedMetres,
  measureStatus,
  midpoint,
  pointAlong,
  shownMetres,
  tapeProgress,
  type MeasureIssue,
  type MeasurePoint,
} from "@/lib/measure"
import type { Project } from "@/components/world/splat-canvas"

export type MeasureOverlayHandle = { place: (project: Project) => void }

/**
 * The tape, in the same screen space as the callouts. When the second point lands, the line
 * extends from the first and the metres label at the midpoint counts up (600 ms, ease-out).
 * Reduced motion draws the finished tape. A screen reader hears that finished distance at once;
 * the chip on screen counts with the label.
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
  const projectRef = React.useRef<Project | null>(null)
  const progressRef = React.useRef(1)
  pointsRef.current = points
  const pair = pairKey(points)
  const [prevPair, setPrevPair] = React.useState(pair)
  const [progress, setProgress] = React.useState(1)
  // A new pair starts the draw again. Setting state during render drops the in-between frame
  // where the new tape would already show its finished length.
  if (pair !== prevPair) {
    const next = pair === "" || prefersReducedMotion() ? 1 : 0
    progressRef.current = next
    setPrevPair(pair)
    setProgress(next)
  } else {
    progressRef.current = progress
  }

  React.useEffect(() => {
    if (!pair || prefersReducedMotion()) return
    const started = performance.now()
    let raf = 0
    // Wall clock, so a slow frame still lands on the right point of the 600 ms.
    const tick = () => {
      const next = tapeProgress(performance.now() - started, prefersReducedMotion(), MEASURE_DRAW_MS)
      progressRef.current = next
      setProgress(next)
      if (next < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pair])

  const draw = React.useCallback((project: Project) => {
    projectRef.current = project
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
    const grow = progressRef.current
    const from = current[0]
    const to = current[1]
    const tipWorld = from && to ? pointAlong(from, to, grow) : null
    const a = from ? project([from.x, from.y, from.z]) : null
    const b = to ? project([to.x, to.y, to.z]) : null
    const tip = tipWorld ? project([tipWorld.x, tipWorld.y, tipWorld.z]) : null
    show(aRef.current, a)
    show(bRef.current, b)
    const line = lineRef.current
    const edge = edgeRef.current
    const both = grow > 0 && Boolean(a?.visible && tip?.visible && line && edge && a && tip)
    for (const node of [line, edge]) {
      if (!node) continue
      if (!both || !a || !tip) {
        node.style.visibility = "hidden"
        continue
      }
      node.style.visibility = "visible"
      node.setAttribute("x1", String(a.x))
      node.setAttribute("y1", String(a.y))
      node.setAttribute("x2", String(tip.x))
      node.setAttribute("y2", String(tip.y))
    }
    if (current.length >= 2 && labelRef.current) {
      const mid = midpoint(current[0], current[1])
      const at = project([mid.x, mid.y, mid.z])
      show(labelRef.current, at.visible ? { ...at, y: at.y - 16 } : null)
    }
  }, [])

  React.useLayoutEffect(() => {
    const project = projectRef.current
    if (project) draw(project)
  }, [draw, progress, points])

  React.useImperativeHandle(ref, () => ({ place: draw }), [draw])

  const spoken = measureStatus(points, issue)
  const finalMetres = points.length >= 2 ? distanceMetres(points[0], points[1]) : null
  const shown = finalMetres == null ? null : shownMetres(finalMetres, progress)
  const reading = shown == null || finalMetres == null ? null : `≈ ${formatCountedMetres(shown, finalMetres)}`
  const visibleStatus = shown == null ? spoken : measureStatus(points, issue, shown)

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
        data-measure-status
        className="absolute bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] left-1/2 max-w-[min(22rem,calc(100vw-8rem))] -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-center text-label text-scene-ink shadow-lg"
      >
        <span className="sr-only" role="status">
          {spoken}
        </span>
        <span aria-hidden>{visibleStatus}</span>
      </p>
    </div>
  )
})

function pairKey(points: readonly MeasurePoint[]) {
  if (points.length < 2) return ""
  const a = points[0]
  const b = points[1]
  return `${a.x},${a.y},${a.z}|${b.x},${b.y},${b.z}`
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function Mark({ nodeRef }: { nodeRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <span
      ref={nodeRef}
      aria-hidden
      className="invisible absolute top-0 left-0 size-3 rounded-full border-2 border-black bg-white shadow"
    />
  )
}
