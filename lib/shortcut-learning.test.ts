import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GESTURE_DRAG_PX,
  GESTURE_PAN_PX,
  GESTURE_PINCH_PX,
  HINT_GAP_MS,
  MAX_HINTS_PER_SESSION,
  applyGate,
  createGestureTracker,
  dismissHint,
  flushTeach,
  gestureUsed,
  initialTeachState,
  learnKey,
  learningProgress,
  msUntilTeach,
  parseRecord,
  pointerUsed,
  resetTips,
  setTipsOff,
  SHORTCUTS,
  toStored,
  trackGesture,
  type ShortcutId,
  type TeachState,
} from "./shortcut-learning.ts"

function fresh(patch: Partial<TeachState["gate"]> = {}): TeachState {
  const state = initialTeachState()
  return { ...state, gate: { ...state.gate, ...patch } }
}

describe("pointer hints", () => {
  it("names the key the first time a mouse action happens", () => {
    const state = pointerUsed(fresh(), "reset", 0)
    assert.equal(state.hint?.announcement, "Reset · R")
    assert.equal(state.hint?.kind, "introduce")
    assert.deepEqual(state.record.introduced, ["reset"])
  })

  it("does not stack a second hint on top of the first", () => {
    let state = pointerUsed(fresh(), "reset", 0)
    const shown = state.hint
    state = pointerUsed(state, "go", 0)
    assert.equal(state.hint, shown)
    assert.deepEqual(state.session.pending, { kind: "introduce", id: "go" })
  })

  it("nudges with Faster: R after the third repeat, once the gap has passed", () => {
    let state = pointerUsed(fresh(), "reset", 0)
    state = dismissHint(state)
    state = pointerUsed(state, "reset", 1_000)
    state = pointerUsed(state, "reset", 2_000)
    assert.equal(state.hint, null)
    assert.equal(flushTeach(state, HINT_GAP_MS - 1).hint, null)
    state = flushTeach(state, HINT_GAP_MS)
    assert.equal(state.hint?.announcement, "Faster: R")
    assert.equal(state.hint?.kind, "nudge")
    assert.deepEqual(state.record.nudged, ["reset"])
  })

  it("keeps the first lesson ahead of the nudge when three clicks arrive while paused", () => {
    let state = fresh({ paused: true })
    state = pointerUsed(state, "reset", 0)
    state = pointerUsed(state, "reset", 1)
    state = pointerUsed(state, "reset", 2)
    assert.equal(state.hint, null)
    assert.equal(state.session.pending?.kind, "introduce")
    state = flushTeach(applyGate(state, { paused: false }), 2)
    assert.equal(state.hint?.kind, "introduce")
    assert.equal(state.session.pending?.kind, "nudge")
    state = flushTeach(dismissHint(state), HINT_GAP_MS + 2)
    assert.equal(state.hint?.announcement, "Faster: R")
  })

  it("stops teaching a shortcut once the key is used", () => {
    let state = learnKey(pointerUsed(fresh(), "reset", 0), "reset")
    assert.equal(state.hint, null)
    assert.deepEqual(state.record.learned, ["reset"])
    state = pointerUsed(state, "reset", HINT_GAP_MS)
    state = pointerUsed(state, "reset", HINT_GAP_MS + 1)
    state = pointerUsed(state, "reset", HINT_GAP_MS + 2)
    assert.equal(state.hint, null)
    assert.equal(state.session.pending, null)
  })

  it("stays quiet while tips are off, while typing, and on a touch screen", () => {
    assert.equal(pointerUsed(setTipsOff(fresh(), true), "reset", 0).hint, null)
    assert.equal(pointerUsed(fresh({ typing: true }), "reset", 0).session.counts.reset, undefined)
    assert.equal(pointerUsed(fresh({ touch: true }), "reset", 0).hint, null)
  })

  it("hides a visible chip when typing starts", () => {
    const state = applyGate(pointerUsed(fresh(), "reset", 0), { typing: true })
    assert.equal(state.hint, null)
  })

  it("caps how many hints one visit can show", () => {
    const ids: ShortcutId[] = ["reset", "go", "escape", "search", "prev-next"]
    let state = fresh()
    ids.slice(0, MAX_HINTS_PER_SESSION).forEach((id, index) => {
      state = dismissHint(pointerUsed(state, id, index * HINT_GAP_MS))
    })
    assert.equal(state.session.shown, MAX_HINTS_PER_SESSION)
    state = pointerUsed(state, "prev-next", MAX_HINTS_PER_SESSION * HINT_GAP_MS)
    assert.equal(state.hint, null)
    assert.equal(state.session.shown, MAX_HINTS_PER_SESSION)
  })
})

