import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  EQUIPMENT,
  PARTS,
  SEARCH_MIN_CHARS,
  SEED_OBJECTS,
  type Equipment,
  type Part,
  type WorldObject,
} from "./data.ts"
import {
  equipmentMatches,
  getRoom,
  inventoryHits,
  isSearchable,
  normalizeQuery,
  partMatches,
  searchPlant,
  searchWorld,
  type PlanHit,
} from "./search.ts"

function byId(id: string): WorldObject {
  const found = SEED_OBJECTS.find((item) => item.id === id)
  assert.ok(found)
  return found
}

function part(partNo: string): Part {
  const found = PARTS.find((item) => item.partNo === partNo)
  assert.ok(found)
  return found
}

function equipment(assetId: string): Equipment {
  const found = EQUIPMENT.find((item) => item.assetId === assetId)
  assert.ok(found)
  return found
}

/** Lifted and low-confidence objects are the ones the world view frames. */
const drawable = (object: WorldObject) => object.status === "lifted" || object.status === "low_confidence"

function labels(hits: PlanHit[]) {
  return hits.map((hit) => {
    if (hit.kind === "equipment") return `equipment:${hit.object.id}`
    if (hit.kind === "inventory") return `inventory:${hit.part.partNo}`
    return `${hit.kind}:${hit.part.partNo}:${hit.equipment.assetId}`
  })
}

function worldIds(query: string, objects: WorldObject[] = SEED_OBJECTS, visible = drawable) {
  return searchWorld(query, objects, visible).map((hit) => hit.object.id)
}

describe("normalizeQuery and isSearchable", () => {
  it("trims, lowercases and collapses whitespace", () => {
    assert.equal(normalizeQuery("  6205   2RS "), "6205 2rs")
    assert.equal(normalizeQuery("Ball   valve"), "ball valve")
  })

  it("searches only once the normalised query reaches the minimum", () => {
    assert.equal(SEARCH_MIN_CHARS, 2)
    assert.equal(isSearchable(""), false)
    assert.equal(isSearchable(" "), false)
    assert.equal(isSearchable("a"), false)
    assert.equal(isSearchable("  x "), false)
    assert.equal(isSearchable("ab"), true)
    assert.equal(isSearchable("  6205 "), true)
  })
})

describe("part and equipment matching", () => {
  it("matches a part number with or without dashes and spaces", () => {
    const bearing = part("BRG-6205-2RS")
    for (const query of ["6205 2rs", "6205-2RS", "BRG 6205 2RS"]) {
      assert.equal(partMatches(bearing, query), true)
    }
    assert.equal(partMatches(part("BRG-6305"), "6205 2rs"), false)
    assert.equal(partMatches(bearing, "rubber sealed"), true)
    assert.equal(partMatches(bearing, "ball valve"), false)
  })

  it("matches an object by its name or concept, and an asset id ignoring dashes", () => {
    const cabinet = byId("obj-cabinet")
    const pump = byId("obj-pump")
    assert.equal(equipmentMatches(undefined, pump, "pump"), true)
    assert.equal(equipmentMatches(undefined, { ...pump, name: "Circulation unit" }, "pump"), true)
    assert.equal(equipmentMatches(undefined, byId("obj-valve"), "pump"), false)
    assert.equal(equipmentMatches(equipment("CAB-01"), cabinet, "cab-01"), true)
    assert.equal(equipmentMatches(equipment("CAB-01"), cabinet, "CAB 01"), true)
  })
})

describe("searchWorld", () => {
  it("returns nothing until the query is searchable", () => {
    for (const query of ["", " ", "g"]) {
      assert.deepEqual(worldIds(query), [])
    }
    assert.deepEqual(searchWorld("pump", [], drawable), [])
  })

  it("keeps seed order and follows a part into the machine and the bin that hold it", () => {
    assert.deepEqual(worldIds("6205 2rs"), ["obj-pump", "obj-motor", "obj-cabinet", "obj-rack-r2"])
    assert.deepEqual(worldIds("bronze"), ["obj-pump"])
    assert.deepEqual(worldIds("fuse"), ["obj-cabinet"])
    assert.deepEqual(worldIds("hose"), ["obj-cabinet", "obj-hose"])
    assert.deepEqual(worldIds("pump"), ["obj-pump", "obj-rack-r1", "obj-cnc-01", "obj-cnc-02", "obj-cnc-03", "obj-cnc-04"])
  })

  it("leaves out objects the caller says are not on screen", () => {
    const failedPump: WorldObject = { ...byId("obj-pump"), id: "obj-pump-failed", status: "failed" }
    assert.deepEqual(worldIds("pump", [failedPump, byId("obj-pump")]), ["obj-pump"])
    assert.deepEqual(
      worldIds("6205 2rs", SEED_OBJECTS, (object) => drawable(object) && object.room === "workshop"),
      ["obj-pump", "obj-motor", "obj-cabinet"],
    )
  })
})

