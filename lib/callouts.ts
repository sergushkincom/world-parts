import { INVENTORY, PARTS, type WorldObject } from "@/lib/data"
import { equipmentFor, isBin, partsInstalledIn } from "@/lib/parts"

/**
 * Product callouts for the live world: a dot on the object, a leader, and a
 * card off to one side.
 *
 * The arrangement — anchor, line, label that moves to the open side — is the
 * idea in willeastcott/splat-fashion `src/callouts.js` (MIT). The rules below
 * are written for this app: which side is clearer, how the card is kept on
 * screen, and which parts fields the card shows. Nothing here is hidden
 * because another surface is in front of it.
 */

/** Same width as the `panel` breakpoint. Below it, labels sit closer and pack tighter. */
export const CALLOUT = {
  compactBelow: 900,
  gap: 44,
  compactGap: 18,
  margin: 12,
  compactMargin: 8,
  /** Keep the current side while the two sides are this close, so orbiting does not flicker. */
  slack: 48,
} as const

export function calloutMetrics(viewportWidth: number) {
  const compact = viewportWidth < CALLOUT.compactBelow
  return {
    compact,
    gap: compact ? CALLOUT.compactGap : CALLOUT.gap,
    margin: compact ? CALLOUT.compactMargin : CALLOUT.margin,
    slack: CALLOUT.slack,
  }
}

export type CalloutSide = "left" | "right"

/** Extra reserved space inside the viewport, for chrome that sits over the scene. */
export type CalloutInsets = { top?: number; right?: number; bottom?: number; left?: number }

export type CalloutPlacement = {
  /** Side the card ended up on, after clamping. */
  side: CalloutSide
  card: { x: number; y: number; width: number; height: number }
  /**
   * Where the leader meets the card edge, in the same space as the anchor.
   * Null when the card covers the anchor, so there is nothing to point along.
   */
  attach: { x: number; y: number } | null
}

export type LayoutCalloutInput = {
  anchorX: number
  anchorY: number
  viewportWidth: number
  viewportHeight: number
  cardWidth: number
  cardHeight: number
  /** Gap between the anchor and the card's near edge, before clamping. */
  gap: number
  /** Minimum distance from the card to the viewport edge. */
  margin: number
  insets?: CalloutInsets
  /** Side already on screen. Kept while the two sides are within `slack`. */
  previousSide?: CalloutSide | null
  slack?: number
}

function clamp(value: number, min: number, max: number) {
  if (!(max > min)) return min
  return Math.min(max, Math.max(min, value))
}

function inset(margin: number, extra: number | undefined) {
  return margin + (extra ?? 0)
}

/**
 * Place the card on the side of the anchor with more room, then push it back
 * inside the viewport. A side that cannot hold the card loses to the other
 * side. Near a tie, `previousSide` wins so the card does not flip every frame.
 */
export function layoutCallout(input: LayoutCalloutInput): CalloutPlacement {
  const {
    anchorX,
    anchorY,
    viewportWidth,
    viewportHeight,
    cardWidth,
    cardHeight,
    gap,
    margin,
    insets,
    previousSide = null,
    slack = 0,
  } = input

  const left = inset(margin, insets?.left)
  const right = inset(margin, insets?.right)
  const top = inset(margin, insets?.top)
  const bottom = inset(margin, insets?.bottom)

  const roomRight = viewportWidth - right - anchorX
  const roomLeft = anchorX - left
  const need = cardWidth + gap
  const fits = (side: CalloutSide) => (side === "right" ? roomRight : roomLeft) >= need
  const clearer: CalloutSide = roomRight >= roomLeft ? "right" : "left"
  const other: CalloutSide = clearer === "right" ? "left" : "right"

  let chosen: CalloutSide
  const bothFit = fits("left") && fits("right")
  const nearTie = Math.abs(roomRight - roomLeft) <= slack
  if (bothFit && nearTie && previousSide && fits(previousSide)) chosen = previousSide
  else if (fits(clearer)) chosen = clearer
  else if (fits(other)) chosen = other
  else chosen = clearer

  const minX = Math.ceil(left)
  const minY = Math.ceil(top)
  const maxX = Math.floor(viewportWidth - right - cardWidth)
  const maxY = Math.floor(viewportHeight - bottom - cardHeight)
  const x = clamp(Math.round(chosen === "right" ? anchorX + gap : anchorX - gap - cardWidth), minX, maxX)
  const y = clamp(Math.round(anchorY - cardHeight / 2), minY, maxY)

  const coversAnchor =
    anchorX >= x && anchorX <= x + cardWidth && anchorY >= y && anchorY <= y + cardHeight
  const side: CalloutSide = x + cardWidth / 2 >= anchorX ? "right" : "left"
  const edgeInset = Math.min(6, cardHeight / 2)
  const attachY = Math.round(clamp(anchorY, y + edgeInset, y + cardHeight - edgeInset))

  return {
    side,
    card: { x, y, width: cardWidth, height: cardHeight },
    attach: coversAnchor ? null : { x: side === "right" ? x : x + cardWidth, y: attachY },
  }
}

