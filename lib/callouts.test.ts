import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SEED_OBJECTS, type WorldObject } from "./data.ts"
import {
  availabilityFromFacts,
  calloutButtonName,
  calloutDetail,
  calloutMetrics,
  layoutCallout,
  productCallout,
  type CalloutSide,
  type LayoutCalloutInput,
} from "./callouts.ts"

function object(id: string): WorldObject {
  const found = SEED_OBJECTS.find((item) => item.id === id)
  assert.ok(found)
  return found
}

function place(over: Partial<LayoutCalloutInput> = {}) {
  return layoutCallout({
    anchorX: 200,
    anchorY: 200,
    viewportWidth: 1000,
    viewportHeight: 600,
    cardWidth: 160,
    cardHeight: 48,
    gap: 40,
    margin: 8,
    ...over,
  })
}

describe("callout side", () => {
  it("puts the card on the side with more room", () => {
    const leftAnchor = place({ anchorX: 180 })
    assert.equal(leftAnchor.side, "right")
    assert.equal(leftAnchor.card.x, 220)
    assert.equal(leftAnchor.attach?.x, leftAnchor.card.x)

    const rightAnchor = place({ anchorX: 820 })
    assert.equal(rightAnchor.side, "left")
    assert.equal(rightAnchor.card.x, 820 - 40 - 160)
    assert.equal(rightAnchor.attach?.x, rightAnchor.card.x + 160)
  })

  it("flips when the preferred side cannot hold the card", () => {
    // Anchor is left of centre, but a wide card plus the gap does not fit on the right.
    const flipped = place({ anchorX: 280, viewportWidth: 420, cardWidth: 180, gap: 36 })
    assert.equal(flipped.side, "left")
    assert.ok(flipped.card.x + flipped.card.width <= 420 - 8)
    assert.ok(flipped.attach && flipped.attach.x <= 280)
  })

  it("keeps the current side while the anchor is near the middle", () => {
    const shared = { anchorX: 510, cardWidth: 120, gap: 40, margin: 10, viewportWidth: 1000, slack: 48 }
    const stayed = place({ ...shared, previousSide: "right" })
    assert.equal(stayed.side, "right")
    assert.equal(stayed.card.x, 550)

    const opened = place({ ...shared, previousSide: null })
    assert.equal(opened.side, "left")
  })

  it("drops the remembered side once that side no longer fits", () => {
    const flipped = place({
      anchorX: 860,
      cardWidth: 140,
      gap: 36,
      previousSide: "right",
      slack: 48,
    })
    assert.equal(flipped.side, "left")
  })

  it("meets the card with a horizontal leader when the anchor is clear of the edges", () => {
    const layout = place({ anchorX: 240, anchorY: 300 })
    assert.equal(layout.card.y, 300 - 24)
    assert.equal(layout.attach?.y, 300)
  })

  it("keeps whichever side is already showing while the anchor sits in the middle", () => {
    const sides: CalloutSide[] = ["left", "right"]
    for (const previousSide of sides) {
      const layout = place({ anchorX: 500, previousSide, slack: 80 })
      assert.equal(layout.side, previousSide)
    }
  })
})

describe("callout clamping", () => {
  it("keeps the card inside the margin when the anchor is on an edge", () => {
    const top = place({ anchorX: 240, anchorY: 0 })
    assert.equal(top.card.y, 8)
    assert.equal(top.attach?.y, 8 + 6)

    const bottom = place({ anchorX: 240, anchorY: 600, viewportHeight: 600 })
    assert.equal(bottom.card.y, 600 - 8 - 48)
    assert.equal(bottom.attach?.y, bottom.card.y + 48 - 6)

    // The anchor is on the left edge, so the card steps to the right and only the vertical axis clamps.
    const corner = place({ anchorX: 4, anchorY: 4, cardWidth: 120, cardHeight: 40 })
    assert.equal(corner.side, "right")
    assert.equal(corner.card.x, 44)
    assert.equal(corner.card.y, 8)
    assert.ok(corner.card.x >= 8)
  })

  it("reserves inset chrome, so the card does not slide under it", () => {
    const layout = place({
      anchorX: 640,
      viewportWidth: 900,
      cardWidth: 150,
      gap: 32,
      insets: { right: 280 },
    })
    assert.equal(layout.side, "left")
    assert.ok(layout.card.x >= 8)
    assert.ok(layout.card.x + layout.card.width <= 900 - 8 - 280)
  })

  it("draws no leader when the card has to cover the anchor", () => {
    const layout = place({
      anchorX: 100,
      anchorY: 100,
      viewportWidth: 200,
      viewportHeight: 200,
      cardWidth: 180,
      cardHeight: 80,
      gap: 10,
    })
    assert.equal(layout.attach, null)
    assert.ok(layout.card.x >= 8)
    assert.ok(layout.card.y >= 8)
  })

  it("keeps every card inside the margin, and repeats the same place on the next frame", () => {
    const viewportWidth = 1100
    const viewportHeight = 700
    const cardWidth = 140
    const cardHeight = 48
    const margin = 8
    for (let anchorX = -40; anchorX <= viewportWidth + 40; anchorX += 90) {
      for (let anchorY = -40; anchorY <= viewportHeight + 40; anchorY += 80) {
        const input: LayoutCalloutInput = {
          anchorX,
          anchorY,
          viewportWidth,
          viewportHeight,
          cardWidth,
          cardHeight,
          gap: 36,
          margin,
          slack: 48,
        }
        const first = layoutCallout(input)
        assert.ok(first.card.x >= margin, `x ${first.card.x} at anchor ${anchorX},${anchorY}`)
        assert.ok(first.card.y >= margin, `y ${first.card.y} at anchor ${anchorX},${anchorY}`)
        assert.ok(first.card.x + cardWidth <= viewportWidth - margin)
        assert.ok(first.card.y + cardHeight <= viewportHeight - margin)
        if (first.attach) {
          const onNearEdge = first.side === "right" ? first.attach.x === first.card.x : first.attach.x === first.card.x + cardWidth
          assert.ok(onNearEdge)
          assert.ok(first.attach.y >= first.card.y)
          assert.ok(first.attach.y <= first.card.y + cardHeight)
        }
        const again = layoutCallout({ ...input, previousSide: first.side })
        assert.equal(again.side, first.side)
        assert.deepEqual(again.card, first.card)
      }
    }
  })
})

