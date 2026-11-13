"use client"

import * as React from "react"
import { DOORS, ROOMS, STORAGE_KEYS, VIEWPOINTS, isScanned, worldOf, type RoomId, type WorldObject } from "@/lib/data"
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

/** The object's name in the URL: its concept when that is unique in the room ("pump"), else its id ("obj-cnc-03"). */
export function objectKey(o: WorldObject, roomObjects: WorldObject[]) {
  return roomObjects.filter((x) => x.concept === o.concept).length > 1 ? o.id : o.concept
}

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
    if (state.roomId !== route.room) return
    const object = state.objects.find((o) => o.id === route.object || o.concept === route.object)
    if (!object) return
    appliedRef.current = route.object
    if (state.cardId === object.id) return
    select(object.id, "only")
    if (DRAWABLE.includes(object.status)) frame(object.id)
    openCard(object.id, "part")
    if (route.q) setDraft(route.q)
  }, [state.hydrated, state.roomId, state.objects, state.cardId, route.room, route.object, route.q, select, frame, openCard, setDraft])

  React.useEffect(() => {
    if (!state.hydrated) return
    if (lastCardRef.current === undefined) {
      lastCardRef.current = state.cardId
      return
    }
    if (lastCardRef.current === state.cardId) return
    lastCardRef.current = state.cardId
    const open = state.objects.find((o) => o.id === state.cardId)
    const key = open ? objectKey(open, state.objects) : null
    appliedRef.current = key
    const { room, q, object, part } = routeRef.current
    navigate({ level: "room", room, object: key, part: key === object ? part : null, q }, { replace: true })
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

/** The way out of a room, and in the corridor the doors: buttons, since a room's own door is behind its camera. */
function DoorButtons({ room, live }: { room: RoomId; live: boolean }) {
  const doors = (DOORS[room] ?? []).filter((d) => live || !d.polygon)
  if (!doors.length) return null
  return (
    <nav
      aria-label="Doors"
      className="absolute right-3 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.75rem))] z-20 flex max-w-[60%] flex-wrap justify-end gap-1.5"
    >
      {doors.map((d) => {
        const open = isScanned(d.to)
        return (
          <button
            key={d.to}
            type="button"
            disabled={!open}
            title={open ? undefined : "Not scanned yet"}
            onClick={() => navigate({ level: "room", room: d.to, object: null, q: "" })}
            className="rounded-full bg-black/75 px-3 py-1.5 text-label font-medium text-scene-ink shadow-lg backdrop-blur-sm hover:bg-black/90 disabled:opacity-50"
          >
            {open ? `→ ${d.label}` : `${d.label} · not scanned`}
          </button>
        )
      })}
    </nav>
  )
}

export function RoomView({ route }: { route: RoomRoute }) {
  const { setRoom } = useWorld()
  // Before anything reads `state.objects`: they are this room's objects only.
  React.useLayoutEffect(() => {
    setRoom(route.room)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setRoom is a new function each render; the room is the key
  }, [route.room])
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

  // A new room starts a new walk.
  React.useEffect(() => {
    setViewpoint(null)
    setVisited([])
  }, [route.room])

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
  const target = framed ? worldOf(route.room).poses[framed.id]?.target : undefined
  const roomName = ROOMS.find((r) => r.id === route.room)?.name ?? "room"
  const find = framed && target && map ? { name: framed.name, at: map.inRoom(target[0], target[2]) } : null

  return (
    <div className="flex h-full flex-col panel:flex-row">
      <main className="relative min-h-0 flex-1">
        <h1 className="sr-only">{`world-parts — ${roomName.toLowerCase()}, segmented scene`}</h1>
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
            key={route.room}
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
        <DoorButtons room={route.room} live={mode === "live"} />
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
