"use client"

import * as React from "react"
import { PLAN, ROOMS, STORAGE_KEYS } from "@/lib/data"
import { cn } from "@/lib/utils"

/** Screen-space transform of the plan: plan point (px, py) lands at (x + px·s, y + py·s). */
export type PlanView = { s: number; x: number; y: number }
export type ViewportSize = { w: number; h: number }

const FIT_PAD = 12
const DRAG_SLOP = 6
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 30

/**
 * The building inside the plan image, with a small margin. The drawing has wide empty margins, so fitting
 * and panning use this box instead of the whole image: the building fills the screen.
 */
export const BOX = (() => {
  const m = 28
  const xs = ROOMS.flatMap((r) => r.polygon.map((p) => p[0]))
  const ys = ROOMS.flatMap((r) => r.polygon.map((p) => p[1]))
  const x = Math.max(0, Math.min(...xs) - m)
  const y = Math.max(0, Math.min(...ys) - m)
  return { x, y, w: Math.min(PLAN.width, Math.max(...xs) + m) - x, h: Math.min(PLAN.height, Math.max(...ys) + m) - y }
})()

/** Offsets that centre the building box at scale `s`. */
const centred = (s: number, { w, h }: ViewportSize): PlanView => ({
  s,
  x: (w - BOX.w * s) / 2 - BOX.x * s,
  y: (h - BOX.h * s) / 2 - BOX.y * s,
})

function fitView(size: ViewportSize): PlanView {
  return centred(Math.min((size.w - FIT_PAD * 2) / BOX.w, (size.h - FIT_PAD * 2) / BOX.h), size)
}

const FILL_BELOW = 600

/**
 * Starting view. On narrow portrait screens the whole plan is a thin strip, so it opens filling
 * the available height and pans sideways; pinching out still reaches the whole-plan fit.
 */
function initialView(size: ViewportSize): PlanView {
  const fit = fitView(size)
  if (size.w >= FILL_BELOW) return fit
  const fill = Math.min(fit.s * PLAN.maxZoom, (size.h - FIT_PAD * 2) / BOX.h)
  if (fill <= fit.s) return fit
  return clampView(centred(fill, size), size)
}

function clampAxis(offset: number, content: number, viewport: number) {
  if (content <= viewport) return (viewport - content) / 2
  return Math.min(0, Math.max(viewport - content, offset))
}

function clampView(view: PlanView, size: ViewportSize): PlanView {
  const fit = fitView(size).s
  const s = Math.min(fit * PLAN.maxZoom, Math.max(fit, view.s))
  const x = clampAxis(view.x + BOX.x * s, BOX.w * s, size.w) - BOX.x * s
  const y = clampAxis(view.y + BOX.y * s, BOX.h * s, size.h) - BOX.y * s
  return { s, x, y }
}

/** Scale to `s` while keeping screen point (cx, cy) over the same plan point. */
function zoomAround(from: PlanView, s: number, cx: number, cy: number, size: ViewportSize): PlanView {
  const fit = fitView(size).s
  const next = Math.min(fit * PLAN.maxZoom, Math.max(fit, s))
  const px = (cx - from.x) / from.s
  const py = (cy - from.y) / from.s
  return clampView({ s: next, x: cx - px * next, y: cy - py * next }, size)
}

type Pt = { x: number; y: number }
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Pinch-to-zoom / drag-to-pan container for the floor plan. Starts fitted to the whole plan
 * (filling the height on narrow screens); double-tap (or double-click) resets. `layer` is drawn in plan pixels and transformed;
 * `overlay` gets the live view so it can place screen-space UI (pins) that never scales.
 */
