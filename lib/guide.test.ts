import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SEED_OBJECTS, WORLDS } from "./data.ts"
import {
  GUIDE_DRAW_MAX_MS,
  GUIDE_DRAW_MIN_MS,
  GUIDE_EYE_TO_FLOOR,
  GUIDE_HIDE_WITHIN,
  GUIDE_MARCH_MPS,
  GUIDE_SHOW_BEYOND,
  chevronsAlong,
  circlePoints,
  clipSegment,
  floorRibbon,
  floorY,
  guideDuration,
  guideProgress,
  guideRun,
  guideSpot,
  lerpPoint,
  marchShift,
  pointAlongRun,
  type FloorPoint,
} from "./guide.ts"

const door: FloorPoint = { x: 0, z: 0 }
const cabinet: FloorPoint = { x: 0, z: -10 }

function near(a: number, b: number, eps = 1e-6) {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)
}

describe("floor height", () => {
  it("drops a fixed distance below the walk eye", () => {
    assert.equal(floorY(0), -GUIDE_EYE_TO_FLOOR)
    assert.equal(floorY(0.2), 0.2 - GUIDE_EYE_TO_FLOOR)
    assert.ok(GUIDE_EYE_TO_FLOOR > 1)
    assert.equal(floorY(Number.NaN), -GUIDE_EYE_TO_FLOOR)
  })
})

describe("the run from the viewer to the place", () => {
  it("starts ahead of the eye and stops short of the place", () => {
    const run = guideRun(door, cabinet)
    assert.ok(run)
    assert.ok(run.start.z < door.z)
    assert.ok(run.end.z > cabinet.z)
    near(run.start.x, 0)
    near(run.length, Math.abs(run.end.z - run.start.z))
    assert.deepEqual(run.place, cabinet)
  })

  it("is nothing when you are already standing there", () => {
    assert.equal(guideRun(door, { x: 0.2, z: -0.2 }), null)
    assert.equal(guideRun(door, door), null)
  })

  it("grows from the start and does not pass the end", () => {
    const run = guideRun(door, cabinet)!
    assert.deepEqual(pointAlongRun(run, 0), run.start)
    assert.deepEqual(pointAlongRun(run, run.length), run.end)
    const mid = pointAlongRun(run, run.length / 2)
    near(mid.z, (run.start.z + run.end.z) / 2)
    assert.deepEqual(pointAlongRun(run, run.length + 4), run.end)
  })
})

describe("drawing the path in", () => {
  it("eases out, and reduced motion is already finished", () => {
    assert.ok(GUIDE_DRAW_MIN_MS >= 400 && GUIDE_DRAW_MAX_MS <= 1000)
    assert.equal(guideDuration(1), GUIDE_DRAW_MIN_MS)
    assert.equal(guideDuration(20), GUIDE_DRAW_MAX_MS)
    const duration = guideDuration(6)
    assert.ok(duration > GUIDE_DRAW_MIN_MS && duration < GUIDE_DRAW_MAX_MS)
    assert.equal(guideProgress(0, false, duration), 0)
    assert.ok(guideProgress(duration / 2, false, duration) > 0.5)
    assert.equal(guideProgress(duration, false, duration), 1)
    assert.equal(guideProgress(0, true, duration), 1)
    assert.equal(guideProgress(duration / 2, true, duration), 1)
  })

  it("walks the chevrons only after the line has arrived", () => {
    assert.equal(marchShift(0, false), 0)
    assert.equal(marchShift(1000, true), 0)
    near(marchShift(1000, false), GUIDE_MARCH_MPS)
    assert.ok(marchShift(10_000, false) < 0.8)
  })
})

