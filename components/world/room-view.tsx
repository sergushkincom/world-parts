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
import { SplatView } from "@/components/world/splat-view"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type ViewMode = "still" | "live"

/** Still frame by default: the live world is 24 MB, so it loads only when asked for. */
function ViewModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={mode}
      onValueChange={(v) => v && onChange(v as ViewMode)}
      aria-label="Room view"
      className="pointer-events-auto absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-black/70 p-0.5 text-scene-ink shadow-sm backdrop-blur-sm"
    >
      <ToggleGroupItem value="still" className="h-7 px-3 text-xs data-[state=on]:bg-white/15 data-[state=on]:text-scene-ink">
        Still
      </ToggleGroupItem>
      <ToggleGroupItem value="live" className="h-7 px-3 text-xs data-[state=on]:bg-white/15 data-[state=on]:text-scene-ink">
        Live 3D
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

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
  const [mode, setMode] = React.useState<ViewMode>("still")

  return (
    <div className="flex h-dvh flex-col panel:flex-row">
      <main className="relative min-h-0 flex-1">
        <h1 className="sr-only">world-parts — workshop, segmented scene</h1>
        {mode === "live" ? (
          <SplatView topLeft={<BackToPlant q={route.q} />} onFallback={() => setMode("still")} />
        ) : (
          <Scene topLeft={<BackToPlant q={route.q} />} />
        )}
        <ViewModeSwitch mode={mode} onChange={setMode} />
        <RoomMinimap roomId={route.room} q={route.q} />
        <ObjectCard part={route.part ?? null} q={route.q} />
      </main>
      <SegmentationPanel />
    </div>
  )
}
