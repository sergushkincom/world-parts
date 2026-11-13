/**
 * Progressive shortcut teaching, as pure state transitions.
 * A mouse action can earn one hint; a keypress marks that shortcut learned.
 * Touch never sees key hints: it gets each camera gesture once.
 * The hook owns time, storage and the DOM. This file owns the rules.
 */

export const HINT_GAP_MS = 30_000
export const HINT_HOLD_MS = 8_000
/** A visit teaches a few shortcuts, then stays quiet. */
export const MAX_HINTS_PER_SESSION = 4
export const NUDGE_AFTER = 3

export const GESTURE_DRAG_PX = 10
export const GESTURE_PINCH_PX = 18
export const GESTURE_PAN_PX = 16

export type ShortcutGroup = "Navigation" | "View" | "Objects"

export type ShortcutId =
  | "search"
  | "prev-next"
  | "extend"
  | "escape"
  | "reset"
  | "highlight"
  | "recolor"
  | "isolate"
  | "go"
  | "toggle"
  | "frame"
  | "rename"
  | "remove"

export type GestureId = "drag" | "pinch" | "pan"

export type ShortcutDef = {
  id: ShortcutId
  group: ShortcutGroup
  /** Row label in the ? list. */
  action: string
  /** Short name for the first hint chip. */
  hint: string
  keys: readonly string[]
}

export type GestureDef = {
  id: GestureId
  action: string
  how: string
  /** The chip, shown once. */
  hint: string
}

/**
 * Every key the room actually handles, in the order the ? list shows them.
 * Gaussian rows stay in step with `GAUSSIAN_VIEWS` (checked where the hook loads).
 */
export const SHORTCUTS: readonly ShortcutDef[] = [
  { id: "search", group: "Navigation", action: "Find a part", hint: "Find", keys: ["/"] },
  { id: "prev-next", group: "Navigation", action: "Previous / next object", hint: "Previous or next", keys: ["↑", "↓"] },
  { id: "extend", group: "Navigation", action: "Extend the selection", hint: "Extend", keys: ["Shift", "↑", "↓"] },
  { id: "escape", group: "Navigation", action: "Close card, clear selection, or plant", hint: "Close or back", keys: ["Esc"] },
  { id: "reset", group: "View", action: "Reset view", hint: "Reset", keys: ["R"] },
  { id: "highlight", group: "View", action: "Highlight", hint: "Highlight", keys: ["1"] },
  { id: "recolor", group: "View", action: "Recolor + dim rest", hint: "Recolor", keys: ["2"] },
  { id: "isolate", group: "View", action: "Isolate", hint: "Isolate", keys: ["3"] },
  { id: "go", group: "Objects", action: "Go to the open object, otherwise segment", hint: "Go to or segment", keys: ["G"] },
  { id: "toggle", group: "Objects", action: "Toggle selection", hint: "Toggle", keys: ["Space"] },
  { id: "frame", group: "Objects", action: "Frame the focused row", hint: "Frame", keys: ["F"] },
  { id: "rename", group: "Objects", action: "Rename the focused row", hint: "Rename", keys: ["F2"] },
  { id: "remove", group: "Objects", action: "Remove the focused row", hint: "Remove", keys: ["Del"] },
]

export const GESTURES: readonly GestureDef[] = [
  { id: "drag", action: "Rotate", how: "One finger", hint: "Drag to look around" },
  { id: "pinch", action: "Zoom", how: "Pinch", hint: "Pinch to zoom" },
  { id: "pan", action: "Pan", how: "Two fingers", hint: "Two fingers to pan" },
]

const SHORTCUT_IDS = new Set<string>(SHORTCUTS.map((s) => s.id))
const GESTURE_IDS = new Set<string>(GESTURES.map((g) => g.id))

export function isShortcutId(value: string): value is ShortcutId {
  return SHORTCUT_IDS.has(value)
}

export function isGestureId(value: string): value is GestureId {
  return GESTURE_IDS.has(value)
}