describe("compact metrics", () => {
  it("shortens the leader below the panel breakpoint and keeps the full one at it", () => {
    const phone = calloutMetrics(375)
    const desktop = calloutMetrics(1280)
    assert.equal(phone.compact, true)
    assert.equal(calloutMetrics(899).compact, true)
    assert.equal(desktop.compact, false)
    assert.equal(calloutMetrics(900).compact, false)
    assert.ok(phone.gap < desktop.gap)
    assert.ok(phone.margin <= desktop.margin)
  })
})

describe("product fields", () => {
  it("names a machine and whether its spares are in stock, without a stock count for the machine itself", () => {
    const pump = productCallout(object("obj-pump"))
    assert.equal(pump.name, "pump")
    assert.equal(pump.partNo, "P-104")
    assert.equal(pump.stock, null)
    assert.equal(pump.availability, "in stock")
    assert.equal(calloutDetail(pump), "spares in stock")
    assert.equal(calloutButtonName(pump), "pump, P-104, spares in stock: show in the world")
  })

  it("sums the units stored in a cabinet, and marks a nearly empty store as low", () => {
    const cabinet = productCallout(object("obj-cabinet"))
    assert.equal(cabinet.partNo, "CAB-01")
    assert.equal(cabinet.stock, 33)
    assert.equal(cabinet.availability, "in stock")
    assert.equal(calloutDetail(cabinet), "33 in stock")

    const electrical = productCallout(object("obj-el-cabinet"))
    assert.equal(electrical.partNo, "EC-01")
    assert.equal(electrical.stock, 1)
    assert.equal(electrical.availability, "low")
    assert.equal(calloutDetail(electrical), "1 in stock · low")
  })

  it("leaves stock off a unit with an asset id and no parts on file", () => {
    const pallet = productCallout(object("obj-pallet"))
    assert.equal(pallet.partNo, "PAL-07")
    assert.equal(pallet.stock, null)
    assert.equal(pallet.availability, null)
    assert.equal(calloutDetail(pallet), null)
    assert.equal(calloutButtonName(pallet), "pallet, PAL-07: show in the world")
  })

  it("has nothing to hang on an object that is not registered equipment", () => {
    const drum = productCallout({
      ...object("obj-pump"),
      id: "obj-drum",
      name: "drum",
      concept: "drum",
      assetId: undefined,
      kind: undefined,
    })
    assert.deepEqual(drum, { name: "drum", partNo: null, stock: null, availability: null })
  })
})

describe("availability from stock facts", () => {
  it("counts units in this store ahead of parts fitted in it", () => {
    assert.deepEqual(availabilityFromFacts({ storedQty: 1, fitted: [{ stock: 9, hasLocation: true }] }), {
      stock: 1,
      availability: "low",
    })
    assert.deepEqual(availabilityFromFacts({ storedQty: 4, fitted: [] }), { stock: 4, availability: "in stock" })
  })

  it("says installed only when no fitted part has a spare location", () => {
    assert.deepEqual(availabilityFromFacts({ storedQty: null, fitted: [{ stock: 0, hasLocation: false }] }), {
      stock: null,
      availability: "installed only",
    })
    assert.equal(
      calloutDetail({ name: "pump", partNo: "P-104", stock: null, availability: "installed only" }),
      "installed only",
    )
  })

  it("says low when every stocked spare is at or under the low-stock line", () => {
    assert.deepEqual(
      availabilityFromFacts({
        storedQty: null,
        fitted: [
          { stock: 2, hasLocation: true },
          { stock: 0, hasLocation: false },
        ],
      }),
      { stock: null, availability: "low" },
    )
    assert.equal(calloutDetail({ name: "valve", partNo: "V-08", stock: null, availability: "low" }), "spares low")
  })

  it("says nothing when the unit has no parts", () => {
    assert.deepEqual(availabilityFromFacts({ storedQty: null, fitted: [] }), { stock: null, availability: null })
  })
})
