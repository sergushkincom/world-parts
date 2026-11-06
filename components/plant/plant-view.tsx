"use client"

import * as React from "react"
import { PLAN, WORLD_ROOM, type Room, type RoomId } from "@/lib/data"
import { getRoom, isSearchable, searchPlant, type InventoryHit, type SearchOption } from "@/lib/search"
import { navigate } from "@/hooks/use-hash-route"
import { useWorldHits } from "@/hooks/use-world-hits"
import { FloorPlan } from "@/components/plant/floor-plan"
import { PlantSearch } from "@/components/plant/plant-search"
import { RoomNote } from "@/components/plant/room-note"

const SKIP_SLASH_INSIDE = "input, textarea, select, [contenteditable='true']"

export function PlantView({ q }: { q: string }) {
  const [noteRoom, setNoteRoom] = React.useState<RoomId | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const worldHits = useWorldHits(q)
  const { groups, options } = React.useMemo(() => searchPlant(q, worldHits), [q, worldHits])
  const hitRooms = React.useMemo(
    () => (isSearchable(q) ? new Set(groups.map((g) => g.room.id)) : null),
    [q, groups],
  )

  const noteHits: InventoryHit[] = React.useMemo(() => {
    const group = groups.find((g) => g.room.id === noteRoom)
    return group?.kind === "inventory" ? group.hits : []
  }, [groups, noteRoom])

  const setQuery = (next: string) => navigate({ level: "plant", q: next }, { replace: true })

  const openOption = (option: SearchOption) => {
    if (option.kind === "world") {
      navigate({ level: "room", room: WORLD_ROOM, object: option.hit.object.concept, q })
    } else {
      setNoteRoom(option.room.id)
    }
  }

  const openRoom = (room: Room) => {
    if (room.scanned) {
      const match = room.id === WORLD_ROOM ? options.find((o) => o.kind === "world") : undefined
      const object = match?.kind === "world" ? match.hit.object.concept : null
      navigate({ level: "room", room: room.id, object, q: object ? q : "" })
    }
    else setNoteRoom((current) => (current === room.id ? null : room.id))
  }

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const inField = (e.target as HTMLElement).closest?.(SKIP_SLASH_INSIDE)
      if (e.key === "/" && !inField) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === "Escape" && !inField) {
        setNoteRoom(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="flex h-dvh flex-col">
      <header className="relative z-20 flex flex-col items-center gap-1 px-4 pt-5 pb-2">
        <h1 className="sr-only">world-parts — plant overview</h1>
        <PlantSearch
          q={q}
          onQuery={setQuery}
          groups={groups}
          options={options}
          onOpen={openOption}
          inputRef={inputRef}
        />
      </header>

      <main className="relative min-h-0 flex-1">
        <div className="size-full overflow-auto overscroll-contain">
          <div
            className="mx-auto flex min-h-full items-center p-4"
            style={{ width: `max(100%, ${PLAN.minWidth}px)`, maxWidth: PLAN.maxWidth + 32 }}
          >
            <FloorPlan hits={hitRooms} focusRoom={noteRoom} onRoom={openRoom} />
          </div>
        </div>

        {noteRoom && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
            <div className="pointer-events-auto">
              <RoomNote room={getRoom(noteRoom)} hits={noteHits} onClose={() => setNoteRoom(null)} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