export function shortcutsIn(group: ShortcutGroup): readonly ShortcutDef[] {
  return SHORTCUTS.filter((s) => s.group === group)
}

const SHORTCUT_BY_ID: Record<ShortcutId, ShortcutDef> = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s])) as Record<
  ShortcutId,
  ShortcutDef
>
const GESTURE_BY_ID: Record<GestureId, GestureDef> = Object.fromEntries(GESTURES.map((g) => [g.id, g])) as Record<
  GestureId,
  GestureDef
>

export type LearningRecord = {
  learned: ShortcutId[]
  introduced: ShortcutId[]
  nudged: ShortcutId[]
  gesturesSeen: GestureId[]
  tipsOff: boolean
}

export type StoredLearning = {
  v: 1
  learned: ShortcutId[]
  introduced: ShortcutId[]
  nudged: ShortcutId[]
  gestures: GestureId[]
  tipsOff: boolean
}

export type HintKind = "introduce" | "nudge" | "gesture"

export type Hint = {
  kind: HintKind
  id: ShortcutId | GestureId
  lead: string
  keys: readonly string[]
  announcement: string
}

type Pending =
  | { kind: "introduce"; id: ShortcutId }
  | { kind: "nudge"; id: ShortcutId }
  | { kind: "gesture"; id: GestureId }

export type Session = {
  shown: number
  lastShownAt: number | null
  counts: Partial<Record<ShortcutId, number>>
  pending: Pending | null
}

export type TeachGate = {
  typing: boolean
  touch: boolean
  /** Orbit hint, the ? panel, or another chip already has the slot. */
  paused: boolean
  /** Live view is on, so camera gestures are worth teaching. */
  coachGestures: boolean
}

export type TeachState = {
  record: LearningRecord
  session: Session
  hint: Hint | null
  gate: TeachGate
}

export function emptyRecord(): LearningRecord {
  return { learned: [], introduced: [], nudged: [], gesturesSeen: [], tipsOff: false }
}

export function emptySession(): Session {
  return { shown: 0, lastShownAt: null, counts: {}, pending: null }
}

export function initialTeachState(): TeachState {
  return { record: emptyRecord(), session: emptySession(), hint: null, gate: { typing: false, touch: false, paused: false, coachGestures: false } }
}

export function toStored(record: LearningRecord): StoredLearning {
  return {
    v: 1,
    learned: record.learned,
    introduced: record.introduced,
    nudged: record.nudged,
    gestures: record.gesturesSeen,
    tipsOff: record.tipsOff,
  }
}

export function sameRecord(a: LearningRecord, b: LearningRecord): boolean {
  return JSON.stringify(toStored(a)) === JSON.stringify(toStored(b))
}

function filterIds<T extends string>(value: unknown, ok: (item: string) => item is T): T[] {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const item of value) {
    if (typeof item === "string" && ok(item) && !out.includes(item)) out.push(item)
  }
  return out
}

/** Accepts a versioned object and drops ids this build does not know. A bad version is empty. */
export function parseRecord(value: unknown): LearningRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.v !== 1) return null
  return {
    learned: filterIds(raw.learned, isShortcutId),
    introduced: filterIds(raw.introduced, isShortcutId),
    nudged: filterIds(raw.nudged, isShortcutId),
    gesturesSeen: filterIds(raw.gestures, isGestureId),
    tipsOff: raw.tipsOff === true,
  }
}

export function learningProgress(record: LearningRecord, touch: boolean): { learned: number; total: number } {
  if (touch) {
    return {
      learned: GESTURES.filter((g) => record.gesturesSeen.includes(g.id)).length,
      total: GESTURES.length,
    }
  }
  return {
    learned: SHORTCUTS.filter((s) => record.learned.includes(s.id)).length,
    total: SHORTCUTS.length,
  }
}

function desiredKind(record: LearningRecord, id: ShortcutId, count: number): "introduce" | "nudge" | null {
  if (record.learned.includes(id)) return null
  if (!record.introduced.includes(id)) return "introduce"
  if (count >= NUDGE_AFTER && !record.nudged.includes(id)) return "nudge"
  return null
}

