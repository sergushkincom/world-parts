"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { ROOMS, type RoomId } from "@/lib/data"
import { cn } from "@/lib/utils"
import { useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { RoomMinimap, type MinimapHandle } from "@/components/world/room-minimap"
import { RoomBreadcrumb } from "@/components/world/room-nav"
import { RoomSearch } from "@/components/world/room-search"
import { HintSlot, ShortcutHint } from "@/components/world/shortcut-hint"
import { ShortcutsPanel } from "@/components/world/shortcuts-panel"
import { ViewPill } from "@/components/world/view-pill"
import type { SplatQuality } from "@/lib/splat-quality"
import type { Point } from "@/lib/data"

type ViewMode = "still" | "live"

export function RoomChrome({
  roomId,
  q,
  mode,
  onMode,
  onReset,
  quality,
  onQuality,
  showOrbitHint,
  minimapRef,
  live,
  viewpoint,
  visited,
  onViewpoint,
  find,
  onNotify,
  hintBlocked,
  onResetOrbit,
}: {
  roomId: RoomId
  q: string
  mode: ViewMode
  onMode: (mode: ViewMode) => void
  onReset: () => void
  quality: SplatQuality
  onQuality: (quality: SplatQuality) => void
  showOrbitHint: boolean
  minimapRef: React.RefObject<MinimapHandle | null>
  live: boolean
  viewpoint: number | null
  visited: number[]
  onViewpoint: (index: number) => void
  find: { name: string; at: Point } | null
  onNotify: (message: string) => void
  /** Link-copied toast is using the chip slot. */
  hintBlocked: boolean
  onResetOrbit: () => void
}) {
  const roomName = ROOMS.find((r) => r.id === roomId)?.name ?? "Room"
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  const { touch, tipsOff, hint, setGate } = useShortcutLearning()
  const orbitVisible = showOrbitHint && !touch && !tipsOff

  React.useEffect(() => {
    setGate({ paused: orbitVisible || shortcutsOpen || hintBlocked, coachGestures: live })
  }, [orbitVisible, shortcutsOpen, hintBlocked, live, setGate])

  return (
    <>
      <div
        data-room-toolbar
        className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <div className="panel:grid panel:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] panel:items-start panel:gap-3">
          <div
            className={cn(
              "pointer-events-auto flex items-center gap-1 rounded-full bg-black/75 p-1 text-scene-ink shadow-lg backdrop-blur-sm",
              "panel:contents panel:bg-transparent panel:p-0 panel:shadow-none",
            )}
          >
            <RoomBreadcrumb q={q} roomName={roomName} />
            {!searchOpen && (
              <span className="min-w-0 flex-1 truncate px-1 text-sm font-medium panel:hidden">{roomName}</span>
            )}
            <RoomSearch
              collapsible={searchOpen}
              onActivate={() => setSearchOpen(true)}
              onCollapse={() => setSearchOpen(false)}
              className={cn(
                "panel:w-[min(28rem,36vw)] panel:justify-self-center",
                searchOpen
                  ? "max-panel:min-w-0 max-panel:flex-1 max-panel:overflow-visible"
                  : "max-panel:pointer-events-none! max-panel:absolute! max-panel:m-[-1px]! max-panel:size-px! max-panel:overflow-hidden! max-panel:p-0!",
              )}
            />
            <span aria-hidden className="pointer-events-none hidden panel:block" />
            {!searchOpen && (
              <button
                type="button"
                aria-label="Find a part"
                onClick={() => {
                  setSearchOpen(true)
                  requestAnimationFrame(() => document.getElementById("room-find")?.focus())
                }}
                className="grid size-11 shrink-0 place-items-center rounded-full text-scene-ink hover:bg-white/10 panel:hidden"
              >
                <SearchIcon aria-hidden className="size-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full-size layer so the card can be dragged in the room view. It starts under the breadcrumb. */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <RoomMinimap
          ref={minimapRef}
          roomId={roomId}
          live={live}
          viewpoint={viewpoint}
          visited={visited}
          onViewpoint={onViewpoint}
          find={find}
        />
      </div>

      <HintSlot active={orbitVisible || hint != null}>
        {orbitVisible && (
          <p className="max-w-[calc(100vw-6rem)] rounded-full bg-black/75 px-3 py-1.5 text-center text-label text-scene-ink shadow-lg backdrop-blur-sm">
            Drag to orbit · scroll to zoom · ? all shortcuts
          </p>
        )}
        <ShortcutHint />
      </HintSlot>

      <ViewPill
        mode={mode}
        onMode={onMode}
        onReset={onReset}
        quality={quality}
        onQuality={onQuality}
        onNotify={onNotify}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsPanel open={shortcutsOpen} onOpenChange={setShortcutsOpen} onResetOrbit={onResetOrbit} />
    </>
  )
}
