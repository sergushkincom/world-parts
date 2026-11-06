"use client"

import { useHashRoute } from "@/hooks/use-hash-route"
import { PlantView } from "@/components/plant/plant-view"
import { RoomView } from "@/components/world/room-view"

export function AppShell() {
  const route = useHashRoute()
  if (route.level === "plant") return <PlantView q={route.q} />
  return <RoomView route={route} />
}