function gapOpen(state: TeachState, now: number): boolean {
  if (state.session.lastShownAt == null) return true
  return now - state.session.lastShownAt >= HINT_GAP_MS
}

function blocked(state: TeachState): boolean {
  return state.record.tipsOff || state.gate.typing || state.gate.paused || state.hint != null || state.session.shown >= MAX_HINTS_PER_SESSION
}

function validPending(state: TeachState): Pending | null {
  const pending = state.session.pending
  if (!pending) return null
  if (pending.kind === "gesture") {
    if (!state.gate.touch || !state.gate.coachGestures) return null
    if (state.record.gesturesSeen.includes(pending.id)) return null
    return pending
  }
  if (state.gate.touch || state.record.learned.includes(pending.id)) return null
  if (pending.kind === "introduce") return state.record.introduced.includes(pending.id) ? null : pending
  if (!state.record.introduced.includes(pending.id) || state.record.nudged.includes(pending.id)) return null
  if ((state.session.counts[pending.id] ?? 0) < NUDGE_AFTER) return null
  return pending
}

function hintFor(pending: Pending): Hint | null {
  if (pending.kind === "gesture") {
    const gesture = GESTURE_BY_ID[pending.id]
    if (!gesture) return null
    return { kind: "gesture", id: gesture.id, lead: gesture.hint, keys: [], announcement: gesture.hint }
  }
  const shortcut = SHORTCUT_BY_ID[pending.id]
  if (!shortcut) return null
  const keys = shortcut.keys.join(" ")
  if (pending.kind === "nudge") {
    return { kind: "nudge", id: shortcut.id, lead: "Faster:", keys: shortcut.keys, announcement: `Faster: ${keys}` }
  }
  return {
    kind: "introduce",
    id: shortcut.id,
    lead: shortcut.hint,
    keys: shortcut.keys,
    announcement: `${shortcut.hint} · ${keys}`,
  }
}

function markShown(record: LearningRecord, pending: Pending): LearningRecord {
  if (pending.kind === "introduce") {
    if (record.introduced.includes(pending.id)) return record
    return { ...record, introduced: [...record.introduced, pending.id] }
  }
  if (pending.kind === "nudge") {
    if (record.nudged.includes(pending.id)) return record
    return { ...record, nudged: [...record.nudged, pending.id] }
  }
  if (record.gesturesSeen.includes(pending.id)) return record
  return { ...record, gesturesSeen: [...record.gesturesSeen, pending.id] }
}

function reveal(state: TeachState, pending: Pending, now: number): TeachState {
  const hint = hintFor(pending)
  if (!hint) return { ...state, session: { ...state.session, pending: null } }
  const record = markShown(state.record, pending)
  let nextPending: Pending | null = null
  if (pending.kind === "introduce") {
    const count = state.session.counts[pending.id] ?? 0
    if (count >= NUDGE_AFTER && !record.learned.includes(pending.id) && !record.nudged.includes(pending.id)) {
      nextPending = keyPending("nudge", pending.id)
    }
  }
  return {
    ...state,
    record,
    hint,
    session: { ...state.session, shown: state.session.shown + 1, lastShownAt: now, pending: nextPending },
  }
}

function dropInvalidPending(state: TeachState): TeachState {
  if (!state.session.pending || validPending(state)) return state
  return { ...state, session: { ...state.session, pending: null } }
}

function keyPending(kind: "introduce" | "nudge", id: ShortcutId): Pending {
  return kind === "introduce" ? { kind: "introduce", id } : { kind: "nudge", id }
}