export type CalloutAvailability = "in stock" | "low" | "installed only"

/** What the parts list knows about one unit, split into "stored here" and "fitted here". */
export type StockFacts = {
  /** Units in this unit's bins. Null when nothing is stored here. */
  storedQty: number | null
  /** Parts fitted in the unit. `hasLocation` means a spare exists somewhere. */
  fitted: { stock: number; hasLocation: boolean }[]
}

export type ProductCallout = {
  name: string
  /** Asset id of the registered unit. Null for an object that is not equipment. */
  partNo: string | null
  /** Units on hand in this unit. Null when the number would not be this unit's own stock. */
  stock: number | null
  availability: CalloutAvailability | null
}

export function availabilityFromFacts(facts: StockFacts): { stock: number | null; availability: CalloutAvailability | null } {
  if (facts.storedQty !== null) {
    const stock = facts.storedQty
    return { stock, availability: stock <= INVENTORY.lowStockMax ? "low" : "in stock" }
  }
  if (!facts.fitted.length) return { stock: null, availability: null }
  const stocked = facts.fitted.filter((part) => part.hasLocation)
  if (!stocked.length) return { stock: null, availability: "installed only" }
  const low = stocked.every((part) => part.stock <= INVENTORY.lowStockMax)
  return { stock: null, availability: low ? "low" : "in stock" }
}

function qtyStoredIn(assetId: string): number | null {
  let qty = 0
  let found = false
  for (const part of PARTS) {
    for (const loc of part.storedIn) {
      if (!isBin(loc) || loc.assetId !== assetId) continue
      found = true
      qty += loc.qty
    }
  }
  return found ? qty : null
}

/** Name, number, and stock or availability for the card on one world object. */
export function productCallout(object: WorldObject): ProductCallout {
  const partNo = equipmentFor(object)?.assetId ?? null
  if (!partNo) return { name: object.name, partNo: null, stock: null, availability: null }
  const { stock, availability } = availabilityFromFacts({
    storedQty: qtyStoredIn(partNo),
    fitted: partsInstalledIn(partNo).map((part) => ({ stock: part.stock, hasLocation: part.storedIn.length > 0 })),
  })
  return { name: object.name, partNo, stock, availability }
}

/** The second line of the card. Null when the parts data has nothing to add. */
export function calloutDetail(callout: ProductCallout): string | null {
  if (callout.stock != null && callout.availability === "low") return `${callout.stock} in stock · low`
  if (callout.stock != null) return `${callout.stock} in stock`
  if (callout.availability === "in stock") return "spares in stock"
  if (callout.availability === "low") return "spares low"
  if (callout.availability === "installed only") return "installed only"
  return null
}

/** Accessible name for the card button. */
export function calloutButtonName(callout: ProductCallout): string {
  const detail = calloutDetail(callout)
  const bits = [callout.name]
  if (callout.partNo) bits.push(callout.partNo)
  if (detail) bits.push(detail)
  return `${bits.join(", ")}: show in the world`
}