export function PlanViewport({
  layer,
  overlay,
  className,
}: {
  layer: React.ReactNode
  overlay: (view: PlanView, size: ViewportSize) => React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<ViewportSize | null>(null)
  const [view, setView] = React.useState<PlanView | null>(null)
  const [hint, setHint] = React.useState(false)

  const viewRef = React.useRef(view)
  viewRef.current = view
  const sizeRef = React.useRef(size)
  sizeRef.current = size

  const pointers = React.useRef(new Map<number, Pt>())
  const gesture = React.useRef<{ view: PlanView; a: Pt; b: Pt | null } | null>(null)
  const dragged = React.useRef(false)
  const lastTap = React.useRef<{ t: number; p: Pt } | null>(null)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const next = { w: el.clientWidth, h: el.clientHeight }
      if (!next.w || !next.h) return
      setSize((prev) => {
        if (prev && prev.w === next.w && prev.h === next.h) return prev
        setView(initialView(next))
        return next
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  React.useEffect(() => {
    try {
      if (window.matchMedia("(pointer: coarse)").matches && !localStorage.getItem(STORAGE_KEYS.planHintSeen)) {
        setHint(true)
      }
    } catch {
      // Storage unavailable: skip the hint rather than show it on every visit.
    }
  }, [])

  const dismissHint = React.useCallback(() => {
    setHint((shown) => {
      if (shown) {
        try {
          localStorage.setItem(STORAGE_KEYS.planHintSeen, "1")
        } catch {}
      }
      return false
    })
  }, [])

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const restartGesture = () => {
    const pts = [...pointers.current.values()]
    gesture.current = viewRef.current && pts[0] ? { view: viewRef.current, a: pts[0], b: pts[1] ?? null } : null
  }

  const reset = React.useCallback(() => {
    if (sizeRef.current) setView(initialView(sizeRef.current))
  }, [])

  React.useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, local(e))
      const g = gesture.current
      const sz = sizeRef.current
      if (!g || !sz) return
      const pts = [...pointers.current.values()]
      if (g.b && pts.length >= 2) {
        dragged.current = true
        const m0 = mid(g.a, g.b)
        const m1 = mid(pts[0], pts[1])
        const s = g.view.s * (dist(pts[0], pts[1]) / Math.max(1, dist(g.a, g.b)))
        const zoomed = zoomAround(g.view, s, m0.x, m0.y, sz)
        setView(clampView({ ...zoomed, x: zoomed.x + (m1.x - m0.x), y: zoomed.y + (m1.y - m0.y) }, sz))
      } else if (pts.length === 1) {
        const dx = pts[0].x - g.a.x
        const dy = pts[0].y - g.a.y
        if (!dragged.current && Math.hypot(dx, dy) < DRAG_SLOP) return
        dragged.current = true
        setView(clampView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy }, sz))
      }
    }
    function onUp(e: PointerEvent) {
      if (!pointers.current.has(e.pointerId)) return
      const p = pointers.current.get(e.pointerId)!
      pointers.current.delete(e.pointerId)
      if (pointers.current.size === 0 && !dragged.current && e.pointerType !== "mouse") {
        const prev = lastTap.current
        if (prev && e.timeStamp - prev.t < DOUBLE_TAP_MS && dist(prev.p, p) < DOUBLE_TAP_PX) {
          lastTap.current = null
          reset()
        } else {
          lastTap.current = { t: e.timeStamp, p }
        }
      }
      restartGesture()
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [reset])

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    // Native listener: React's wheel handler is passive and can't stop the page from scrolling.
    function onWheel(e: WheelEvent) {
      const v = viewRef.current
      const sz = sizeRef.current
      if (!v || !sz) return
      e.preventDefault()
      const p = local(e)
      setView(zoomAround(v, v.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y, sz))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <div
      ref={ref}
      className={cn("relative size-full touch-none select-none overflow-hidden", className)}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        dismissHint()
        if (pointers.current.size === 0) dragged.current = false
        pointers.current.set(e.pointerId, local(e))
        restartGesture()
      }}
      onClickCapture={(e) => {
        if (dragged.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onDoubleClick={(e) => {
        if (!dragged.current) {
          e.preventDefault()
          reset()
        }
      }}
    >
      {view && (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: PLAN.width,
            height: PLAN.height,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
          }}
        >
          {layer}
        </div>
      )}
      {view && size && overlay(view, size)}

      {hint && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto w-fit rounded-full border bg-card/95 px-3 py-1.5 text-label text-muted-foreground shadow-sm backdrop-blur-sm"
        >
          Pinch to zoom · drag to pan
        </p>
      )}
    </div>
  )
}