/** First mouse use names the key. The third repeat, once the gap allows, says "Faster: R". */
export function pointerUsed(state: TeachState, id: ShortcutId, now: number): TeachState {
  if (state.record.tipsOff || state.gate.touch || state.gate.typing) return state
  if (!isShortcutId(id) || state.record.learned.includes(id)) return state

  const count = (state.session.counts[id] ?? 0) + 1
  const session: Session = { ...state.session, counts: { ...state.session.counts, [id]: count } }
  const next: TeachState = { ...state, session }
  const kind = desiredKind(next.record, id, count)
  if (!kind || session.shown >= MAX_HINTS_PER_SESSION) return next
  if (blocked(next) || !gapOpen(next, now)) {
    if (session.pending) return next
    return { ...next, session: { ...session, pending: keyPending(kind, id) } }
  }
  return reveal(next, keyPending(kind, id), now)
}

/** Using the key ends teaching for it, including a chip that is already up. */
export function learnKey(state: TeachState, id: ShortcutId): TeachState {
  if (!isShortcutId(id)) return state
  const already = state.record.learned.includes(id)
  const pending =
    state.session.pending && state.session.pending.kind !== "gesture" && state.session.pending.id === id
      ? null
      : state.session.pending
  const hint = state.hint && state.hint.kind !== "gesture" && state.hint.id === id ? null : state.hint
  if (already && pending === state.session.pending && hint === state.hint) return state
  return {
    ...state,
    record: already ? state.record : { ...state.record, learned: [...state.record.learned, id] },
    hint,
    session: pending === state.session.pending ? state.session : { ...state.session, pending },
  }
}

/** The gesture was performed, so it is not hinted again. A chip for that gesture goes away. */
export function gestureUsed(state: TeachState, id: GestureId): TeachState {
  if (!isGestureId(id)) return state
  const seen = state.record.gesturesSeen.includes(id)
  const pending = state.session.pending?.kind === "gesture" && state.session.pending.id === id ? null : state.session.pending
  const hint = state.hint?.kind === "gesture" && state.hint.id === id ? null : state.hint
  if (seen && pending === state.session.pending && hint === state.hint) return state
  return {
    ...state,
    record: seen ? state.record : { ...state.record, gesturesSeen: [...state.record.gesturesSeen, id] },
    hint,
    session: pending === state.session.pending ? state.session : { ...state.session, pending },
  }
}

export function dismissHint(state: TeachState): TeachState {
  if (!state.hint) return state
  return { ...state, hint: null }
}

export function setTipsOff(state: TeachState, off: boolean): TeachState {
  if (state.record.tipsOff === off) return state
  return {
    ...state,
    record: { ...state.record, tipsOff: off },
    hint: off ? null : state.hint,
    session: off ? { ...state.session, pending: null } : state.session,
  }
}

/** Clears what was taught and the visit's budget. The mute toggle stays as it is. */
export function resetTips(state: TeachState): TeachState {
  return {
    record: { ...emptyRecord(), tipsOff: state.record.tipsOff },
    session: emptySession(),
    hint: null,
    gate: state.gate,
  }
}

export function applyGate(state: TeachState, patch: Partial<TeachGate>): TeachState {
  const gate: TeachGate = { ...state.gate, ...patch }
  if (
    gate.typing === state.gate.typing &&
    gate.touch === state.gate.touch &&
    gate.paused === state.gate.paused &&
    gate.coachGestures === state.gate.coachGestures
  ) {
    return state
  }
  const hide =
    gate.typing ||
    gate.paused ||
    state.record.tipsOff ||
    (gate.touch && state.hint != null && state.hint.kind !== "gesture") ||
    (!gate.touch && state.hint?.kind === "gesture")
  return dropInvalidPending({ ...state, gate, hint: hide ? null : state.hint })
}

/** Shows the one waiting hint once the gap, the slot and the mute rules allow it. */
export function flushTeach(state: TeachState, now: number): TeachState {
  state = dropInvalidPending(state)
  if (state.record.tipsOff || state.gate.typing || state.gate.paused || state.hint) return state
  if (state.session.shown >= MAX_HINTS_PER_SESSION || !gapOpen(state, now)) return state
  const pending = validPending(state)
  if (pending) return reveal(state, pending, now)
  if (state.gate.touch && state.gate.coachGestures) {
    const gesture = GESTURES.find((g) => !state.record.gesturesSeen.includes(g.id))
    if (gesture) return reveal(state, { kind: "gesture", id: gesture.id }, now)
  }
  return state
}

