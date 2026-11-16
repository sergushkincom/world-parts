import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PARTS, type Part } from "./data.ts"
import { PART_FILTERS, matchesQuery, partAtAsset, partPlace, sortParts } from "./parts-list.ts"

function part(partNo: string): Part {
  const found = PARTS.find((item) => item.partNo === partNo)
  assert.ok(found)
  return found
}

function partNos(parts: Part[]) {
  return parts.map((item) => item.partNo).sort()
}

function filtered(id: (typeof PART_FILTERS)[number]["id"]) {
  const filter = PART_FILTERS.find((item) => item.id === id)
  assert.ok(filter)
  return filter
}

describe("part filters", () => {
  it("names the four list tabs", () => {
    assert.deepEqual(
      PART_FILTERS.map(({ id, label }) => [id, label]),
      [
        ["all", "All"],
        ["low", "Low stock"],
        ["idle", "Idle"],
        ["room", "In world"],
      ],
    )
  })

  it("keeps every record on All, and the low-stock and idle records on those tabs", () => {
    assert.deepEqual(partNos(PARTS.filter(filtered("all").test)), partNos(PARTS))
    assert.deepEqual(partNos(PARTS.filter(filtered("low").test)), [
      "BRG-6305",
      "BVL-1-BR",
      "CLP-025",
      "FUS-32A",
      "IMP-160-SS",
      "SEL-25",
    ])
    assert.deepEqual(partNos(PARTS.filter(filtered("idle").test)), ["FUS-32A", "GSK-SET", "IMP-160-SS"])
    // Installed only, so it is not low stock. Eight on hand is not low either.
    assert.equal(filtered("low").test(part("IMP-160")), false)
    assert.equal(filtered("low").test(part("BRG-6205-2RS")), false)
    assert.equal(filtered("idle").test(part("IMP-160")), false)
  })

  it("treats a scanned room as in world, and an unscanned shelf as not", () => {
    assert.deepEqual(partNos(PARTS.filter(filtered("room").test)), partNos(PARTS))
    const officeOnly: Part = {
      ...part("FUS-32A"),
      partNo: "OFF-1",
      installedIn: [],
      storedIn: [{ room: "office", rack: "R9", shelf: 1, qty: 1 }],
      stock: 1,
      idleSince: null,
    }
    const loadingOnly: Part = {
      ...part("GRS-400"),
      partNo: "LOAD-1",
      installedIn: [],
      storedIn: [{ room: "loading", location: "dock", qty: 4 }],
      stock: 4,
      idleSince: null,
    }
    assert.equal(filtered("room").test(officeOnly), false)
    assert.equal(filtered("room").test(loadingOnly), false)
    assert.equal(filtered("all").test(officeOnly), true)
    assert.equal(filtered("low").test(officeOnly), true)
    assert.equal(filtered("low").test(loadingOnly), false)
  })
})

describe("matchesQuery", () => {
  it("matches every part until the query is long enough to search", () => {
    for (const query of ["", " ", "b"]) {
      assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, query))), partNos(PARTS))
    }
  })

  it("finds a part number with or without dashes and spaces", () => {
    for (const query of ["6205 2rs", "6205-2RS", "  BRG-6205-2RS  "]) {
      assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, query))), ["BRG-6205-2RS"])
    }
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "6305"))), ["BRG-6305"])
  })

  it("matches the name and the description", () => {
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "BEARING 6305"))), ["BRG-6305"])
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "rubber sealed"))), ["BRG-6205-2RS"])
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "aramid"))), ["GSK-SET"])
  })

  it("matches equipment a part is fitted in, not a bin it merely sits in", () => {
    const onThePump = ["BRG-6205-2RS", "GSK-SET", "IMP-160", "SEL-25"]
    for (const query of ["p-104", "P 104", "p104"]) {
      assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, query))), onThePump)
    }
    // "pump" is the asset name, and the coolant pump matches by its own name.
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "pump"))), [...onThePump, "CLP-025"].sort())
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "cnc-01"))), ["CLP-025", "XPZ-1000"])
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "electrical"))), ["CTR-25A"])
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "cab-01"))), [])
    assert.deepEqual(partNos(PARTS.filter((item) => matchesQuery(item, "rack r2"))), [])
  })
})

