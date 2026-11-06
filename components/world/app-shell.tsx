"use client"

import * as React from "react"
import { useHashRoute } from "@/hooks/use-hash-route"
import { useRoomTransition } from "@/hooks/use-room-transition"
import { PartsView } from "@/components/parts/parts-view"
import { PlantView } from "@/components/plant/plant-view"
import { RoomView } from "@/components/world/room-view"

export function AppShell() {
  const route = useHashRoute()
  const viewRef = React.useRef<HTMLDivElement>(null)
  useRoomTransition(route, viewRef)

  return (
    <div className="relative isolate h-dvh overflow-hidden">
      <div ref={viewRef} className="relative z-10 h-dvh will-change-transform">
        {route.level === "parts" ? (
          <PartsView q={route.q} part={route.part ?? null} />
        ) : route.level === "plant" ? (
          // Keyed by pin so following another location link re-opens that room's note.
          <PlantView key={route.pin ?? ""} q={route.q} pin={route.pin ?? null} />
        ) : (
          <RoomView route={route} />
        )}
      </div>
    </div>
  )
}