describe("searchPlant", () => {
  it("returns nothing until the query is searchable", () => {
    assert.deepEqual(searchPlant("", SEED_OBJECTS), { groups: [], options: [] })
    assert.deepEqual(searchPlant("g", SEED_OBJECTS), { groups: [], options: [] })
  })

  it("groups a part by room and lists equipment, then spares, then fitted parts", () => {
    const hose = searchPlant("hose", SEED_OBJECTS)
    assert.deepEqual(labels(hose.groups[0].hits), [
      "equipment:obj-hose",
      "stored:HCL-40-60:CAB-01",
      "installed:HCL-40-60:H-12",
    ])
    assert.deepEqual(
      hose.options.map((option) => option.id),
      ["opt-workshop-obj-hose", "opt-workshop-stored-HCL-40-60-1", "opt-workshop-installed-HCL-40-60-2"],
    )

    const bearing = searchPlant("6205 2rs", SEED_OBJECTS)
    assert.deepEqual(
      bearing.groups.map((group) => group.room.id),
      ["workshop", "storeroom"],
    )
    assert.deepEqual(labels(bearing.groups[0].hits), [
      "stored:BRG-6205-2RS:CAB-01",
      "installed:BRG-6205-2RS:P-104",
      "installed:BRG-6205-2RS:M-21",
    ])
    assert.deepEqual(labels(bearing.groups[1].hits), ["stored:BRG-6205-2RS:R2"])
  })

  it("walks rooms in plan order and keeps one flat option list for the keyboard", () => {
    const pump = searchPlant("pump", SEED_OBJECTS)
    assert.deepEqual(
      pump.groups.map((group) => [group.room.id, group.inWorld]),
      [
        ["production", true],
        ["workshop", true],
        ["storeroom", true],
      ],
    )
    assert.deepEqual(labels(pump.groups.flatMap((group) => group.hits)), [
      "installed:CLP-025:CNC-01",
      "installed:CLP-025:CNC-02",
      "installed:CLP-025:CNC-03",
      "installed:CLP-025:CNC-04",
      "equipment:obj-pump",
      "stored:CLP-025:R1",
    ])
    assert.deepEqual(
      pump.options.map((option) => option.hit),
      pump.groups.flatMap((group) => group.hits),
    )
    assert.equal(new Set(pump.options.map((option) => option.id)).size, pump.options.length)
  })

  it("sends a shelf with no scene to inventory, and a room with no scan after the scanned ones", () => {
    const grease = searchPlant("grease", SEED_OBJECTS)
    assert.deepEqual(
      grease.groups.map((group) => [group.room.id, group.inWorld]),
      [
        ["workshop", true],
        ["loading", false],
      ],
    )
    const loading = grease.groups.find((group) => group.room.id === "loading")
    assert.deepEqual(inventoryHits(loading), [
      { part: part("GRS-400"), location: { room: "loading", location: "inbound pallet, door 2", qty: 12 } },
    ])
    assert.deepEqual(inventoryHits(grease.groups.find((group) => group.room.id === "workshop")), [])
    assert.deepEqual(inventoryHits(undefined), [])

    // The corridor is scanned and sits after the loading bay on the plan, so this is the sort, not the room list.
    const station: WorldObject = { ...byId("obj-extinguisher-c"), name: "grease station", concept: "grease station" }
    const ordered = searchPlant("grease", [...SEED_OBJECTS, station])
    assert.deepEqual(
      ordered.groups.map((group) => group.room.id),
      ["workshop", "corridor", "loading"],
    )
  })

  it("turns a bin into an inventory hit when that equipment is not in the scene", () => {
    const workshopOnly = SEED_OBJECTS.filter((object) => object.room === "workshop")
    const bearing = searchPlant("6205 2rs", workshopOnly)
    assert.deepEqual(labels(bearing.groups[0].hits), [
      "stored:BRG-6205-2RS:CAB-01",
      "installed:BRG-6205-2RS:P-104",
      "installed:BRG-6205-2RS:M-21",
    ])
    assert.equal(bearing.groups[1].room.id, "storeroom")
    assert.deepEqual(labels(bearing.groups[1].hits), ["inventory:BRG-6205-2RS"])
    // Fitted only, and the pump is not drawn: there is nowhere to send the hit.
    assert.deepEqual(searchPlant("bronze", []), { groups: [], options: [] })
  })

  it("resolves a room from the same list the plan uses", () => {
    assert.equal(getRoom("workshop").name, "Workshop")
    assert.equal(getRoom("workshop").scanned, true)
    assert.equal(getRoom("loading").scanned, false)
    assert.equal(getRoom("office").scanned, false)
  })
})
