"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { ROOMS, type RoomId } from "@/lib/data"
import { cn } from "@/lib/utils"
import { RoomMinimap, type MinimapHandle } from "@/components/world/room-minimap"
import { RoomBreadcrumb } from "@/components/world/room-nav"
import { RoomSearch } from "@/components/world/room-search"
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
}) {
  const roomName = ROOMS.find((r) => r.id === roomId)?.name ?? "Room"
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
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

      {/* Full-size layer: the desktop card is dragged anywhere in the room view, the phone button sits under the breadcrumb. */}
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

      {showOrbitHint && (
        <p className="pointer-events-none absolute bottom-[max(4.25rem,calc(env(safe-area-inset-bottom)+3.5rem))] left-1/2 z-30 max-w-[calc(100%-6rem)] -translate-x-1/2 rounded-full bg-black/75 px-3 py-1.5 text-center text-label text-scene-ink shadow-lg backdrop-blur-sm">
          Drag to orbit · scroll to zoom · ? all shortcuts
        </p>
      )}

      <ViewPill
        mode={mode}
        onMode={onMode}
        onReset={onReset}
        quality={quality}
        onQuality={onQuality}
        onNotify={onNotify}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsPanel open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
