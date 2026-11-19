import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_MEASURE_UNITS,
  SPLAT_METRES_PER_UNIT,
  applyMeasureClick,
  buildCenterGrid,
  distanceMetres,
  formatMetres,
  isMeasureTap,
  measureStatus,
  midpoint,
  pixelRadiusFactor,
  raycastCenters,
  type MeasurePoint,
} from "./measure.ts"

const origin: MeasurePoint = { x: 0, y: 0, z: 0 }
const along: MeasurePoint = { x: 0, y: 0, z: -1 }

describe("distance", () => {
  it("treats one world unit as one metre, and the scale is a single constant", () => {
    assert.equal(SPLAT_METRES_PER_UNIT, 1)
    assert.equal(distanceMetres(origin, { x: 3, y: 4, z: 0 }), 5)
    assert.equal(distanceMetres(origin, { x: 3, y: 0, z: 0 }, 2), 6)
  })

  it("puts the label halfway between the points", () => {
    assert.deepEqual(midpoint({ x: 0, y: 0, z: -2 }, { x: 0, y: 2, z: -4 }), { x: 0, y: 1, z: -3 })
  })

  it("formats a spare-part length in metres", () => {
    assert.equal(formatMetres(0.025), "0.025 m")
    assert.equal(formatMetres(1.234), "1.23 m")
    assert.equal(formatMetres(12.36), "12.4 m")
    assert.equal(formatMetres(Number.NaN), "— m")
  })
})

describe("the two clicks", () => {
  const a: MeasurePoint = { x: 1, y: 0, z: 0 }
  const b: MeasurePoint = { x: 2, y: 0, z: 0 }
  const c: MeasurePoint = { x: 4, y: 0, z: 0 }

  it("keeps the first point, then the pair, then starts again", () => {
    const first = applyMeasureClick([], a)
    const pair = applyMeasureClick(first, b)
    assert.deepEqual(pair, [a, b])
    assert.deepEqual(applyMeasureClick(pair, c), [c])
  })

  it("tells the two clicks apart from a look-around drag", () => {
    assert.equal(isMeasureTap(3, 4), true)
    assert.equal(isMeasureTap(8, 0), true)
    assert.equal(isMeasureTap(9, 0), false)
  })

  it("reads the distance once both points exist, and a miss does not throw that away", () => {
    assert.match(measureStatus([], "none"), /Click two points/)
    assert.match(measureStatus([], "none"), /approximate/)
    assert.match(measureStatus([], "miss"), /No surface/)
    assert.match(measureStatus([], "loading"), /loading/)
    assert.match(measureStatus([a], "none"), /second point/)
    assert.match(measureStatus([a], "miss"), /second point/)
    const done = measureStatus([a, b], "none")
    assert.equal(done, "≈ 1.00 m · approximate")
    assert.equal(measureStatus([a, b], "miss"), done)
  })
})

describe("splat-centre fallback", () => {
  const cloud = new Float32Array([
    0, 0, -5,
    0, 0, -2,
    1, 0, -2,
  ])

  it("keeps the nearer centre inside the click and ignores one behind the camera", () => {
    const grid = buildCenterGrid(new Float32Array([...cloud, 0, 0, 2]))
    const hit = raycastCenters(grid, { origin, direction: along }, 0.05)
    assert.deepEqual(hit, { x: 0, y: 0, z: -2 })
    const off = buildCenterGrid(new Float32Array([1, 0, -2]))
    assert.equal(raycastCenters(off, { origin, direction: along }, 0.01), null)
    assert.equal(MAX_MEASURE_UNITS >= 21, true)
  })

  it("grows the acceptance with distance the way a pixel does", () => {
    const factor = pixelRadiusFactor(60, 800, 12)
    assert.ok(factor > 0.01 && factor < 0.03)
    const grid = buildCenterGrid(cloud)
    assert.deepEqual(raycastCenters(grid, { origin, direction: along }, factor)?.z, -2)
  })
})
