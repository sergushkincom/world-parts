/**
 * The path on the floor in Walk mode.
 *
 * A selected part points at the cabinet or machine that holds it. With no part, a framed
 * object is the place. The line sits on a flat floor a fixed drop below eye height: Walk
 * locks the eye, and the capture's floor is under that. One world unit is one metre, the
 * same scale Walk and Measure already use.
 *
 * The line draws itself with the same ease-out as the measure tape. Reduced motion is the
 * finished path, and the chevrons stay put.
 */
import type { RoomId, WorldObject } from "@/lib/data"
import { easeOut } from "@/lib/measure"
import { equipmentFor, getPart } from "@/lib/parts"
import { partPlace } from "@/lib/parts-list"

/** Metres from the walk eye down to the floor the path is painted on. */
export const GUIDE_EYE_TO_FLOOR = 1.5

/** The path starts this far ahead of the eye, so the near end is on the floor in front of you, not under the lens. */
export const GUIDE_LEAD_IN = 1

/** Stop this far short of the place, so the last mark sits at its base and not inside it. */
export const GUIDE_END_GAP = 0.4

/** Shorter than this, there is nothing to draw: you are already there. */
export const GUIDE_MIN_RUN = 0.35

/** Hide once you are this close, and don't bring the path back until you step out past the other. */
export const GUIDE_HIDE_WITHIN = 0.85
export const GUIDE_SHOW_BEYOND = 1.4

/** How long the draw takes, scaled by the length of the run and kept inside a short range. */
export const GUIDE_DRAW_MIN_MS = 420
export const GUIDE_DRAW_MAX_MS = 900
const GUIDE_MS_PER_METRE = 85

/** Chevrons along the line. The spacing is the march step too. */
export const GUIDE_CHEVRON_SPACING = 0.8
export const GUIDE_CHEVRON_LENGTH = 0.3
export const GUIDE_CHEVRON_HALF_WIDTH = 0.16

/** How fast the chevrons walk toward the place, once the line has finished drawing. */
export const GUIDE_MARCH_MPS = 0.65

/** Width of the painted line, in metres, so it tapers with perspective. About a floor marking. */
export const GUIDE_LINE_HALF_WIDTH = 0.032

/** The ring that lands on the place as the line arrives. */
export const GUIDE_RING_RADIUS = 0.32
export const GUIDE_DOT_RADIUS = 0.08

export type FloorPoint = { x: number; z: number }

export type GuideRun = {
  start: FloorPoint
  end: FloorPoint
  length: number
  place: FloorPoint
}

export type Chevron = { tip: FloorPoint; left: FloorPoint; right: FloorPoint }

/** Where the path ends, and the words a screen reader uses for it. */
export type GuideSpot = { key: string; name: string; x: number; z: number }

export function floorY(eyeY: number) {
  if (!Number.isFinite(eyeY)) return -GUIDE_EYE_TO_FLOOR
  return eyeY - GUIDE_EYE_TO_FLOOR
}

export function guideDuration(length: number) {
  if (!Number.isFinite(length) || length <= 0) return GUIDE_DRAW_MIN_MS
  return Math.min(GUIDE_DRAW_MAX_MS, Math.max(GUIDE_DRAW_MIN_MS, length * GUIDE_MS_PER_METRE))
}

/**
 * How far the line has drawn, from 0 when the place is chosen to 1 when it has arrived.
 * Reduced motion is already there.
 */
export function guideProgress(elapsedMs: number, reducedMotion: boolean, durationMs: number) {
  if (reducedMotion) return 1
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  if (elapsedMs >= durationMs) return 1
  return easeOut(elapsedMs / durationMs)
}

/** Metres the chevrons have walked since the line finished. Reduced motion does not walk them. */
export function marchShift(elapsedAfterDrawMs: number, reducedMotion: boolean, spacing = GUIDE_CHEVRON_SPACING) {
  if (reducedMotion || !(spacing > 0)) return 0
  if (!Number.isFinite(elapsedAfterDrawMs) || elapsedAfterDrawMs <= 0) return 0
  const travelled = (elapsedAfterDrawMs / 1000) * GUIDE_MARCH_MPS
  return travelled % spacing
}

export function lerpPoint(a: FloorPoint, b: FloorPoint, t: number): FloorPoint {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return { x: a.x + (b.x - a.x) * x, z: a.z + (b.z - a.z) * x }
}

/**
 * The run on the floor from just ahead of `from` to just short of `to`.
 * Null when the two are too close to be a path.
 */
export function guideRun(from: FloorPoint, to: FloorPoint): GuideRun | null {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const travel = Math.hypot(dx, dz)
  if (!(travel > 0)) return null
  const lead = Math.min(GUIDE_LEAD_IN, travel * 0.45)
  const gap = Math.min(GUIDE_END_GAP, travel * 0.35)
  const length = travel - lead - gap
  if (length < GUIDE_MIN_RUN) return null
  const dirX = dx / travel
  const dirZ = dz / travel
  return {
    start: { x: from.x + dirX * lead, z: from.z + dirZ * lead },
    end: { x: to.x - dirX * gap, z: to.z - dirZ * gap },
    length,
    place: { x: to.x, z: to.z },
  }
}

