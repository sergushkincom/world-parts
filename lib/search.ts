import {
  INVENTORY,
  PARTS,
  ROOMS,
  SEARCH_MIN_CHARS,
  WORLD_ROOM,
  type InventoryRow,
  type Part,
  type Room,
  type RoomId,
  type WorldObject,
} from "@/lib/data"

const PARTS_BY_NUMBER = new Map(PARTS.map((p) => [p.number, p]))

export function getPart(number: string | undefined): Part | undefined {
  return number ? PARTS_BY_NUMBER.get(number) : undefined
}

export function getRoom(id: RoomId): Room {
  return ROOMS.find((r) => r.id === id)!
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

export function normalizeQuery(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

export function isSearchable(q: string) {
  return normalizeQuery(q).length >= SEARCH_MIN_CHARS
}

export function partMatches(part: Part, q: string) {
  const needle = normalizeQuery(q)
  const compact = squash(needle)
  if (compact && squash(part.number).includes(compact)) return true
  return [part.name, part.description, ...part.keywords].some((t) => t.toLowerCase().includes(needle))
}

export function objectMatches(object: WorldObject, part: Part | undefined, q: string) {
  const needle = normalizeQuery(q)
  return (
    object.name.toLowerCase().includes(needle) ||
    object.concept.includes(needle) ||
    (part ? partMatches(part, q) : false)
  )
}

export type WorldHit = { object: WorldObject; part: Part | undefined }
export type InventoryHit = { row: InventoryRow; part: Part }

export type RoomResults =
  | { room: Room; kind: "world"; hits: WorldHit[] }
  | { room: Room; kind: "inventory"; hits: InventoryHit[] }

/** One flat, ordered option list so the combobox can step through every result with ↑/↓. */
export type SearchOption =
  | { id: string; kind: "world"; room: Room; hit: WorldHit }
  | { id: string; kind: "inventory"; room: Room; hit: InventoryHit }

export function searchWorld(
  q: string,
  objects: WorldObject[],
  linkFor: (o: WorldObject) => string | undefined,
  isInWorld: (o: WorldObject) => boolean,
): WorldHit[] {
  if (!isSearchable(q)) return []
  return objects
    .filter(isInWorld)
    .map((object) => ({ object, part: getPart(linkFor(object)) }))
    .filter(({ object, part }) => objectMatches(object, part, q))
}

export function searchPlant(
  q: string,
  worldHits: WorldHit[],
): { groups: RoomResults[]; options: SearchOption[] } {
  if (!isSearchable(q)) return { groups: [], options: [] }
  const groups: RoomResults[] = []
  if (worldHits.length) groups.push({ room: getRoom(WORLD_ROOM), kind: "world", hits: worldHits })

  for (const room of ROOMS) {
    if (room.scanned) continue
    const hits = INVENTORY.filter((row) => row.roomId === room.id)
      .map((row) => ({ row, part: getPart(row.partNumber)! }))
      .filter(({ part }) => partMatches(part, q))
    if (hits.length) groups.push({ room, kind: "inventory", hits })
  }

  const options: SearchOption[] = groups.flatMap((g): SearchOption[] =>
    g.kind === "world"
      ? g.hits.map((hit) => ({ id: `opt-${g.room.id}-${hit.object.id}`, kind: "world", room: g.room, hit }))
      : g.hits.map((hit) => ({
          id: `opt-${g.room.id}-${hit.part.number}`,
          kind: "inventory",
          room: g.room,
          hit,
        })),
  )
  return { groups, options }
}

export function stockOnHand(partNumber: string) {
  return INVENTORY.filter((r) => r.partNumber === partNumber).reduce((sum, r) => sum + r.qty, 0)
}
