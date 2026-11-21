"use client"

import * as React from "react"
import type { CameraView } from "@/lib/minimap"
import {
  GUIDE_DOT_RADIUS,
  GUIDE_HIDE_WITHIN,
  GUIDE_LINE_HALF_WIDTH,
  GUIDE_RING_RADIUS,
  GUIDE_SHOW_BEYOND,
  chevronsAlong,
  circlePoints,
  clipSegment,
  floorRibbon,
  guideDuration,
  guideProgress,
  guideRun,
  marchShift,
  pointAlongRun,
  type FloorPoint,
  type GuideSpot,
} from "@/lib/guide"
import type { Project, ScreenPoint } from "@/components/world/splat-canvas"

export type FloorPathHandle = { place: (project: Project, view: CameraView) => void }

const AMBER = "#FFC850"

/**
 * The route on the floor, in the same screen space as the callouts. `place` runs every frame
 * and writes the DOM, so walking does not re-render. The line is a ribbon in metres, so it
 * lies down and tapers. The chevrons are a screen stroke, so a far one stays readable.
 * Reduced motion shows the finished path and does not march the chevrons.
 */
export const FloorPath = React.forwardRef<FloorPathHandle, { target: GuideSpot; floorY: number }>(
  function FloorPath({ target, floorY }, ref) {
    const rootRef = React.useRef<HTMLDivElement>(null)
    const svgRef = React.useRef<SVGSVGElement>(null)
    const shadeRef = React.useRef<SVGPolygonElement>(null)
    const lineRef = React.useRef<SVGPolygonElement>(null)
    const chevronShadeRef = React.useRef<SVGPathElement>(null)
    const chevronRef = React.useRef<SVGPathElement>(null)
    const ringRef = React.useRef<SVGPolylineElement>(null)
    const dotRef = React.useRef<SVGPolygonElement>(null)
    const spotRef = React.useRef(target)
    const floorRef = React.useRef(floorY)
    const bornRef = React.useRef(0)
    const holdingRef = React.useRef(false)
    spotRef.current = target
    floorRef.current = floorY

    const draw = React.useCallback((project: Project, view: CameraView) => {
      const root = rootRef.current
      const svg = svgRef.current
      if (!root || !svg) return
      const width = svg.clientWidth
      const height = svg.clientHeight
      if (width <= 0 || height <= 0) return
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`)

      const spot = spotRef.current
      const y = floorRef.current
      const from = { x: view.x, z: view.z }
      const dist = Math.hypot(spot.x - from.x, spot.z - from.z)
      if (holdingRef.current) {
        if (dist < GUIDE_HIDE_WITHIN) holdingRef.current = false
      } else if (dist > GUIDE_SHOW_BEYOND) {
        holdingRef.current = true
        bornRef.current = performance.now()
      }

      const clear = () => {
        for (const node of [
          shadeRef.current,
          lineRef.current,
          chevronShadeRef.current,
          chevronRef.current,
          ringRef.current,
          dotRef.current,
        ]) {
          node?.setAttribute("visibility", "hidden")
        }
      }

      if (!holdingRef.current) {
        root.dataset.floorPathState = "near"
        clear()
        return
      }

      const run = guideRun(from, spot)
      const reduced = prefersReducedMotion()
      const duration = run ? guideDuration(run.length) : 0
      const elapsed = performance.now() - bornRef.current
      const progress = run ? guideProgress(elapsed, reduced, duration) : 0
      if (!run) {
        root.dataset.floorPathState = "near"
        clear()
        return
      }

      const revealed = pointAlongRun(run, run.length * progress)
      const inFront = (p: FloorPoint) => project([p.x, y, p.z]).inFront === true
      const clipped = clipSegment(run.start, revealed, inFront)
      paintPolygon(shadeRef.current, project, y, clipped && floorRibbon(clipped.start, clipped.end, GUIDE_LINE_HALF_WIDTH * 1.75))
      paintPolygon(lineRef.current, project, y, clipped && floorRibbon(clipped.start, clipped.end, GUIDE_LINE_HALF_WIDTH))

      const shift = progress >= 1 ? marchShift(elapsed - duration, reduced) : 0
      const d = chevronsAlong(run, run.length * progress, shift)
        .map((mark) => {
          const left = placed(project([mark.left.x, y, mark.left.z]))
          const tip = placed(project([mark.tip.x, y, mark.tip.z]))
          const right = placed(project([mark.right.x, y, mark.right.z]))
          if (!left || !tip || !right) return ""
          return `M ${left} L ${tip} L ${right}`
        })
        .filter(Boolean)
        .join(" ")
      paintPath(chevronShadeRef.current, d)
      paintPath(chevronRef.current, d)

      const landed = progress > 0.84
      const fade = landed ? Math.min(1, (progress - 0.84) / 0.16) : 0
      paintPolyline(ringRef.current, landed ? projectOpen(project, y, circlePoints(run.place, GUIDE_RING_RADIUS)) : null, fade)
      paintPolygon(dotRef.current, project, y, landed ? circlePoints(run.place, GUIDE_DOT_RADIUS, 12) : null, fade)

      root.dataset.floorPathState = progress < 1 ? "drawing" : "shown"
    }, [])

    React.useImperativeHandle(ref, () => ({ place: draw }), [draw])

    return (
      <div
        ref={rootRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        data-floor-path
        data-floor-path-to={target.name}
        data-floor-path-state="drawing"
      >
        <svg ref={svgRef} className="absolute inset-0 h-full w-full" aria-hidden>
          <polygon ref={shadeRef} fill="black" fillOpacity={0.4} visibility="hidden" />
          <polygon ref={lineRef} fill={AMBER} fillOpacity={0.92} visibility="hidden" />
          <path
            ref={chevronShadeRef}
            fill="none"
            stroke="black"
            strokeOpacity={0.55}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            visibility="hidden"
          />
          <path
            ref={chevronRef}
            fill="none"
            stroke={AMBER}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            visibility="hidden"
          />
          <polyline
            ref={ringRef}
            fill="none"
            stroke={AMBER}
            strokeWidth={2}
            strokeLinejoin="round"
            visibility="hidden"
          />
          <polygon ref={dotRef} fill={AMBER} visibility="hidden" />
        </svg>
        <p className="sr-only" role="status">
          {`Floor path to ${target.name}. It clears when the selection does.`}
        </p>
      </div>
    )
  },
)

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** In front of the camera, with wild near-plane coordinates pulled back so the line can enter the view. */
function placed(p: ScreenPoint): string | null {
  if (p.inFront !== true || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
  const clamp = (v: number) => Math.min(8000, Math.max(-8000, v))
  return `${clamp(p.x).toFixed(1)} ${clamp(p.y).toFixed(1)}`
}

function paintPolygon(
  node: SVGPolygonElement | null,
  project: Project,
  y: number,
  points: FloorPoint[] | null,
  fade?: number,
) {
  if (!node) return
  if (!points || (fade !== undefined && fade <= 0)) {
    node.setAttribute("visibility", "hidden")
    return
  }
  const projected = points.map((p) => placed(project([p.x, y, p.z])))
  if (projected.some((p) => p == null)) {
    node.setAttribute("visibility", "hidden")
    return
  }
  node.setAttribute("visibility", "visible")
  if (fade !== undefined) node.setAttribute("fill-opacity", fade.toFixed(2))
  node.setAttribute("points", projected.map((p) => p!.replace(" ", ",")).join(" "))
}

function paintPath(node: SVGPathElement | null, d: string) {
  if (!node) return
  if (!d) {
    node.setAttribute("visibility", "hidden")
    return
  }
  node.setAttribute("visibility", "visible")
  node.setAttribute("d", d)
}

function projectOpen(project: Project, y: number, points: FloorPoint[]): string | null {
  const projected = points.map((p) => placed(project([p.x, y, p.z])))
  if (projected.some((p) => p == null)) return null
  return projected.map((p) => p!.replace(" ", ",")).join(" ")
}

function paintPolyline(node: SVGPolylineElement | null, points: string | null, opacity: number) {
  if (!node) return
  if (!points || opacity <= 0) {
    node.setAttribute("visibility", "hidden")
    return
  }
  node.setAttribute("visibility", "visible")
  node.setAttribute("stroke-opacity", opacity.toFixed(2))
  node.setAttribute("points", points)
}
