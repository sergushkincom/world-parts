import {
  PARTS,
  ROOMS,
  SEARCH_MIN_CHARS,
  WORLD_ROOM,
  type Equipment,
  type Part,
  type Room,
  type RoomId,
  type StoredLocation,
  type WorldObject,
} from "@/lib/data"
import { equipmentFor, getRoom, isBin, locationRoom } from "@/lib/parts"

export { getRoom }

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

export function normalizeQuery(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

export function isSearchable(q: string) {
  return normalizeQuery(q).length >= SEARCH_MIN_CHARS
}

/** Part numbers match with or without dashes and spaces ("6205 2rs" finds BRG-6205-2RS). */
export function partMatches(part: Part, q: string) {
  const needle = normalizeQuery(q)
  const compact = squash(needle)
  if (compact && squash(part.partNo).includes(compact)) return true
  return [part.name, part.description].some((t) => t.toLowerCase().includes(needle))
}

export function equipmentMatches(equipment: Equipment | undefined, object: WorldObject, q: string) {
  const needle = normalizeQuery(q)
  const compact = squash(needle)
  return (
    object.name.toLowerCase().includes(needle) ||
    object.concept.includes(needle) ||
    (!!equipment &&
      ((!!compact && squash(equipment.assetId).includes(compact)) || equipment.name.toLowerCase().includes(needle)))
  )
}

export type WorldHit = { object: WorldObject; equipment: Equipment | undefined }
export type InventoryHit = { part: Part; location: StoredLocation }

/** What a plan result points at: the equipment itself, a spare in a bin, a part fitted in a unit, or a shelf with no scene. */
export type PlanHit =
  | { kind: "equipment"; object: WorldObject; equipment: Equipment | undefined }
  | { kind: "stored"; part: Part; location: StoredLocation; object: WorldObject; equipment: Equipment }
  | { kind: "installed"; part: Part; object: WorldObject; equipment: Equipment }
  | { kind: "inventory"; part: Part; location: StoredLocation }

export type RoomResults = { room: Room; inWorld: boolean; hits: PlanHit[] }

/** One flat, ordered option list so the combobox can step through every result with ↑/↓. */
export type SearchOption = { id: string; room: Room; hit: PlanHit }

const KIND_ORDER: Record<PlanHit["kind"], number> = { equipment: 0, stored: 1, installed: 2, inventory: 3 }

function hitKey(hit: PlanHit, i: number) {
  return hit.kind === "equipment" ? hit.object.id : `${hit.kind}-${hit.part.partNo}-${i}`
}

/** Equipment matches by name or asset ID, or through a part fitted in it or stored in its bins. */
export function searchWorld(q: string, objects: WorldObject[], isInWorld: (o: WorldObject) => boolean): WorldHit[] {
  if (!isSearchable(q)) return []
  const matchingParts = PARTS.filter((p) => partMatches(p, q))
  return objects
    .filter(isInWorld)
    .map((object) => ({ object, equipment: equipmentFor(object) }))
    .filter(({ object, equipment }) => {
      if (equipmentMatches(equipment, object, q)) return true
      if (!equipment) return false
      return matchingParts.some(
        (p) =>
          p.installedIn.includes(equipment.assetId) ||
          p.storedIn.some((l) => isBin(l) && l.assetId === equipment.assetId),
      )
    })
}

/**
 * Plan results grouped by room. `worldObjects` are the objects drawn in the scene: a hit is only
 * "in world" when the equipment it points at is actually there to frame.
 */
export function searchPlant(q: string, worldObjects: WorldObject[]): { groups: RoomResults[]; options: SearchOption[] } {
  if (!isSearchable(q)) return { groups: [], options: [] }

  const placed = worldObjects.map((object) => ({ object, equipment: equipmentFor(object) }))
  const byAsset = new Map(
    placed.flatMap(({ object, equipment }) => (equipment ? [[equipment.assetId, { object, equipment }] as const] : [])),
  )
  const hitsByRoom = new Map<RoomId, PlanHit[]>()
  const add = (room: RoomId, hit: PlanHit) => hitsByRoom.set(room, [...(hitsByRoom.get(room) ?? []), hit])

  for (const { object, equipment } of placed) {
    if (equipmentMatches(equipment, object, q)) add(WORLD_ROOM, { kind: "equipment", object, equipment })
  }

  for (const part of PARTS.filter((p) => partMatches(p, q))) {
    for (const location of part.storedIn) {
      const unit = isBin(location) ? byAsset.get(location.assetId) : undefined
      if (unit) add(WORLD_ROOM, { kind: "stored", part, location, ...unit })
      else add(locationRoom(location), { kind: "inventory", part, location })
    }
    for (const assetId of part.installedIn) {
      const unit = byAsset.get(assetId)
      if (unit) add(WORLD_ROOM, { kind: "installed", part, ...unit })
    }
  }

  const groups: RoomResults[] = ROOMS.flatMap((room) => {
    const hits = hitsByRoom.get(room.id)
    if (!hits?.length) return []
    return [{ room, inWorld: room.id === WORLD_ROOM, hits: hits.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) }]
  }).sort((a, b) => Number(b.inWorld) - Number(a.inWorld))

  const options = groups.flatMap((g) =>
    g.hits.map((hit, i) => ({ id: `opt-${g.room.id}-${hitKey(hit, i)}`, room: g.room, hit })),
  )
  return { groups, options }
}

/** Shelf hits for a room with no scene, as the room note lists them. */
export function inventoryHits(group: RoomResults | undefined): InventoryHit[] {
  return (group?.hits ?? []).flatMap((h) => (h.kind === "inventory" ? [{ part: h.part, location: h.location }] : []))
}
