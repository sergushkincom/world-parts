import {
  PARTS,
  ROOMS,
  SEARCH_MIN_CHARS,
  WORLD_ROOM,
  type Equipment,
  type Part,
  type Room,
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

export type RoomResults =
  | { room: Room; kind: "world"; hits: WorldHit[] }
  | { room: Room; kind: "inventory"; hits: InventoryHit[] }

/** One flat, ordered option list so the combobox can step through every result with ↑/↓. */
export type SearchOption =
  | { id: string; kind: "world"; room: Room; hit: WorldHit }
  | { id: string; kind: "inventory"; room: Room; hit: InventoryHit }

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

export function searchPlant(q: string, worldHits: WorldHit[]): { groups: RoomResults[]; options: SearchOption[] } {
  if (!isSearchable(q)) return { groups: [], options: [] }
  const groups: RoomResults[] = []
  if (worldHits.length) groups.push({ room: getRoom(WORLD_ROOM), kind: "world", hits: worldHits })

  const matchingParts = PARTS.filter((p) => partMatches(p, q))
  for (const room of ROOMS) {
    if (room.scanned) continue
    const hits = matchingParts.flatMap((part) =>
      part.storedIn.filter((l) => locationRoom(l) === room.id).map((location) => ({ part, location })),
    )
    if (hits.length) groups.push({ room, kind: "inventory", hits })
  }

  const options: SearchOption[] = groups.flatMap((g): SearchOption[] =>
    g.kind === "world"
      ? g.hits.map((hit) => ({ id: `opt-${g.room.id}-${hit.object.id}`, kind: "world", room: g.room, hit }))
      : g.hits.map((hit, i) => ({ id: `opt-${g.room.id}-${hit.part.partNo}-${i}`, kind: "inventory", room: g.room, hit })),
  )
  return { groups, options }
}