describe("chevrons and the line", () => {
  const run = guideRun(door, cabinet)!

  it("points the tip toward the place and keeps it inside the revealed length", () => {
    const marks = chevronsAlong(run, run.length * 0.5, 0)
    assert.ok(marks.length >= 2)
    for (const mark of marks) {
      const tip = Math.hypot(mark.tip.x - run.start.x, mark.tip.z - run.start.z)
      const wing = Math.hypot(mark.left.x - run.start.x, mark.left.z - run.start.z)
      assert.ok(tip > wing)
      assert.ok(tip <= run.length * 0.5 + 1e-6)
      near(mark.tip.x, 0)
      assert.ok(Math.abs(mark.left.x) > 0)
      assert.ok(mark.left.x * mark.right.x < 0)
    }
  })

  it("shifts the chevrons forward, and a full step replaces one instead of jumping them", () => {
    const before = chevronsAlong(run, run.length, 0)
    const nudged = chevronsAlong(run, run.length, 0.2)
    assert.ok(before.length >= 2)
    assert.ok(nudged[0].tip.z < before[0].tip.z)
    const wrapped = chevronsAlong(run, run.length, 0.8)
    near(wrapped[0].tip.z, before[0].tip.z, 1e-6)
    assert.equal(wrapped.length, before.length)
  })

  it("draws no chevron until the line is long enough to hold one", () => {
    assert.deepEqual(chevronsAlong(run, 0.1, 0), [])
  })

  it("paints a quad that does not cross itself", () => {
    const quad = floorRibbon(run.start, run.end, 0.05)
    assert.ok(quad)
    assert.equal(quad.length, 4)
    assert.ok(quad[0].x > 0 && quad[3].x < 0)
    assert.ok(quad[1].x > 0 && quad[2].x < 0)
    assert.equal(floorRibbon(run.start, run.start, 0.05), null)
  })

  it("clips away only the part behind the eye", () => {
    const inFront = (p: FloorPoint) => p.z < 0
    const clipped = clipSegment({ x: 0, z: 1 }, { x: 0, z: -4 }, inFront)
    assert.ok(clipped)
    assert.ok(clipped.start.z < 0)
    assert.ok(clipped.start.z > -0.5)
    near(clipped.end.z, -4)
    assert.deepEqual(clipSegment({ x: 0, z: -1 }, { x: 0, z: -4 }, inFront), {
      start: { x: 0, z: -1 },
      end: { x: 0, z: -4 },
    })
    assert.equal(clipSegment({ x: 0, z: 1 }, { x: 0, z: 2 }, inFront), null)
  })

  it("closes the landing ring", () => {
    const ring = circlePoints({ x: 1, z: -2 }, 0.3, 8)
    assert.equal(ring.length, 9)
    near(ring[0].x, ring[8].x)
    near(ring[0].z, ring[8].z)
    assert.deepEqual(circlePoints({ x: 0, z: 0 }, 0), [])
  })
})

describe("which place the path goes to", () => {
  const workshop = SEED_OBJECTS.filter((o) => (o.room ?? "workshop") === "workshop")
  const poses = WORLDS.workshop!.poses
  const at = (id: string) => {
    const target = poses[id]?.target
    return target ? { x: target[0], z: target[2] } : null
  }
  const cabinetPose = poses["obj-cabinet"].target
  const pumpPose = poses["obj-pump"].target

  it("takes a stored part to its cabinet, not to the machine it is fitted in", () => {
    const spot = guideSpot({
      roomId: "workshop",
      partNo: "VBL-A42",
      framedId: "obj-motor",
      objects: workshop,
      at,
    })
    assert.equal(spot?.key, "part:VBL-A42")
    assert.equal(spot?.name, "cabinet C1")
    near(spot!.x, cabinetPose[0])
    near(spot!.z, cabinetPose[2])
  })

  it("uses the framed object when the part is stored in another room", () => {
    const spot = guideSpot({
      roomId: "workshop",
      partNo: "BRG-6305",
      framedId: "obj-pump",
      objects: workshop,
      at,
    })
    assert.equal(spot?.key, "object:obj-pump")
    assert.equal(spot?.name, "pump")
    near(spot!.x, pumpPose[0])
    near(spot!.z, pumpPose[2])
  })

  it("follows a framed object when no part is selected, and clears with nothing selected", () => {
    const framed = guideSpot({
      roomId: "workshop",
      partNo: null,
      framedId: "obj-cabinet",
      objects: workshop,
      at,
    })
    assert.equal(framed?.key, "object:obj-cabinet")
    assert.equal(
      guideSpot({ roomId: "workshop", partNo: null, framedId: null, objects: workshop, at }),
      null,
    )
  })

  it("hides up close and comes back only after a step away", () => {
    assert.ok(GUIDE_HIDE_WITHIN < GUIDE_SHOW_BEYOND)
    assert.equal(guideRun(door, { x: 0, z: -GUIDE_HIDE_WITHIN }), null)
    assert.ok(guideRun(door, { x: 0, z: -GUIDE_SHOW_BEYOND }))
  })
})

describe("lerp", () => {
  it("clamps to the segment", () => {
    assert.deepEqual(lerpPoint({ x: 0, z: 0 }, { x: 0, z: -4 }, -1), { x: 0, z: 0 })
    assert.deepEqual(lerpPoint({ x: 0, z: 0 }, { x: 0, z: -4 }, 2), { x: 0, z: -4 })
  })
})
