"use client"

import * as React from "react"
import { useHashRoute } from "@/hooks/use-hash-route"
import { useRoomTransition } from "@/hooks/use-room-transition"
import { PlantView } from "@/components/plant/plant-view"
import { RoomView } from "@/components/world/room-view"

export function AppShell() {
  const route = useHashRoute()
  const viewRef = React.useRef<HTMLDivElement>(null)
  useRoomTransition(route, viewRef)

  return (
    <div className="h-dvh overflow-hidden">
      <div ref={viewRef} className="h-dvh will-change-transform">
        {route.level === "plant" ? <PlantView q={route.q} /> : <RoomView route={route} />}
      </div>
    </div>
  )
}
