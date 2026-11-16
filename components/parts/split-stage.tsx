"use client"

import * as React from "react"
import { BoxIcon } from "lucide-react"
import { isScanned, type Part, type RoomId } from "@/lib/data"
import { equipmentFor, getRoom } from "@/lib/parts"
import { partPlace } from "@/lib/parts-list"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ShortcutLearningProvider } from "@/hooks/use-shortcut-learning"
import { FloorPlan } from "@/components/plant/floor-plan"
import { BOX } from "@/components/plant/plan-viewport"
import { Scene } from "@/components/world/scene"
import { SplatView } from "@/components/world/splat-view"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { navigate } from "@/hooks/use-hash-route"

/**
 * Flights in the split view: ease-out that is 99% there after ~600 ms (0.01^(1/600)).
 * Under reduced motion the camera jumps.
 */
const GLIDE_DAMPING = 0.9924

/** The camera's room when nothing is selected yet. */
const START_ROOM: RoomId = "workshop"

/**
 * Right half of the split view: the selected part's room in live 3D, the equipment that holds it framed and
 * tinted. A part in a room without a capture gets the floor plan with that room lit instead.
 */
/** What the camera shows when it isn't the part's own place: equipment picked in 3D. */
export type StageFocus = { room: RoomId; assetId: string }

export function SplitStage({
  part,
  focus,
  previewPart,
  onPickPart,
}: {
  part: Part | null
  /** Overrides the part's place: after a pick in 3D the camera stays on the pick, wherever the part's spare is. */
  focus: StageFocus | null
  /** Row under the pointer: tinted in 3D, the camera stays put. */
  previewPart: Part | null
  /** A marker was clicked; the list selects one of the parts that equipment holds. */
  onPickPart: (pick: { room: RoomId; assetId: string | null; name: string }) => void
}) {
  const place = focus ?? (part ? partPlace(part) : null)
  // Without a selection the camera stays in the last room it showed.
  const lastRoom = React.useRef<RoomId>(START_ROOM)
  const room = place?.room ?? lastRoom.current
  if (isScanned(room)) lastRoom.current = room

  if (!isScanned(room)) {
    return (
      <div className="relative flex h-full flex-col gap-3 bg-background p-3">
        {/* Sized like the plan view's card: the whole building fits, so the lit room is always in sight. */}
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div
            className="w-[min(100cqw,calc(100cqh*var(--plan-ratio)))] aspect-(--plan-ratio)"
            style={{ "--plan-ratio": BOX.w / BOX.h } as React.CSSProperties}
          >
            <FloorPlan
              hits={null}
              focusRoom={room}
              onRoom={(r) => r.scanned && navigate({ level: "room", room: r.id, object: null, q: "" })}
            />
          </div>
        </div>
        <p role="status" className="flex items-center gap-2 text-row text-muted-foreground">
          <BoxIcon aria-hidden className="size-4 shrink-0" />
          <span>
            <span className="font-medium text-foreground">{getRoom(room).name}</span>
            {": No 3D scan for this room yet"}
          </span>
        </p>
      </div>
    )
  }

  return (
    <ShortcutLearningProvider>
      <SplitRoom
        room={room}
        assetId={place?.assetId ?? null}
        previewAssetId={previewPart && partPlace(previewPart)?.room === room ? partPlace(previewPart)!.assetId : null}
        partNo={part?.partNo ?? null}
        onPickPart={onPickPart}
      />
    </ShortcutLearningProvider>
  )
}

function SplitRoom({
  room,
  assetId,
  previewAssetId,
  partNo,
  onPickPart,
}: {
  room: RoomId
  assetId: string | null
  previewAssetId: string | null
  /** Re-applies the target when the row changes, even to a part in the same equipment. */
  partNo: string | null
  onPickPart: (pick: { room: RoomId; assetId: string | null; name: string }) => void
}) {
  const { state, setRoom, select, frame, hover, clearSelection, closeCard } = useWorld()
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [live, setLive] = React.useState(true)
  // The object this view selected itself; any other selection came from a click in 3D.
  const applied = React.useRef<string | null>(null)

  React.useLayoutEffect(() => {
    setRoom(room)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setRoom is a new function each render; the room is the key
  }, [room])

  const objectFor = (asset: string | null) =>
    asset ? state.objects.find((o) => equipmentFor(o)?.assetId === asset) : undefined
  // The context hands out a fresh `objects` array each render; effects key on what matters in it.
  const objectsKey = state.objects.map((o) => `${o.id}:${o.status}`).join(",")

  // Table → 3D: select and frame the equipment that holds the part; home when it has none.
  React.useEffect(() => {
    if (!state.hydrated || state.roomId !== room) return
    const object = objectFor(assetId)
    applied.current = object?.id ?? null
    if (object) {
      select(object.id, "only")
      frame(DRAWABLE.includes(object.status) ? object.id : null)
    } else if (state.selection.length || state.framedId) {
      clearSelection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the target changes, not on every selection
  }, [state.hydrated, state.roomId, room, assetId, partNo, objectsKey])

  // 3D → table: a pick on a marker (or on the still frame) selects a part held there.
  const picked = state.selection.length === 1 ? state.selection[0] : null
  React.useEffect(() => {
    if (!picked || picked === applied.current || state.roomId !== room) return
    applied.current = picked
    const object = state.objects.find((o) => o.id === picked)
    if (!object) return
    onPickPart({ room, assetId: equipmentFor(object)?.assetId ?? null, name: object.name })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new pick matters
  }, [picked])

  // Row hover: tint the equipment, keep the camera.
  React.useEffect(() => {
    if (state.roomId !== room) return
    hover(objectFor(previewAssetId)?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hover only follows the previewed row
  }, [previewAssetId, state.roomId, room, objectsKey])

  // The split view has no object card; the still frame's click opens one, so close it again.
  React.useEffect(() => {
    if (state.cardId) closeCard()
  }, [state.cardId, closeCard])

  return (
    <div className="relative h-full overflow-hidden bg-scene">
      <h2 className="sr-only">{`${getRoom(room).name} in 3D`}</h2>
      {live ? (
        <SplatView
          key={room}
          focusDamping={reducedMotion ? 0 : GLIDE_DAMPING}
          onFallback={() => setLive(false)}
          onPick={(id) => {
            select(id, "only")
            const object = state.objects.find((o) => o.id === id)
            frame(object && DRAWABLE.includes(object.status) ? id : null)
          }}
        />
      ) : (
        <Scene />
      )}
      <p className="pointer-events-none absolute top-3 left-3 z-20 rounded-full bg-black/75 px-2.5 py-1 text-label font-medium text-scene-ink backdrop-blur-sm">
        {getRoom(room).name}
      </p>
    </div>
  )
}