describe("sortParts", () => {
  it("sorts by part number, name and stock without changing the input", () => {
    const input = ["HCL-40-60", "BVL-1-BR", "BRG-6205-2RS", "BRG-6305", "CLP-025"].map(part)
    const snapshot = input.map((item) => item.partNo)
    const byNumber = sortParts(input, { key: "partNo", dir: "asc" })
    assert.notEqual(byNumber, input)
    assert.deepEqual(
      input.map((item) => item.partNo),
      snapshot,
    )
    assert.deepEqual(
      byNumber.map((item) => item.partNo),
      ["BRG-6205-2RS", "BRG-6305", "BVL-1-BR", "CLP-025", "HCL-40-60"],
    )
    assert.deepEqual(
      sortParts(input, { key: "partNo", dir: "desc" }).map((item) => item.partNo),
      ["HCL-40-60", "CLP-025", "BVL-1-BR", "BRG-6305", "BRG-6205-2RS"],
    )
    assert.deepEqual(
      sortParts(input, { key: "name", dir: "asc" }).map((item) => item.partNo),
      ["BVL-1-BR", "BRG-6205-2RS", "BRG-6305", "CLP-025", "HCL-40-60"],
    )
    // Stock is numeric: 8 and 12 stay after 1 and 2. Equal stocks break the tie by part number, even descending.
    assert.deepEqual(
      sortParts(input, { key: "stock", dir: "asc" }).map((item) => item.partNo),
      ["BRG-6305", "CLP-025", "BVL-1-BR", "BRG-6205-2RS", "HCL-40-60"],
    )
    assert.deepEqual(
      sortParts(input, { key: "stock", dir: "desc" }).map((item) => item.partNo),
      ["HCL-40-60", "BRG-6205-2RS", "BVL-1-BR", "BRG-6305", "CLP-025"],
    )
  })

  it("orders locations alphabetically and puts a part with no shelf last", () => {
    const input = ["IMP-160", "SEL-25", "CLP-025", "BRG-6305"].map(part)
    assert.deepEqual(
      sortParts(input, { key: "location", dir: "asc" }).map((item) => item.partNo),
      ["CLP-025", "BRG-6305", "SEL-25", "IMP-160"],
    )
    assert.deepEqual(
      sortParts(input, { key: "location", dir: "desc" }).map((item) => item.partNo),
      ["IMP-160", "SEL-25", "BRG-6305", "CLP-025"],
    )
  })

  it("puts problems first, and a longer idle spell ahead of a shorter one", () => {
    const input = ["GRS-400", "IMP-160", "GSK-SET", "BRG-6305", "FUS-32A", "IMP-160-SS"].map(part)
    assert.deepEqual(
      sortParts(input, { key: "status", dir: "asc" }).map((item) => item.partNo),
      ["FUS-32A", "IMP-160-SS", "BRG-6305", "IMP-160", "GSK-SET", "GRS-400"],
    )
    assert.deepEqual(
      sortParts(input, { key: "status", dir: "desc" }).map((item) => item.partNo),
      ["GRS-400", "GSK-SET", "IMP-160", "BRG-6305", "IMP-160-SS", "FUS-32A"],
    )
    // Same status rank keeps part-number order, including when the direction is descending.
    const tied = ["SEL-25", "BRG-6305"].map(part)
    assert.deepEqual(
      sortParts(tied, { key: "status", dir: "desc" }).map((item) => item.partNo),
      ["BRG-6305", "SEL-25"],
    )
  })

  it("returns an empty list unchanged in shape", () => {
    assert.deepEqual(sortParts([], { key: "name", dir: "asc" }), [])
  })
})

describe("part place for the split view", () => {
  it("prefers a spare in a scanned room over stock elsewhere", () => {
    assert.deepEqual(partPlace(part("GRS-400")), { room: "workshop", assetId: "CAB-01", label: "cabinet C1" })
  })

  it("points a shelf part at its rack", () => {
    assert.deepEqual(partPlace(part("BRG-6305")), { room: "storeroom", assetId: "R2", label: "rack R2, shelf 3" })
  })

  it("falls back to the equipment an installed-only part is fitted in", () => {
    const place = partPlace(part("IMP-160"))
    assert.equal(place?.room, "workshop")
    assert.equal(place?.assetId, "P-104")
  })

  it("gives every part in the inventory a place", () => {
    for (const p of PARTS) assert.ok(partPlace(p), p.partNo)
  })
})

describe("parts at a piece of equipment", () => {
  it("counts parts in its bins and parts fitted in it", () => {
    assert.equal(partAtAsset(part("FUS-32A"), "CAB-01"), true)
    assert.equal(partAtAsset(part("BRG-6305"), "M-21"), true)
    assert.equal(partAtAsset(part("BRG-6305"), "CAB-01"), false)
  })
})
