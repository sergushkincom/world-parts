import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SCENE, SEED_OBJECTS, type Point } from "./data.ts"
import { bounds, centroid, containMapping, formatCount, toPointsAttr } from "./geometry.ts"

function polygonOf(id: string): Point[] {
  const object = SEED_OBJECTS.find((item) => item.id === id)
  assert.ok(object?.polygon)
  return object.polygon
}

describe("centroid and bounds", () => {
  it("averages a rectangle and returns the box around it", () => {
    const points: Point[] = [
      [0, 0],
      [4, 0],
      [4, 2],
      [0, 2],
    ]
    assert.deepEqual(centroid(points), [2, 1])
    assert.deepEqual(bounds(points), { x: 0, y: 0, width: 4, height: 2 })
  })

  it("keeps a single point as a zero-size box", () => {
    assert.deepEqual(centroid([[12, 7]]), [12, 7])
    assert.deepEqual(bounds([[12, 7]]), { x: 12, y: 7, width: 0, height: 0 })
  })

  it("places the cabinet label inside the seed polygon", () => {
    const polygon = polygonOf("obj-cabinet")
    const [x, y] = centroid(polygon)
    const box = bounds(polygon)
    assert.ok(x > box.x && x < box.x + box.width)
    assert.ok(y > box.y && y < box.y + box.height)
    assert.equal(toPointsAttr([[10, 20], [30, 40]]), "10,20 30,40")
    assert.equal(toPointsAttr(polygon).split(" ").length, polygon.length)
  })
})

describe("contain mapping", () => {
  it("fits the scene exactly when the container has the same shape", () => {
    assert.deepEqual(containMapping(SCENE.width, SCENE.height, SCENE.width, SCENE.height), {
      k: 1,
      offsetX: 0,
      offsetY: 0,
    })
  })

  it("letterboxes the spare axis, the way object-fit: contain does", () => {
    assert.deepEqual(containMapping(200, 100, 100, 100), { k: 1, offsetX: 50, offsetY: 0 })
    assert.deepEqual(containMapping(100, 200, 100, 100), { k: 1, offsetX: 0, offsetY: 50 })
    assert.deepEqual(containMapping(100, 100, 200, 50), { k: 0.5, offsetX: 0, offsetY: 37.5 })
  })
})

describe("formatCount", () => {
  it("leaves small counts alone and rounds thousands the way the splat labels do", () => {
    assert.equal(formatCount(0), "0")
    assert.equal(formatCount(999), "999")
    assert.equal(formatCount(1000), "1.0k")
    // Valve is 3_960 splats: one decimal until 10_000.
    assert.equal(formatCount(3_960), "4.0k")
    assert.equal(formatCount(9999), "10.0k")
    assert.equal(formatCount(10_000), "10k")
    // 10_500 is past the decimal cutoff, and toFixed rounds 10.5 up.
    assert.equal(formatCount(10_500), "11k")
    // Pump is 18_420 splats, cabinet is 31_400.
    assert.equal(formatCount(18_420), "18k")
    assert.equal(formatCount(31_400), "31k")
  })
})
