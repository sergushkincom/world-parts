"use client"

import * as React from "react"
import type { RoomId } from "@/lib/data"
import { navigate } from "@/hooks/use-hash-route"
import { useWorldShortcuts } from "@/hooks/use-world-shortcuts"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { ObjectCard } from "@/components/world/object-card"
import { BackToPlant, RoomMinimap } from "@/components/world/room-nav"
import { Scene } from "@/components/world/scene"
import { SegmentationPanel } from "@/components/world/segmentation-panel"

type RoomRoute = { room: RoomId; object: string | null; part?: string | null; q: string }

/** Keeps `?room=…&object=…` and the open card in step, in both directions. */
function useObjectInHash(route: RoomRoute) {
  const { state, select, frame, openCard, setDraft } = useWorld()
  const routeRef = React.useRef(route)
  routeRef.current = route
  const appliedRef = React.useRef<string | null>(null)
  const lastCardRef = React.useRef<string | null | undefined>(undefined)

  React.useEffect(() => {
    if (!route.object) {
      appliedRef.current = null
      return
    }
    if (!state.hydrated || appliedRef.current === route.object) return
    const object = state.objects.find((o) => o.concept === route.object || o.id === route.object)
    if (!object) return
    appliedRef.current = route.object
    if (state.cardId === object.id) return
    select(object.id, "only")
    if (DRAWABLE.includes(object.status)) frame(object.id)
    openCard(object.id, "part")
    if (route.q) setDraft(route.q)
  }, [state.hydrated, state.objects, state.cardId, route.object, route.q, select, frame, openCard, setDraft])

  React.useEffect(() => {
    if (!state.hydrated) return
    if (lastCardRef.current === undefined) {
      lastCardRef.current = state.cardId
      return
    }
    if (lastCardRef.current === state.cardId) return
    lastCardRef.current = state.cardId
    const concept = state.objects.find((o) => o.id === state.cardId)?.concept ?? null
    appliedRef.current = concept
    const { room, q, object, part } = routeRef.current
    navigate({ level: "room", room, object: concept, part: concept === object ? part : null, q }, { replace: true })
  }, [state.hydrated, state.cardId, state.objects])
}

export function RoomView({ route }: { route: RoomRoute }) {
  useWorldShortcuts({ onEscapeRoot: () => navigate({ level: "plant", q: route.q }) })
  useObjectInHash(route)

  return (
    <div className="flex h-full flex-col panel:flex-row">
      <main className="relative min-h-0 flex-1">
        <h1 className="sr-only">world-parts — workshop, segmented scene</h1>
        <Scene topLeft={<BackToPlant q={route.q} />} />
        <RoomMinimap roomId={route.room} q={route.q} />
        <ObjectCard part={route.part ?? null} q={route.q} />
      </main>
      <SegmentationPanel />
    </div>
  )
}
