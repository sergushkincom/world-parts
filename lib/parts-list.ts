import { ROOMS, SEARCH_MIN_CHARS, type Part, type RoomId } from "@/lib/data"
import {
  getEquipment,
  idleMonths,
  isBin,
  isIdle,
  isLowStock,
  locationLabel,
  locationRoom,
  partInRoom,
  partStatuses,
  placeLabel,
  spareInWorld,
} from "@/lib/parts"

export type PartFilter = "all" | "low" | "idle" | "room"
export type SortKey = "partNo" | "name" | "stock" | "location" | "status"
export type Sort = { key: SortKey; dir: "asc" | "desc" }

export const PART_FILTERS: { id: PartFilter; label: string; test: (p: Part) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "low", label: "Low stock", test: isLowStock },
  { id: "idle", label: "Idle", test: isIdle },
  { id: "room", label: "In world", test: (p) => ROOMS.some((r) => r.scanned && partInRoom(p, r.id)) },
]

/** Part numbers are typed with or without dashes and spaces: "6205 2rs" finds BRG-6205-2RS. */
const compact = (s: string) => s.toLowerCase().replace(/[\s\-_./]/g, "")

export function matchesQuery(part: Part, q: string) {
  const term = q.trim().toLowerCase()
  if (term.length < SEARCH_MIN_CHARS) return true
  const c = compact(term)
  if (c && compact(part.partNo).includes(c)) return true
  if (part.name.toLowerCase().includes(term) || part.description.toLowerCase().includes(term)) return true
  // Equipment names and asset IDs match the parts fitted in that equipment.
  return part.installedIn.some((id) => {
    const eq = getEquipment(id)
    return !!eq && (compact(eq.assetId).includes(c) || eq.name.toLowerCase().includes(term))
  })
}

const STATUS_RANK = { low: 0, installed_only: 1, in_stock: 2, idle: 3, substitute: 1 } as const

function sortValue(part: Part, key: SortKey): string | number {
  switch (key) {
    case "partNo":
      return part.partNo
    case "name":
      return part.name.toLowerCase()
    case "stock":
      return part.stock
    case "location":
      return part.storedIn[0] ? locationLabel(part.storedIn[0]).toLowerCase() : "\uffff"
    case "status":
      // Problems first, then the longest idle.
      return STATUS_RANK[partStatuses(part)[0].id] * 1000 - (idleMonths(part) ?? 0)
  }
}

export function sortParts(parts: Part[], { key, dir }: Sort) {
  const sign = dir === "asc" ? 1 : -1
  return [...parts].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))
    return cmp * sign || a.partNo.localeCompare(b.partNo)
  })
}

/** Where the split view points the camera for a part: a room, the equipment that holds it, and a short label. */
export type PartPlace = { room: RoomId; assetId: string | null; label: string }

/**
 * A spare in a scanned room first (that one can be framed in 3D), then the first stock location,
 * then the equipment the part is fitted in. Null only for a part with no location at all.
 */
export function partPlace(part: Part): PartPlace | null {
  const stored = spareInWorld(part) ?? part.storedIn[0]
  if (stored) {
    return { room: locationRoom(stored), assetId: isBin(stored) ? stored.assetId : null, label: placeLabel(stored) }
  }
  const eq = part.installedIn.map((id) => getEquipment(id)).find((e) => e !== undefined)
  return eq ? { room: eq.room, assetId: eq.assetId, label: `in ${eq.name.toLowerCase()} ${eq.assetId}` } : null
}

/** The part is kept in this equipment's bins or fitted in it. */
export function partAtAsset(part: Part, assetId: string) {
  return part.installedIn.includes(assetId) || part.storedIn.some((l) => isBin(l) && l.assetId === assetId)
}
