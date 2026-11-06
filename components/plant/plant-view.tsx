"use client"

import * as React from "react"
import { PLAN, WORLD_ROOM, type Room, type RoomId } from "@/lib/data"
import { getRoom, inventoryHits, isSearchable, searchPlant, type SearchOption } from "@/lib/search"
import { navigate } from "@/hooks/use-hash-route"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { FloorPlan } from "@/components/plant/floor-plan"
import { PlantSearch } from "@/components/plant/plant-search"
import { RoomNote } from "@/components/plant/room-note"
import { ViewSwitch } from "@/components/parts/view-switch"

const SKIP_SLASH_INSIDE = "input, textarea, select, [contenteditable='true']"

export function PlantView({ q, pin = null }: { q: string; pin?: RoomId | null }) {
  // A pinned room arrives from a list location link: open its note straight away.
  const [noteRoom, setNoteRoom] = React.useState<RoomId | null>(pin)
  const noteRef = React.useRef(noteRoom)
  noteRef.current = noteRoom
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { state } = useWorld()
  const worldObjects = React.useMemo(() => state.objects.filter((o) => DRAWABLE.includes(o.status)), [state.objects])
  const { groups, options } = React.useMemo(() => searchPlant(q, worldObjects), [q, worldObjects])
  const hitRooms = React.useMemo(
    () => (isSearchable(q) ? new Set(groups.map((g) => g.room.id)) : null),
    [q, groups],
  )

  const noteHits = React.useMemo(
    () => inventoryHits(groups.find((g) => g.room.id === noteRoom)),
    [groups, noteRoom],
  )

  const setQuery = (next: string) => navigate({ level: "plant", q: next }, { replace: true })

  const openOption = ({ hit, room }: SearchOption) => {
    if (hit.kind === "inventory") {
      setNoteRoom(room.id)
      return
    }
    const part = hit.kind === "equipment" ? null : hit.part.partNo
    navigate({ level: "room", room: WORLD_ROOM, object: hit.object.concept, part, q })
  }

  const openRoom = (room: Room) => {
    if (room.scanned) {
      const match = room.id === WORLD_ROOM ? options.find((o) => o.hit.kind !== "inventory") : undefined
      if (match) openOption(match)
      else navigate({ level: "room", room: room.id, object: null, q: "" })
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
        // One level at a time: close the note, then back to the list.
        if (noteRef.current) setNoteRoom(null)
        else navigate({ level: "parts", q: new URLSearchParams(window.location.search).get("q") ?? "" })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="flex h-dvh flex-col">
      <header className="relative z-20 flex items-start gap-2 px-4 pt-5 pb-2">
        <h1 className="sr-only">world-parts — plant overview</h1>
        <div className="flex min-w-0 flex-1 justify-center">
          <PlantSearch
            q={q}
            onQuery={setQuery}
            groups={groups}
            options={options}
            onOpen={openOption}
            inputRef={inputRef}
          />
        </div>
        <ViewSwitch view="plant" q={q} />
      </header>

      <main className="relative min-h-0 flex-1">
        <div className="mx-auto size-full" style={{ maxWidth: PLAN.maxWidth }}>
          <FloorPlan hits={hitRooms} focusRoom={noteRoom} onRoom={openRoom} />
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
