/**
 * Idle object tour: visit each object, hold, pull back home, repeat.
 *
 * The idea — an attract mode that runs until someone touches the page, with a
 * recording override — comes from willeastcott/splat-fashion `src/director.js` (MIT).
 * This file does not follow that camera path. It only decides which object is
 * showing and when. The live view plays each step with the existing `flyTo` ease.
 *
 * One `tickTour` crosses at most one phase boundary, so a slow frame cannot skip a hold.
 */

/** Workshop visit order. Objects that are not drawable, or have no anchor, are left out. */
export const WORKSHOP_TOUR_ORDER = [
  "obj-hose",
  "obj-pallet",
  "obj-pump",
  "obj-motor",
  "obj-valve",
  "obj-extinguisher",
  "obj-cabinet",
] as const

export const TOUR_TIMING = {
  /** Whole room, before the first object. */
  leadInMs: 1_400,
  /**
   * How long to wait after `flyTo` / the pull-back home before the next phase.
   * The move itself is CameraControls' focus ease (default damping 0.98), which has
   * less than 1% of the flight left by this point.
   */
  flyMs: 400,
  /** Tint and label pulse once the camera has arrived. */
  holdMs: 1_700,
} as const

export type TourTiming = { leadInMs: number; flyMs: number; holdMs: number }

/** Shown while the tour is running. The first drag, scroll, key or label click ends it. */
export const TOUR_HINT = "Watch, or drag to look around."

export type TourPhase = "off" | "lead-in" | "fly" | "hold" | "return"

export type TourState = {
  phase: TourPhase
  /** A pointer, wheel or key already took the camera. The tour does not start again. */
  dismissed: boolean
  stops: readonly string[]
  index: number
  /** Milliseconds spent in the current phase. */
  elapsed: number
  /** Object the camera is flying to or holding. Null while the room is shown whole. */
  objectId: string | null
  /** Tint and label pulse. True only during the hold, never during the flight. */
  highlight: boolean
}

export type TourGate = {
  ready: boolean
  framedId: string | null
  cardId: string | null
  reducedMotion: boolean
  /** `?present=1`, for recording. Runs even when the viewer prefers reduced motion. */
  present: boolean
}

const IDLE: TourState = {
  phase: "off",
  dismissed: false,
  stops: [],
  index: 0,
  elapsed: 0,
  objectId: null,
  highlight: false,
}

export function createTour(): TourState {
  return IDLE
}

/**
 * Workshop uses the fixed order. Every other room keeps the order it was given
 * (the drawable objects that have an anchor). An empty list means no tour.
 */
export function tourStops(roomId: string, candidates: readonly string[]): string[] {
  if (roomId !== "workshop") return [...candidates]
  const have = new Set(candidates)
  return WORKSHOP_TOUR_ORDER.filter((id) => have.has(id))
}

/** Ready, nothing framed or open, and motion is allowed — or a recording forces it. */
export function tourAllowed(gate: TourGate): boolean {
  if (!gate.ready || gate.framedId || gate.cardId) return false
  if (gate.reducedMotion && !gate.present) return false
  return true
}

export function startTour(state: TourState, stops: readonly string[]): TourState {
  if (state.phase !== "off" || state.dismissed || stops.length === 0) return state
  return { ...IDLE, phase: "lead-in", stops: [...stops] }
}

/** Viewer took over. Stays off, including a stop that arrives before the first frame. */
export function stopTour(state: TourState): TourState {
  if (state.phase === "off" && state.dismissed) return state
  return { ...IDLE, dismissed: true }
}

/** Gates closed (a Find, or reduced motion) without the viewer dismissing it. */
export function pauseTour(state: TourState): TourState {
  if (state.phase === "off") return state
  return { ...IDLE, dismissed: state.dismissed }
}

function enterFly(state: TourState, index: number): TourState {
  const objectId = state.stops[index]
  if (!objectId) {
    return { ...state, phase: "return", index, elapsed: 0, objectId: null, highlight: false }
  }
  return { ...state, phase: "fly", index, elapsed: 0, objectId, highlight: false }
}

export function tickTour(state: TourState, dtMs: number, timing: TourTiming = TOUR_TIMING): TourState {
  if (state.phase === "off" || !(dtMs > 0)) return state
  if (state.stops.length === 0) return pauseTour(state)
  const elapsed = state.elapsed + dtMs
  switch (state.phase) {
    case "lead-in":
      if (elapsed < timing.leadInMs) return { ...state, elapsed }
      return enterFly(state, 0)
    case "fly":
      if (elapsed < timing.flyMs) return { ...state, elapsed }
      return { ...state, phase: "hold", elapsed: 0, highlight: true }
    case "hold":
      if (elapsed < timing.holdMs) return { ...state, elapsed }
      return enterFly(state, state.index + 1)
    case "return":
      if (elapsed < timing.flyMs) return { ...state, elapsed }
      return { ...state, phase: "lead-in", index: 0, elapsed: 0, objectId: null, highlight: false }
    default:
      return state
  }
}

/** What the camera should do when the phase changes. The ease belongs to `flyTo`. */
export function tourCommand(prev: TourState, next: TourState): "fly" | "home" | "none" {
  if (next.phase === "fly" && (prev.phase !== "fly" || prev.objectId !== next.objectId)) return "fly"
  if (next.phase === "return" && prev.phase !== "return") return "home"
  return "none"
}
