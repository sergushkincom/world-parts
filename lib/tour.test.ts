import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  TOUR_HINT,
  TOUR_TIMING,
  WORKSHOP_TOUR_ORDER,
  createTour,
  pauseTour,
  startTour,
  stopTour,
  tickTour,
  tourAllowed,
  tourCommand,
  tourStops,
  type TourGate,
  type TourState,
  type TourTiming,
} from "./tour.ts"

const open: TourGate = {
  ready: true,
  framedId: null,
  cardId: null,
  reducedMotion: false,
  present: false,
  walking: false,
  measuring: false,
}

const FAST: TourTiming = { leadInMs: 10, flyMs: 10, holdMs: 10 }

function run(stops: readonly string[], timing: TourTiming = TOUR_TIMING): TourState[] {
  const seen: TourState[] = []
  let state = startTour(createTour(), stops)
  seen.push(state)
  for (let i = 0; i < 20 && state.phase !== "off"; i++) {
    const wait =
      state.phase === "lead-in" ? timing.leadInMs : state.phase === "hold" ? timing.holdMs : timing.flyMs
    const next = tickTour(state, wait, timing)
    assert.notEqual(next.phase, state.phase)
    assert.equal(tourCommand(state, next) === "none" || next.phase === "fly" || next.phase === "return", true)
    seen.push(next)
    state = next
    if (seen.length > 4 && next.phase === "lead-in") break
  }
  return seen
}

describe("tour stops", () => {
  it("walks the workshop in the hand-measured order and skips what is missing", () => {
    assert.deepEqual(
      tourStops("workshop", ["obj-cabinet", "obj-hose", "obj-unknown", "obj-pump", "obj-pallet"]),
      ["obj-hose", "obj-pallet", "obj-pump", "obj-cabinet"],
    )
    assert.deepEqual([...WORKSHOP_TOUR_ORDER], [
      "obj-hose",
      "obj-pallet",
      "obj-pump",
      "obj-motor",
      "obj-valve",
      "obj-extinguisher",
      "obj-cabinet",
    ])
  })

  it("keeps another room's own order and skips a room with nothing to show", () => {
    assert.deepEqual(tourStops("storeroom", ["obj-rack-r3", "obj-rack-r1"]), ["obj-rack-r3", "obj-rack-r1"])
    assert.deepEqual(tourStops("corridor", []), [])
    assert.deepEqual(tourStops("workshop", []), [])
  })
})

describe("when the tour may start", () => {
  it("waits until Live 3D is ready and nothing is framed or open", () => {
    assert.equal(tourAllowed(open), true)
    assert.equal(tourAllowed({ ...open, ready: false }), false)
    assert.equal(tourAllowed({ ...open, framedId: "obj-pump" }), false)
    assert.equal(tourAllowed({ ...open, cardId: "obj-pump" }), false)
  })

  it("stays quiet for reduced motion unless a recording forces it", () => {
    assert.equal(tourAllowed({ ...open, reducedMotion: true }), false)
    assert.equal(tourAllowed({ ...open, reducedMotion: true, present: true }), true)
    assert.equal(tourAllowed({ ...open, reducedMotion: true, present: true, framedId: "obj-hose" }), false)
  })

  it("stays off for the whole time the camera is walking, even when a recording forces it", () => {
    assert.equal(tourAllowed({ ...open, walking: true }), false)
    assert.equal(tourAllowed({ ...open, walking: true, present: true }), false)
  })

  it("stays off while a measurement owns the click, even when a recording forces it", () => {
    assert.equal(tourAllowed({ ...open, measuring: true }), false)
    assert.equal(tourAllowed({ ...open, measuring: true, present: true }), false)
  })
})

