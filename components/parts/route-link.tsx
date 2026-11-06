"use client"

import * as React from "react"
import type { Equipment, Part, StoredLocation } from "@/lib/data"
import { getEquipment, isBin, isInWorld, locationRoom } from "@/lib/parts"
import { formatRoute, navigate, type Route } from "@/hooks/use-hash-route"

/**
 * In world → the room, with the bin's equipment (the cabinet) framed.
 * Inventory only → the plan with that room pinned and the "not scanned" note.
 */
export function locationRoute(part: Part, location: StoredLocation): Route {
  const room = locationRoom(location)
  if (isInWorld(location)) {
    const object = isBin(location) ? (getEquipment(location.assetId)?.concept ?? null) : null
    return { level: "room", room, object, part: part.partNo, q: "" }
  }
  return { level: "plant", q: part.partNo, pin: room }
}

export function equipmentRoute(eq: Equipment, part?: Part | null): Route {
  return { level: "room", room: eq.room, object: eq.concept, part: part?.partNo ?? null, q: "" }
}

/** A real link (open in new tab works) that navigates in-app on a plain click. */
export function RouteLink({
  to,
  onClick,
  ...props
}: { to: Route } & Omit<React.ComponentProps<"a">, "href">) {
  return (
    <a
      {...props}
      href={formatRoute(to) || "/"}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(to)
      }}
    />
  )
}
