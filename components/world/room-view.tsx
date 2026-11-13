"use client"

import * as React from "react"
import { LIVE_WORLD, STORAGE_KEYS, VIEWPOINTS, type RoomId } from "@/lib/data"
import { planMapper } from "@/lib/minimap"
import { readJSON, writeJSON } from "@/lib/storage"
import { isSplatQuality, pixelRatioFor, type SplatQuality } from "@/lib/splat-quality"
import { navigate } from "@/hooks/use-hash-route"
import { useWorldShortcuts } from "@/hooks/use-world-shortcuts"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { ObjectCard } from "@/components/world/object-card"
import { RoomChrome } from "@/components/world/room-chrome"
import type { MinimapHandle } from "@/components/world/room-minimap"
import { Scene } from "@/components/world/scene"
import { SegmentationPanel } from "@/components/world/segmentation-panel"
import { SplatView, type SplatViewHandle } from "@/components/world/splat-view"

type ViewMode = "still" | "live"

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

function useStoredFlag(key: string) {
  const [seen, setSeen] = React.useState(true)
  React.useEffect(() => {
    setSeen(readJSON(key, (value): value is boolean => value === true).value === true)
  }, [key])
  const mark = React.useCallback(() => {
    setSeen(true)
    writeJSON(key, true)
  }, [key])
  return [seen, mark] as const
}

function useSplatQuality() {
  const [quality, setQuality] = React.useState<SplatQuality>("auto")
  React.useEffect(() => {
    const stored = readJSON(STORAGE_KEYS.splatQuality, isSplatQuality)
    if (stored.value) setQuality(stored.value)
  }, [])
  const update = React.useCallback((next: SplatQuality) => {
    setQuality(next)
    writeJSON(STORAGE_KEYS.splatQuality, next)
  }, [])
  return [quality, update] as const
}

export function RoomView({ route }: { route: RoomRoute }) {
  useWorldShortcuts({ onEscapeRoot: () => navigate({ level: "plant", q: route.q }) })
  useObjectInHash(route)
  const [mode, setMode] = React.useState<ViewMode>("still")
  const { state, frame } = useWorld()
  const splatRef = React.useRef<SplatViewHandle>(null)
  const minimapRef = React.useRef<MinimapHandle>(null)
  const [liveReady, setLiveReady] = React.useState(false)
  const [viewpoint, setViewpoint] = React.useState<number | null>(null)
  const [visited, setVisited] = React.useState<number[]>([])
  const [orbitHintSeen, dismissOrbitHint] = useStoredFlag(STORAGE_KEYS.orbitHintSeen)
  const [quality, setQuality] = useSplatQuality()
  const [toast, setToast] = React.useState<string | null>(null)
  const toastTimer = React.useRef(0)

  const notify = React.useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  React.useEffect(() => {
    if (mode !== "still") return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest?.("input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog']")) return
      if (document.querySelector("[role='menu'], [role='alertdialog'], [role='dialog']")) return
      if (e.key !== "r" && e.key !== "R") return
      e.preventDefault()
      frame(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mode, frame])

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
        <RoomChrome
          roomId={route.room}
          q={route.q}
          mode={mode}
          onMode={setMode}
          onReset={() => (mode === "live" ? splatRef.current?.reset() : frame(null))}
          quality={quality}
          onQuality={setQuality}
          showOrbitHint={mode === "live" && liveReady && !orbitHintSeen}
          minimapRef={minimapRef}
          live={mode === "live" && liveReady}
          viewpoint={viewpoint}
          visited={visited}
          onViewpoint={walkTo}
          find={find}
          onNotify={notify}
        />
        {mode === "live" ? (
          <SplatView
            ref={splatRef}
            pixelRatio={pixelRatioFor(quality)}
            onFallback={() => setMode("still")}
            onCamera={(view) => minimapRef.current?.setCamera(view)}
            onReadyChange={setLiveReady}
            onFirstDrag={dismissOrbitHint}
          />
        ) : (
          <Scene />
        )}
        <ObjectCard part={route.part ?? null} q={route.q} room={route.room} onNotify={notify} />
        {toast && (
          <p
            role="status"
            className="pointer-events-none absolute bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-3 py-1.5 text-sm text-scene-ink shadow-lg"
          >
            {toast}
          </p>
        )}
      </main>
      <SegmentationPanel />
    </div>
  )
}