describe("the visit", () => {
  it("leads in, flies, holds with a highlight, then the next object", () => {
    let state = startTour(createTour(), ["obj-hose", "obj-pallet"])
    assert.equal(state.phase, "lead-in")
    assert.equal(state.highlight, false)
    assert.equal(state.objectId, null)

    state = tickTour(state, TOUR_TIMING.leadInMs - 1)
    assert.equal(state.phase, "lead-in")
    state = tickTour(state, 1)
    assert.equal(state.phase, "fly")
    assert.equal(state.objectId, "obj-hose")
    assert.equal(state.highlight, false)
    assert.equal(tourCommand(startTour(createTour(), ["obj-hose"]), state), "fly")

    const flying = state
    state = tickTour(state, TOUR_TIMING.flyMs - 1)
    assert.equal(state.phase, "fly")
    state = tickTour(state, 1)
    assert.equal(state.phase, "hold")
    assert.equal(state.objectId, "obj-hose")
    assert.equal(state.highlight, true)
    assert.equal(tourCommand(flying, state), "none")

    state = tickTour(state, TOUR_TIMING.holdMs)
    assert.equal(state.phase, "fly")
    assert.equal(state.objectId, "obj-pallet")
    assert.equal(state.highlight, false)
  })

  it("pulls back home after the last object and loops", () => {
    const seen = run(["obj-hose", "obj-pallet"], FAST)
    const phases = seen.map((s) => s.phase)
    assert.deepEqual(phases, ["lead-in", "fly", "hold", "fly", "hold", "return", "lead-in"])
    assert.deepEqual(
      seen.map((s) => s.objectId),
      [null, "obj-hose", "obj-hose", "obj-pallet", "obj-pallet", null, null],
    )
    assert.deepEqual(
      seen.map((s) => tourCommand(seen[0]!, s)),
      ["none", "fly", "none", "fly", "none", "home", "none"],
    )

    const again = tickTour(seen.at(-1)!, FAST.leadInMs, FAST)
    assert.equal(again.phase, "fly")
    assert.equal(again.objectId, "obj-hose")
    assert.equal(tourCommand(seen.at(-1)!, again), "fly")
  })

  it("uses one object the same way: hold, home, loop", () => {
    const phases = run(["obj-cabinet"], FAST).map((s) => `${s.phase}:${s.objectId ?? "-"}`)
    assert.deepEqual(phases, ["lead-in:-", "fly:obj-cabinet", "hold:obj-cabinet", "return:-", "lead-in:-"])
  })

  it("crosses only one boundary per tick, and ignores a clock that does not move", () => {
    const started = startTour(createTour(), ["obj-hose"])
    const jumped = tickTour(started, TOUR_TIMING.leadInMs + TOUR_TIMING.flyMs + TOUR_TIMING.holdMs)
    assert.equal(jumped.phase, "fly")
    assert.equal(jumped.elapsed, 0)
    assert.equal(tickTour(started, 0), started)
    assert.equal(tickTour(started, -5), started)
    assert.equal(tickTour(createTour(), 1_000), createTour())
  })

  it("keeps the requested timings tweakable", () => {
    assert.equal(TOUR_TIMING.leadInMs, 1_400)
    assert.ok(TOUR_TIMING.holdMs >= 1_500 && TOUR_TIMING.holdMs <= 2_000)
    // CameraControls' default focusDamping is 0.98: the fraction left after t ms is 0.98^t.
    assert.ok(0.98 ** TOUR_TIMING.flyMs < 0.01)
    const state = tickTour(startTour(createTour(), ["obj-hose"]), 5, FAST)
    assert.equal(state.phase, "lead-in")
    assert.equal(tickTour(state, 5, FAST).phase, "fly")
  })

  it("does not start from an empty room", () => {
    assert.equal(startTour(createTour(), []), createTour())
  })
})

describe("stopping", () => {
  it("ends on demand and does not start again", () => {
    const running = tickTour(startTour(createTour(), ["obj-hose", "obj-pallet"]), TOUR_TIMING.leadInMs)
    const stopped = stopTour(running)
    assert.equal(stopped.phase, "off")
    assert.equal(stopped.highlight, false)
    assert.equal(stopped.objectId, null)
    assert.equal(stopped.dismissed, true)
    assert.equal(startTour(stopped, ["obj-hose"]).phase, "off")
    assert.equal(stopTour(stopped), stopped)
  })

  it("treats a stop before the first frame as final", () => {
    const stopped = stopTour(createTour())
    assert.equal(stopped.dismissed, true)
    assert.equal(startTour(stopped, ["obj-hose"]), stopped)
  })

  it("pauses when a Find takes the camera, and can resume if the viewer never dismissed it", () => {
    const running = startTour(createTour(), ["obj-hose"])
    const paused = pauseTour(running)
    assert.equal(paused.phase, "off")
    assert.equal(paused.dismissed, false)
    assert.equal(startTour(paused, ["obj-hose"]).phase, "lead-in")
    assert.equal(pauseTour(paused), paused)
  })
})

describe("hint", () => {
  it("tells the viewer they can take over", () => {
    assert.equal(TOUR_HINT, "Watch, or drag to look around.")
  })
})
