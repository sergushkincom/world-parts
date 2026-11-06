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
export function useRoomTransition(route: Route, ref: React.RefObject<HTMLDivElement | null>) {
  const origin = React.useRef<Box | null>(null)
  const navigated = React.useRef(false)
  const prevLevel = React.useRef<Route["level"] | null>(null)
  const lastRoom = React.useRef<RoomId | null>(route.level === "room" ? route.room : null)

  React.useEffect(() => {
    // Runs before React re-renders, so the plant (and its zones) is still in the DOM.
    const capture = () => {
      navigated.current = true
      const next = parseRoute(window.location.search)
      origin.current = next.level === "room" ? zoneBox(next.room) : null
    }
    window.addEventListener(ROUTE_EVENT, capture)
    window.addEventListener("popstate", capture)
    return () => {
      window.removeEventListener(ROUTE_EVENT, capture)
      window.removeEventListener("popstate", capture)
    }
  }, [])

  React.useLayoutEffect(() => {
    const from = prevLevel.current
    prevLevel.current = route.level
    const leftRoom = lastRoom.current
    if (route.level === "room") lastRoom.current = route.room

    const shouldAnimate = navigated.current && from !== null && from !== route.level
    navigated.current = false
    const el = ref.current
    if (!shouldAnimate || !el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    let zoomed: string
    if (route.level === "room") {
      const box = origin.current ?? { x: vw / 3, y: vh / 3, width: vw / 3, height: vh / 3 }
      const s = Math.max(box.width / vw, box.height / vh)
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      zoomed = `translate(${cx - (vw * s) / 2}px, ${cy - (vh * s) / 2}px) scale(${s})`
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
      { duration: TIMING.roomTransitionMs, easing: TIMING.roomTransitionEasing },
    )
    return () => animation.cancel()
  }, [route, ref])
}