/** Milliseconds until `flushTeach` could show something, or null when nothing is waiting. */
export function msUntilTeach(state: TeachState, now: number): number | null {
  if (state.record.tipsOff || state.gate.typing || state.gate.paused || state.hint) return null
  if (state.session.shown >= MAX_HINTS_PER_SESSION) return null
  if (state.session.pending && !validPending(state)) return 0
  const pending = validPending(state)
  const gestureWaiting =
    state.gate.touch && state.gate.coachGestures && GESTURES.some((g) => !state.record.gesturesSeen.includes(g.id))
  if (!pending && !gestureWaiting) return null
  if (state.session.lastShownAt == null) return 0
  return Math.max(0, HINT_GAP_MS - (now - state.session.lastShownAt))
}

export type GesturePhase = "down" | "move" | "up"

export type GestureSample = {
  phase: GesturePhase
  pointerId: number
  pointerType: string
  x: number
  y: number
}

type Point = { x: number; y: number }

export type GestureTracker = {
  points: Map<number, Point>
  dragOrigin: Point | null
  pairDist: number | null
  pairMid: Point | null
  notedDrag: boolean
  notedPinch: boolean
  notedPan: boolean
}

export function createGestureTracker(): GestureTracker {
  return {
    points: new Map(),
    dragOrigin: null,
    pairDist: null,
    pairMid: null,
    notedDrag: false,
    notedPinch: false,
    notedPan: false,
  }
}

function span(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function touchLike(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen"
}

/**
 * Watches one touch stream and reports drag, pinch or pan the first time each happens.
 * The tracker is mutated; a mouse pointer is ignored.
 */
export function trackGesture(tracker: GestureTracker, sample: GestureSample): GestureId | null {
  if (!touchLike(sample.pointerType)) return null
  if (sample.phase === "down") {
    tracker.points.set(sample.pointerId, { x: sample.x, y: sample.y })
    if (tracker.points.size === 1) tracker.dragOrigin = { x: sample.x, y: sample.y }
    if (tracker.points.size === 2) {
      const [a, b] = [...tracker.points.values()]
      tracker.pairDist = span(a, b)
      tracker.pairMid = midpoint(a, b)
    }
    return null
  }
  if (sample.phase === "up") {
    tracker.points.delete(sample.pointerId)
    if (tracker.points.size < 2) {
      tracker.pairDist = null
      tracker.pairMid = null
    }
    if (tracker.points.size === 1) {
      const only = [...tracker.points.values()][0]
      tracker.dragOrigin = { x: only.x, y: only.y }
    } else if (tracker.points.size === 0) {
      tracker.dragOrigin = null
    }
    return null
  }
  if (!tracker.points.has(sample.pointerId)) return null
  tracker.points.set(sample.pointerId, { x: sample.x, y: sample.y })
  if (tracker.points.size === 1 && !tracker.notedDrag && tracker.dragOrigin) {
    if (span(tracker.dragOrigin, { x: sample.x, y: sample.y }) >= GESTURE_DRAG_PX) {
      tracker.notedDrag = true
      return "drag"
    }
    return null
  }
  if (tracker.points.size === 2 && tracker.pairDist != null && tracker.pairMid) {
    const [a, b] = [...tracker.points.values()]
    const distance = span(a, b)
    const mid = midpoint(a, b)
    if (!tracker.notedPinch && Math.abs(distance - tracker.pairDist) >= GESTURE_PINCH_PX) {
      tracker.notedPinch = true
      return "pinch"
    }
    if (!tracker.notedPan && span(mid, tracker.pairMid) >= GESTURE_PAN_PX && Math.abs(distance - tracker.pairDist) < GESTURE_PINCH_PX) {
      tracker.notedPan = true
      return "pan"
    }
  }
  return null
}