export function pointAlongRun(run: GuideRun, distance: number): FloorPoint {
  const t = run.length <= 0 ? 1 : distance <= 0 ? 0 : distance >= run.length ? 1 : distance / run.length
  return lerpPoint(run.start, run.end, t)
}

/**
 * Keep the part of a segment that is in front of the camera. A floor path often starts
 * below the screen, which is still in front; only the bit behind the eye is cut.
 */
export function clipSegment(
  a: FloorPoint,
  b: FloorPoint,
  inFront: (p: FloorPoint) => boolean,
): { start: FloorPoint; end: FloorPoint } | null {
  const aOk = inFront(a)
  const bOk = inFront(b)
  if (aOk && bOk) return { start: a, end: b }
  if (!aOk && !bOk) return null
  const behind = aOk ? b : a
  const ahead = aOk ? a : b
  let lo = 0
  let hi = 1
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2
    if (inFront(lerpPoint(behind, ahead, mid))) hi = mid
    else lo = mid
  }
  // A hair past the camera plane, so the near end does not project to infinity.
  const boundary = lerpPoint(behind, ahead, hi)
  const span = Math.hypot(ahead.x - behind.x, ahead.z - behind.z) || 1
  const remain = (1 - hi) * span
  const step = Math.min(0.12, remain * 0.5)
  const edge = {
    x: boundary.x + ((ahead.x - behind.x) / span) * step,
    z: boundary.z + ((ahead.z - behind.z) / span) * step,
  }
  if (!inFront(edge)) return null
  return aOk ? { start: a, end: edge } : { start: edge, end: b }
}

/** A quad on the floor. Wider than the amber line, it is the dark edge under it. */
export function floorRibbon(start: FloorPoint, end: FloorPoint, halfWidth: number): FloorPoint[] | null {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const len = Math.hypot(dx, dz)
  if (!(len > 0.02) || !(halfWidth > 0)) return null
  const px = (-dz / len) * halfWidth
  const pz = (dx / len) * halfWidth
  return [
    { x: start.x + px, z: start.z + pz },
    { x: end.x + px, z: end.z + pz },
    { x: end.x - px, z: end.z - pz },
    { x: start.x - px, z: start.z - pz },
  ]
}

/**
 * Chevrons whose tip is inside the revealed length. `shift` walks them toward the place;
 * wrapping it by one spacing brings a new one in at the start instead of jumping the rest.
 */
export function chevronsAlong(run: GuideRun, revealed: number, shift: number): Chevron[] {
  const reach = revealed < 0 ? 0 : revealed > run.length ? run.length : revealed
  if (!(run.length > 0) || reach < GUIDE_CHEVRON_LENGTH) return []
  const spacing = GUIDE_CHEVRON_SPACING
  const offset = ((shift % spacing) + spacing) % spacing
  const dx = (run.end.x - run.start.x) / run.length
  const dz = (run.end.z - run.start.z) / run.length
  const px = -dz
  const pz = dx
  const out: Chevron[] = []
  for (let d = spacing * 0.5 + offset; d <= reach - 0.02 && d <= run.length; d += spacing) {
    const back = d - GUIDE_CHEVRON_LENGTH
    if (back < 0) continue
    const tip = pointAlongRun(run, d)
    const wing = pointAlongRun(run, back)
    out.push({
      tip,
      left: { x: wing.x + px * GUIDE_CHEVRON_HALF_WIDTH, z: wing.z + pz * GUIDE_CHEVRON_HALF_WIDTH },
      right: { x: wing.x - px * GUIDE_CHEVRON_HALF_WIDTH, z: wing.z - pz * GUIDE_CHEVRON_HALF_WIDTH },
    })
  }
  return out
}

export function circlePoints(center: FloorPoint, radius: number, segments = 28): FloorPoint[] {
  if (!(radius > 0) || segments < 3) return []
  const pts: FloorPoint[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push({ x: center.x + Math.cos(a) * radius, z: center.z + Math.sin(a) * radius })
  }
  return pts
}

function spotAt(object: WorldObject, at: (id: string) => FloorPoint | null, key: string, name: string): GuideSpot | null {
  const point = at(object.id)
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return null
  return { key, name, x: point.x, z: point.z }
}

/**
 * Where the floor path ends.
 * A part in this room points at the cabinet or equipment that holds it, even when the camera
 * is still framed on the machine the part is fitted in. A part stored somewhere else falls
 * back to the framed object. With no part, the framed object is the place.
 */
export function guideSpot(args: {
  roomId: RoomId
  partNo: string | null
  framedId: string | null
  objects: readonly WorldObject[]
  at: (id: string) => FloorPoint | null
}): GuideSpot | null {
  const framed = args.framedId ? args.objects.find((o) => o.id === args.framedId) : undefined
  const framedSpot = framed ? spotAt(framed, args.at, `object:${framed.id}`, framed.name) : null

  const part = getPart(args.partNo)
  const place = part ? partPlace(part) : null
  if (part && place && place.room === args.roomId && place.assetId) {
    const holder = args.objects.find((o) => equipmentFor(o)?.assetId === place.assetId)
    const held = holder ? spotAt(holder, args.at, `part:${part.partNo}`, place.label) : null
    if (held) return held
  }
  return framedSpot
}