describe("gestures", () => {
  it("shows drag, then pinch, one at a time", () => {
    let state = flushTeach(fresh({ touch: true, coachGestures: true }), 0)
    assert.equal(state.hint?.announcement, "Drag to look around")
    state = flushTeach(dismissHint(state), HINT_GAP_MS)
    assert.equal(state.hint?.announcement, "Pinch to zoom")
  })

  it("skips a gesture the fingers already did", () => {
    let state = gestureUsed(fresh({ touch: true, coachGestures: true }), "drag")
    state = flushTeach(state, 0)
    assert.equal(state.hint?.id, "pinch")
    state = gestureUsed(state, "pinch")
    assert.equal(state.hint, null)
  })

  it("does not coach gestures while the live view is off", () => {
    const state = flushTeach(fresh({ touch: true, coachGestures: false }), 0)
    assert.equal(state.hint, null)
  })
})

describe("progress and storage", () => {
  it("counts learned keys, and seen gestures on touch", () => {
    const state = learnKey(learnKey(fresh(), "reset"), "go")
    assert.deepEqual(learningProgress(state.record, false), { learned: 2, total: SHORTCUTS.length })
    const touch = gestureUsed(state, "drag")
    assert.deepEqual(learningProgress(touch.record, true), { learned: 1, total: 3 })
  })

  it("reads a versioned record and drops ids it does not know", () => {
    assert.equal(parseRecord(null), null)
    assert.equal(parseRecord([]), null)
    assert.equal(parseRecord({ v: 2, learned: ["reset"] }), null)
    const record = parseRecord({
      v: 1,
      learned: ["reset", "nope", "reset"],
      introduced: "nope",
      nudged: ["go"],
      gestures: ["drag", "fly"],
      tipsOff: true,
    })
    assert.deepEqual(record?.learned, ["reset"])
    assert.deepEqual(record?.introduced, [])
    assert.deepEqual(record?.nudged, ["go"])
    assert.deepEqual(record?.gesturesSeen, ["drag"])
    assert.equal(record?.tipsOff, true)
    assert.equal(record && toStored(record).v, 1)
  })

  it("reset clears lessons and leaves the mute toggle alone", () => {
    let state = setTipsOff(learnKey(pointerUsed(fresh(), "reset", 0), "search"), true)
    state = resetTips(state)
    assert.equal(state.record.tipsOff, true)
    assert.deepEqual(state.record.learned, [])
    assert.deepEqual(state.record.introduced, [])
    assert.equal(state.hint, null)
    assert.equal(state.session.shown, 0)
    assert.equal(state.session.pending, null)
  })

  it("waits out the gap before the next chip", () => {
    const state = dismissHint(pointerUsed(fresh(), "reset", 1_000))
    const queued = pointerUsed(state, "go", 1_500)
    assert.equal(msUntilTeach(queued, 1_500), HINT_GAP_MS - 500)
    assert.equal(flushTeach(queued, 1_500).hint, null)
  })
})

describe("touch gestures", () => {
  it("ignores a mouse and reports drag, pinch and pan once each", () => {
    const tracker = createGestureTracker()
    assert.equal(trackGesture(tracker, { phase: "move", pointerId: 1, pointerType: "mouse", x: 40, y: 0 }), null)

    trackGesture(tracker, { phase: "down", pointerId: 1, pointerType: "touch", x: 0, y: 0 })
    assert.equal(
      trackGesture(tracker, { phase: "move", pointerId: 1, pointerType: "touch", x: GESTURE_DRAG_PX - 1, y: 0 }),
      null,
    )
    assert.equal(
      trackGesture(tracker, { phase: "move", pointerId: 1, pointerType: "touch", x: GESTURE_DRAG_PX, y: 0 }),
      "drag",
    )
    assert.equal(
      trackGesture(tracker, { phase: "move", pointerId: 1, pointerType: "touch", x: GESTURE_DRAG_PX + 30, y: 0 }),
      null,
    )

    const pan = createGestureTracker()
    trackGesture(pan, { phase: "down", pointerId: 1, pointerType: "touch", x: 0, y: 0 })
    trackGesture(pan, { phase: "down", pointerId: 2, pointerType: "touch", x: 40, y: 0 })
    assert.equal(trackGesture(pan, { phase: "move", pointerId: 2, pointerType: "touch", x: 40, y: GESTURE_PAN_PX }), null)
    assert.equal(trackGesture(pan, { phase: "move", pointerId: 1, pointerType: "touch", x: 0, y: GESTURE_PAN_PX }), "pan")

    const pinch = createGestureTracker()
    trackGesture(pinch, { phase: "down", pointerId: 1, pointerType: "touch", x: 0, y: 0 })
    trackGesture(pinch, { phase: "down", pointerId: 2, pointerType: "touch", x: 40, y: 0 })
    assert.equal(
      trackGesture(pinch, { phase: "move", pointerId: 2, pointerType: "touch", x: 40 + GESTURE_PINCH_PX, y: 0 }),
      "pinch",
    )
  })
})
