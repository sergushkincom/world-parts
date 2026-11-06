"use client"

import * as React from "react"
import { ROOMS, type RoomId } from "@/lib/data"

export type Route =
  | { level: "plant"; q: string }
  | { level: "room"; room: RoomId; object: string | null; q: string }

export const ROUTE_EVENT = "world-parts:routechange"

export function parseRoute(search: string): Route {
  const params = new URLSearchParams(search)
  const q = params.get("q") ?? ""
  const room = ROOMS.find((r) => r.id === params.get("room") && r.scanned)
  if (room) return { level: "room", room: room.id, object: params.get("object"), q }
  return { level: "plant", q }
}

export function formatRoute(route: Route): string {
  const params = new URLSearchParams()
  if (route.level === "room") {
    params.set("room", route.room)
    if (route.object) params.set("object", route.object)
  }
  if (route.q.trim()) params.set("q", route.q.trim())
  const body = params.toString()
  return body ? `?${body}` : ""
}

// Links from the earlier hash-based routing (`#room=workshop&q=pump`) would leave an
// invalid-selector hash in the URL; move those params into the query string once on load.
function migrateLegacyHash() {
  const hash = window.location.hash.slice(1)
  if (!hash.includes("=") && hash !== "plant") return
  const legacy = new URLSearchParams(hash.replace(/^plant&?/, ""))
  const route = parseRoute(legacy.toString())
  window.history.replaceState(null, "", `${window.location.pathname}${formatRoute(route)}`)
}

if (typeof window !== "undefined") migrateLegacyHash()

function subscribe(onChange: () => void) {
  const onHashChange = () => {
    migrateLegacyHash()
    onChange()
  }
  window.addEventListener("popstate", onChange)
  window.addEventListener("hashchange", onHashChange)
  window.addEventListener(ROUTE_EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener("hashchange", onHashChange)
    window.removeEventListener(ROUTE_EVENT, onChange)
  }
}

/**
 * The route lives in the query string, not the hash: the hash would have to be a valid CSS
 * selector, since anchor-scroll handlers pass it to `querySelector`. Every view stays linkable
 * and the back button walks back through levels. `replace` skips adding a history entry
 * (used while typing a search).
 */
export function navigate(route: Route, { replace = false } = {}) {
  const search = formatRoute(route)
  if (window.location.search === search) return
  const url = `${window.location.pathname}${search}`
  if (replace) window.history.replaceState(null, "", url)
  else window.history.pushState(null, "", url)
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

export function useHashRoute(): Route {
  const search = React.useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  )
  return React.useMemo(() => parseRoute(search), [search])
}
