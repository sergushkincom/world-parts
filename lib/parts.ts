import {
  EQUIPMENT,
  INVENTORY,
  PARTS,
  ROOMS,
  type BinLocation,
  type Equipment,
  type Part,
  type Room,
  type RoomId,
  type SimilarPart,
  type StoredLocation,
  type WorldObject,
} from "@/lib/data"

const PARTS_BY_NO = new Map(PARTS.map((p) => [p.partNo, p]))
const EQUIPMENT_BY_ASSET = new Map(EQUIPMENT.map((e) => [e.assetId, e]))
const EQUIPMENT_BY_CONCEPT = new Map(EQUIPMENT.map((e) => [e.concept, e]))

export function getPart(partNo: string | null | undefined): Part | undefined {
  return partNo ? PARTS_BY_NO.get(partNo) : undefined
}

export function getEquipment(assetId: string | null | undefined): Equipment | undefined {
  return assetId ? EQUIPMENT_BY_ASSET.get(assetId) : undefined
}

/** Saved worlds predate asset IDs, so fall back to the concept. */
export function equipmentFor(object: WorldObject | undefined): Equipment | undefined {
  if (!object) return undefined
  return getEquipment(object.assetId) ?? EQUIPMENT_BY_CONCEPT.get(object.concept)
}

export function getRoom(id: RoomId): Room {
  return ROOMS.find((r) => r.id === id)!
}

export const isBin = (l: StoredLocation): l is BinLocation => "bin" in l

export function locationRoom(l: StoredLocation): RoomId {
  return isBin(l) ? (getEquipment(l.assetId)?.room ?? "workshop") : l.room
}

/** In world = the room has a 3D scene, so the location can be framed. */
export function isInWorld(l: StoredLocation) {
  return getRoom(locationRoom(l)).scanned
}

/** "cabinet B3", "rack R2, shelf 3", "line 2, machine 4". */
export function placeLabel(l: StoredLocation, { shelf = true } = {}) {
  if (isBin(l)) return `${getEquipment(l.assetId)?.concept ?? l.assetId} ${l.bin}`
  if ("rack" in l) return shelf ? `rack ${l.rack}, shelf ${l.shelf}` : `rack ${l.rack}`
  return l.location
}

/** "Workshop · cabinet B3 (2)". */
export function locationLabel(l: StoredLocation, opts?: { shelf?: boolean }) {
  return `${getRoom(locationRoom(l)).name} · ${placeLabel(l, opts)} (${l.qty})`
}

/** Where an installed-only part lives: "installed in pump P-104". */
export function installedLabel(part: Part) {
  const units = part.installedIn.map((id) => {
    const eq = getEquipment(id)
    return eq ? `${eq.name.toLowerCase()} ${eq.assetId}` : id
  })
  return units.length ? `installed in ${units.join(", ")}` : null
}

export function partsInstalledIn(assetId: string) {
  return PARTS.filter((p) => p.installedIn.includes(assetId))
}

export function binContents(assetId: string, bin: string) {
  return PARTS.flatMap((part) =>
    part.storedIn.filter((l) => isBin(l) && l.assetId === assetId && l.bin === bin).map((l) => ({ part, qty: l.qty })),
  )
}

export function binOf(part: Part, assetId: string) {
  return part.storedIn.find((l): l is BinLocation => isBin(l) && l.assetId === assetId)?.bin ?? null
}

const asOf = new Date(`${INVENTORY.asOf}T00:00:00Z`)

export function idleMonths(part: Part): number | null {
  if (!part.idleSince) return null
  const since = new Date(`${part.idleSince}T00:00:00Z`)
  let months = (asOf.getUTCFullYear() - since.getUTCFullYear()) * 12 + asOf.getUTCMonth() - since.getUTCMonth()
  if (asOf.getUTCDate() < since.getUTCDate()) months -= 1
  return Math.max(0, months)
}

export type PartStatus =
  | { id: "in_stock"; label: string }
  | { id: "low"; label: string }
  | { id: "installed_only"; label: string }
  | { id: "idle"; label: string; months: number }
  | { id: "substitute"; label: string }

export function partStatuses(part: Part): PartStatus[] {
  const out: PartStatus[] = []
  if (!part.storedIn.length) {
    out.push({ id: "installed_only", label: "installed only" })
    if (stockedSubstitute(part)) out.push({ id: "substitute", label: "substitute in stock" })
  }
  else if (part.stock <= INVENTORY.lowStockMax) out.push({ id: "low", label: "low" })
  else out.push({ id: "in_stock", label: "in stock" })
  const months = idleMonths(part)
  if (months !== null) out.push({ id: "idle", label: `idle ${months} mo`, months })
  return out
}

export const isLowStock = (p: Part) => p.storedIn.length > 0 && p.stock <= INVENTORY.lowStockMax
export const isIdle = (p: Part) => (idleMonths(p) ?? 0) >= INVENTORY.idleMonths

/** Parts that are installed in or stored in a room. */
export function partInRoom(part: Part, room: RoomId) {
  return (
    part.storedIn.some((l) => locationRoom(l) === room) ||
    part.installedIn.some((id) => getEquipment(id)?.room === room)
  )
}

/** Broken references in the parts data; the list shows an error state instead of wrong links. */
export function validateParts(): string[] {
  const issues: string[] = []
  for (const p of PARTS) {
    for (const id of p.installedIn) if (!getEquipment(id)) issues.push(`${p.partNo}: installed in unknown asset ${id}`)
    for (const s of p.similar) if (!getPart(s.partNo)) issues.push(`${p.partNo}: similar part ${s.partNo} not found`)
    for (const l of p.storedIn) {
      if (!isBin(l)) continue
      const eq = getEquipment(l.assetId)
      if (!eq?.bins?.includes(l.bin)) issues.push(`${p.partNo}: bin ${l.assetId} ${l.bin} doesn't exist`)
    }
  }
  return issues
}

/** First bin in a scanned room that holds this part, so the camera can go there. */
export function spareInWorld(part: Part): BinLocation | undefined {
  return part.storedIn.find((l): l is BinLocation => isBin(l) && isInWorld(l))
}

/**
 * When there's no spare of the part itself: a stocked part that can do the same job.
 * Only exact duplicates and functional substitutes count; "related" parts are never offered as a swap.
 */
export function stockedSubstitute(part: Part): { part: Part; reason: string; match: SimilarPart["match"] } | undefined {
  for (const s of part.similar) {
    if (s.match === "related") continue
    const sub = getPart(s.partNo)
    if (sub && sub.storedIn.length) return { part: sub, reason: s.reason, match: s.match }
  }
  return undefined
}
