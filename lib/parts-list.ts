import { SEARCH_MIN_CHARS, WORLD_ROOM, type Part } from "@/lib/data"
import { getEquipment, idleMonths, isIdle, isLowStock, locationLabel, partInRoom, partStatuses } from "@/lib/parts"

export type PartFilter = "all" | "low" | "idle" | "room"
export type SortKey = "partNo" | "name" | "stock" | "location" | "status"
export type Sort = { key: SortKey; dir: "asc" | "desc" }

export const PART_FILTERS: { id: PartFilter; label: string; test: (p: Part) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "low", label: "Low stock", test: isLowStock },
  { id: "idle", label: "Idle", test: isIdle },
  { id: "room", label: "In world", test: (p) => partInRoom(p, WORLD_ROOM) },
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
