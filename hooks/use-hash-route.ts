"use client"

import * as React from "react"
import { ROOMS, type RoomId } from "@/lib/data"

export type Route =
  | { level: "plant"; q: string }
  | { level: "room"; room: RoomId; object: string | null; q: string }

const HASH_EVENT = "world-parts:hashchange"

export function parseHash(hash: string): Route {
  const params = new URLSearchParams(hash.replace(/^#/, ""))
  const q = params.get("q") ?? ""
  const room = ROOMS.find((r) => r.id === params.get("room") && r.scanned)
  if (room) return { level: "room", room: room.id, object: params.get("object"), q }
  return { level: "plant", q }
}

export function formatHash(route: Route): string {
  const params = new URLSearchParams()
  if (route.level === "room") {
    params.set("room", route.room)
    if (route.object) params.set("object", route.object)
  }
  if (route.q.trim()) params.set("q", route.q.trim())
  const body = params.toString()
  // URLSearchParams has no bare-key form, so "plant" is written by hand.
  if (route.level === "plant") return body ? `#plant&${body}` : "#plant"
  return `#${body}`
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  window.addEventListener(HASH_EVENT, onChange)
  return () => {
    window.removeEventListener("hashchange", onChange)
    window.removeEventListener(HASH_EVENT, onChange)
  }
}

/**
 * Navigation lives in the URL hash so every view is linkable and the browser back button
 * walks back through levels. `replace` updates the URL without adding a history entry
 * (used while typing a search).
 */
export function navigate(route: Route, { replace = false } = {}) {
  const hash = formatHash(route)
  if (window.location.hash === hash) return
  if (replace) {
    window.history.replaceState(window.history.state, "", hash)
    window.dispatchEvent(new Event(HASH_EVENT))
  } else {
    window.location.hash = hash
  }
}

export function useHashRoute(): Route {
  const hash = React.useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  )
  return React.useMemo(() => parseHash(hash), [hash])
}
