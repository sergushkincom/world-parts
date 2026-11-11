"use client"

import * as React from "react"
import { LIVE_WORLD, VIEWPOINTS, type RoomId } from "@/lib/data"
import { planMapper } from "@/lib/minimap"
import { navigate } from "@/hooks/use-hash-route"
import { useWorldShortcuts } from "@/hooks/use-world-shortcuts"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { ObjectCard } from "@/components/world/object-card"
import { BackToPlant } from "@/components/world/room-nav"
import { RoomMinimap, type MinimapHandle } from "@/components/world/room-minimap"
import { Scene } from "@/components/world/scene"
import { SegmentationPanel } from "@/components/world/segmentation-panel"
import { SplatView, type SplatViewHandle } from "@/components/world/splat-view"
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
  const { state } = useWorld()
  const splatRef = React.useRef<SplatViewHandle>(null)
  const minimapRef = React.useRef<MinimapHandle>(null)
  const [liveReady, setLiveReady] = React.useState(false)
  const [viewpoint, setViewpoint] = React.useState<number | null>(null)
  const [visited, setVisited] = React.useState<number[]>([])

  // Find takes over the camera; the walk starts again from wherever Find left it.
  React.useEffect(() => setViewpoint(null), [state.framedId, mode])

  const walkTo = (i: number) => {
    const vp = VIEWPOINTS[route.room]?.[i]
    if (!vp) return
    splatRef.current?.flyTo(vp.pose)
    setViewpoint(i)
    setVisited((v) => (v.includes(i) ? v : [...v, i]))
  }

  const map = planMapper(route.room)
  const framed = state.objects.find((o) => o.id === state.framedId)
  const target = framed ? LIVE_WORLD.poses[framed.id]?.target : undefined
  const find = framed && target && map ? { name: framed.name, at: map.inRoom(target[0], target[2]) } : null

  return (
    <div className="flex h-full flex-col panel:flex-row">
      <main className="relative min-h-0 flex-1">
        <h1 className="sr-only">world-parts — workshop, segmented scene</h1>
        {mode === "live" ? (
          <SplatView
            ref={splatRef}
            topLeft={<BackToPlant q={route.q} />}
            onFallback={() => setMode("still")}
            onCamera={(view) => minimapRef.current?.setCamera(view)}
            onReadyChange={setLiveReady}
          />
        ) : (
          <Scene topLeft={<BackToPlant q={route.q} />} />
        )}
        <ViewModeSwitch mode={mode} onChange={setMode} />
        <RoomMinimap
          ref={minimapRef}
          roomId={route.room}
          q={route.q}
          live={mode === "live" && liveReady}
          viewpoint={viewpoint}
          visited={visited}
          onViewpoint={walkTo}
          find={find}
        />
        <ObjectCard part={route.part ?? null} q={route.q} />
      </main>
      <SegmentationPanel />
    </div>
  )
}
