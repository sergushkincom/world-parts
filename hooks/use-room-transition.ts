"use client"

import * as React from "react"
import { TIMING, type RoomId } from "@/lib/data"
import { ROUTE_EVENT, parseRoute, type Route } from "@/hooks/use-hash-route"

type Box = { x: number; y: number; width: number; height: number }

function zoneBox(room: RoomId): Box | null {
  const el = document.querySelector(`[data-room-zone="${room}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width && r.height ? { x: r.left, y: r.top, width: r.width, height: r.height } : null
}

/**
 * Zoom-and-fade between the plant and a room, anchored on the room's zone in the floor plan.
 * Entering: the room view grows out of the zone. Leaving: the plant starts zoomed into the
 * zone and pulls back. Only the incoming view animates; skipped for reduced motion, for the
 * first render and for deep links (no navigation happened, so there is no origin).
 */
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Static copy of the outgoing plant, so it can stay on screen while it fades out.
 * cloneNode drops scroll offsets (the plan scrolls horizontally on mobile), so they are re-applied.
 */
function snapshot(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement
  const sourceNodes = source.querySelectorAll<HTMLElement>("*")
  const cloneNodes = clone.querySelectorAll<HTMLElement>("*")
  const scrolled: Array<[number, number, number]> = []
  sourceNodes.forEach((node, i) => {
    if (node.scrollLeft || node.scrollTop) scrolled.push([i, node.scrollLeft, node.scrollTop])
  })
  for (const node of [clone, ...cloneNodes]) node.removeAttribute("id")
  clone.removeAttribute("style")
  clone.setAttribute("aria-hidden", "true")
  clone.inert = true
  Object.assign(clone.style, { position: "absolute", inset: "0", zIndex: "0", pointerEvents: "none" })
  return {
    clone,
    restoreScroll() {
      for (const [i, left, top] of scrolled) {
        cloneNodes[i].scrollLeft = left
        cloneNodes[i].scrollTop = top
      }
    },
  }
}

export function useRoomTransition(route: Route, ref: React.RefObject<HTMLDivElement | null>) {
  const origin = React.useRef<Box | null>(null)
  const outgoing = React.useRef<ReturnType<typeof snapshot> | null>(null)
  const navigated = React.useRef(false)
  const prevLevel = React.useRef<Route["level"] | null>(null)
  const lastRoom = React.useRef<RoomId | null>(route.level === "room" ? route.room : null)

  React.useEffect(() => {
    // Runs before React re-renders, so the plant (and its zones) is still in the DOM.
    const capture = () => {
      navigated.current = true
      const next = parseRoute(window.location.search)
      origin.current = next.level === "room" ? zoneBox(next.room) : null
      const view = ref.current
      outgoing.current =
        next.level === "room" && origin.current && view && !prefersReducedMotion() ? snapshot(view) : null
    }
    window.addEventListener(ROUTE_EVENT, capture)
    window.addEventListener("popstate", capture)
    return () => {
      window.removeEventListener(ROUTE_EVENT, capture)
      window.removeEventListener("popstate", capture)
    }
  }, [ref])

  React.useLayoutEffect(() => {
    const from = prevLevel.current
    prevLevel.current = route.level
    const leftRoom = lastRoom.current
    if (route.level === "room") lastRoom.current = route.room

    // Only entering or leaving the room zooms; List ↔ Plan is a plain swap.
    const shouldAnimate = navigated.current && from !== null && (from === "room") !== (route.level === "room")
    navigated.current = false
    const plan = outgoing.current
    outgoing.current = null
    const el = ref.current
    if (!shouldAnimate || !el) return
    if (prefersReducedMotion()) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    const timing = { duration: TIMING.roomTransitionMs, easing: TIMING.roomTransitionEasing }
    let zoomed: string
    let planAnimation: Animation | null = null
    let planFade: Animation | null = null
    if (route.level === "room") {
      const box = origin.current ?? { x: vw / 3, y: vh / 3, width: vw / 3, height: vh / 3 }
      const s = Math.max(box.width / vw, box.height / vh)
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      zoomed = `translate(${cx - (vw * s) / 2}px, ${cy - (vh * s) / 2}px) scale(${s})`

      if (plan && el.parentElement) {
        // The plan keeps zooming into the zone in step with the room and is gone by the
        // crossfade point, so the room grows out of the plan instead of out of black.
        const zs = Math.min(vw / box.width, vh / box.height)
        const intoZone = `translate(${vw / 2 - cx * zs}px, ${vh / 2 - cy * zs}px) scale(${zs})`
        el.parentElement.insertBefore(plan.clone, el)
        plan.restoreScroll()
        plan.clone.style.transformOrigin = "0 0"
        plan.clone.style.opacity = "0"
        // Separate animations: the zoom shares the room's eased curve, while the fade runs
        // linearly in real time (an ease-out curve would empty the plan well before 150 ms).
        planFade = plan.clone.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: TIMING.roomCrossfadeMs,
          easing: "linear",
        })
        planAnimation = plan.clone.animate([{ transform: "none" }, { transform: intoZone }], timing)
        const remove = () => plan.clone.remove()
        planAnimation.onfinish = remove
        planAnimation.oncancel = remove
      }
    } else {
      const box = leftRoom ? zoneBox(leftRoom) : null
      if (!box) {
        zoomed = "scale(1.15)"
      } else {
        const s = Math.min(vw / box.width, vh / box.height)
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        zoomed = `translate(${vw / 2 - cx * s}px, ${vh / 2 - cy * s}px) scale(${s})`
      }
    }
    origin.current = null

    el.style.transformOrigin = "0 0"
    const animation = el.animate(
      [
        { transform: zoomed, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      timing,
    )
    return () => {
      animation.cancel()
      planFade?.cancel()
      planAnimation?.cancel()
    }
  }, [route, ref])
}
