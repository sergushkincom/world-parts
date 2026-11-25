/**
 * The drawing shown while a Live 3D scan loads.
 *
 * It is the room's own box: the calibrated walls, the walk floor, and a ceiling
 * high enough to read as a room. The camera sits just outside the door and backs
 * up until the whole box fits the page, so a wide hall on a phone is still a room
 * and not two clipped lines. Nothing is loaded for this — no mesh, no second world.
 * A section through the scan is a different idea and is not this.
 *
 * The walls draw in with the download. The floor grid is the paper, already there.
 * Reduced motion shows the finished drawing and lets the scan fade over it.
 */
import type { CameraPose } from "@/lib/data"
import { floorY } from "@/lib/guide"
import { LIVE_FOV_Y } from "@/lib/live-camera"

export { LIVE_FOV_Y }

/** Metres of ceiling above the eye. The floor comes from the walk path; the ceiling is only the drawing. */
export const OUTLINE_CEILING_ABOVE_EYE = 1.35

/** Floor grid spacing, in metres. Sparse on purpose so a phone is not filling in a dense mesh. */
export const OUTLINE_GRID_STEP = 2

/** How long the scan fades in over the drawing. The `.splat-reveal` class uses the same times. */
export const OUTLINE_REVEAL_MS = 700
export const OUTLINE_REVEAL_REDUCED_MS = 200

/** Keep the drawing up until the fade has finished. */
export const OUTLINE_REVEAL_HOLD_MS = 80

/** Shown before the file reports a fraction, so the first stroke is already on the page. */
export const OUTLINE_UNKNOWN_DRAW = 0.04

/** Clip lines this far in front of the lens. Closer than this, a corner would shoot off the page. */
const NEAR = 0.25

export type OutlinePoint = { x: number; y: number; z: number }

export type OutlineSegment = {
  a: OutlinePoint
  b: OutlinePoint
  /** Walls follow the download. The grid is the sheet under them. */
  kind: "shell" | "grid"
}

export type ScreenSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  length: number
  kind: "shell" | "grid"
}

export type DrawnSegment = ScreenSegment & { shown: number }

type Vec = { x: number; y: number; z: number }

type Basis = {
  eye: Vec
  forward: Vec
  right: Vec
  up: Vec
}

const edge = (a: OutlinePoint, b: OutlinePoint, kind: OutlineSegment["kind"]): OutlineSegment => ({ a, b, kind })

function boxOf(corners: readonly [readonly [number, number], readonly [number, number]]) {
  const [a, b] = corners
  return {
    minX: Math.min(a[0], b[0]),
    maxX: Math.max(a[0], b[0]),
    minZ: Math.min(a[1], b[1]),
    maxZ: Math.max(a[1], b[1]),
  }
}

/**
 * The closed box, then a sparse floor grid. Draw order is the pen: the floor
 * loop, the corners rising, then the ceiling.
 */
export function roomOutline(
  corners: readonly [readonly [number, number], readonly [number, number]],
  eyeY: number,
): OutlineSegment[] {
  if (!Number.isFinite(eyeY)) return []
  const { minX, maxX, minZ, maxZ } = boxOf(corners)
  if (!(maxX - minX > 0.2) || !(maxZ - minZ > 0.2)) return []
  const floor = floorY(eyeY)
  const ceiling = eyeY + OUTLINE_CEILING_ABOVE_EYE
  const shell: OutlineSegment[] = [
    edge({ x: minX, y: floor, z: minZ }, { x: maxX, y: floor, z: minZ }, "shell"),
    edge({ x: maxX, y: floor, z: minZ }, { x: maxX, y: floor, z: maxZ }, "shell"),
    edge({ x: maxX, y: floor, z: maxZ }, { x: minX, y: floor, z: maxZ }, "shell"),
    edge({ x: minX, y: floor, z: maxZ }, { x: minX, y: floor, z: minZ }, "shell"),
    edge({ x: minX, y: floor, z: minZ }, { x: minX, y: ceiling, z: minZ }, "shell"),
    edge({ x: maxX, y: floor, z: minZ }, { x: maxX, y: ceiling, z: minZ }, "shell"),
    edge({ x: maxX, y: floor, z: maxZ }, { x: maxX, y: ceiling, z: maxZ }, "shell"),
    edge({ x: minX, y: floor, z: maxZ }, { x: minX, y: ceiling, z: maxZ }, "shell"),
    edge({ x: minX, y: ceiling, z: minZ }, { x: maxX, y: ceiling, z: minZ }, "shell"),
    edge({ x: maxX, y: ceiling, z: minZ }, { x: maxX, y: ceiling, z: maxZ }, "shell"),
    edge({ x: maxX, y: ceiling, z: maxZ }, { x: minX, y: ceiling, z: maxZ }, "shell"),
    edge({ x: minX, y: ceiling, z: maxZ }, { x: minX, y: ceiling, z: minZ }, "shell"),
  ]
  const grid: OutlineSegment[] = []
  const step = OUTLINE_GRID_STEP
  const onWall = (v: number, lo: number, hi: number) => Math.abs(v - lo) < 0.05 || Math.abs(v - hi) < 0.05
  for (let x = Math.ceil((minX + 0.05) / step) * step; x < maxX - 0.05; x += step) {
    if (onWall(x, minX, maxX)) continue
    grid.push(edge({ x, y: floor, z: minZ }, { x, y: floor, z: maxZ }, "grid"))
  }
  for (let z = Math.ceil((minZ + 0.05) / step) * step; z < maxZ - 0.05; z += step) {
    if (onWall(z, minZ, maxZ)) continue
    grid.push(edge({ x: minX, y: floor, z }, { x: maxX, y: floor, z }, "grid"))
  }
  return [...shell, ...grid]
}

function basisOf(pose: CameraPose): Basis | null {
  const eye = { x: pose.position[0], y: pose.position[1], z: pose.position[2] }
  let fx = pose.target[0] - eye.x
  let fy = pose.target[1] - eye.y
  let fz = pose.target[2] - eye.z
  const fl = Math.hypot(fx, fy, fz)
  if (!(fl > 1e-5)) return null
  fx /= fl
  fy /= fl
  fz /= fl
  let ux = 0
  let uy = 1
  let uz = 0
  if (Math.abs(fx * ux + fy * uy + fz * uz) > 0.98) {
    ux = 0
    uy = 0
    uz = 1
  }
  let rx = fy * uz - fz * uy
  let ry = fz * ux - fx * uz
  let rz = fx * uy - fy * ux
  const rl = Math.hypot(rx, ry, rz)
  if (!(rl > 1e-5)) return null
  rx /= rl
  ry /= rl
  rz /= rl
  return {
    eye,
    forward: { x: fx, y: fy, z: fz },
    right: { x: rx, y: ry, z: rz },
    up: { x: ry * fz - rz * fy, y: rz * fx - rx * fz, z: rx * fy - ry * fx },
  }
}

function cameraOf(p: OutlinePoint, basis: Basis) {
  const dx = p.x - basis.eye.x
  const dy = p.y - basis.eye.y
  const dz = p.z - basis.eye.z
  return {
    x: dx * basis.right.x + dy * basis.right.y + dz * basis.right.z,
    y: dx * basis.up.x + dy * basis.up.y + dz * basis.up.z,
    depth: dx * basis.forward.x + dy * basis.forward.y + dz * basis.forward.z,
  }
}

type CamPoint = { x: number; y: number; depth: number }

function clipNear(a: CamPoint, b: CamPoint): [CamPoint, CamPoint] | null {
  const aOk = a.depth >= NEAR
  const bOk = b.depth >= NEAR
  if (aOk && bOk) return [a, b]
  if (!aOk && !bOk) return null
  const span = b.depth - a.depth
  if (!(Math.abs(span) > 1e-8)) return null
  const t = (NEAR - a.depth) / span
  const hit = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, depth: NEAR }
  return aOk ? [a, hit] : [hit, b]
}

const INSIDE = 0
const LEFT = 1
const RIGHT = 2
const BOTTOM = 4
const TOP = 8

function code(x: number, y: number) {
  let bits = INSIDE
  if (x < -1) bits |= LEFT
  else if (x > 1) bits |= RIGHT
  if (y < -1) bits |= BOTTOM
  else if (y > 1) bits |= TOP
  return bits
}

/** Clip a segment in normalized device coordinates to the view. */
function clipNdc(ax: number, ay: number, bx: number, by: number) {
  let c1 = code(ax, ay)
  let c2 = code(bx, by)
  for (let i = 0; i < 12; i++) {
    if (!(c1 | c2)) return { ax, ay, bx, by }
    if (c1 & c2) return null
    const out = c1 || c2
    let x = 0
    let y = 0
    const dx = bx - ax
    const dy = by - ay
    if (out & TOP) {
      if (!(Math.abs(dy) > 1e-8)) return null
      x = ax + (dx * (1 - ay)) / dy
      y = 1
    } else if (out & BOTTOM) {
      if (!(Math.abs(dy) > 1e-8)) return null
      x = ax + (dx * (-1 - ay)) / dy
      y = -1
    } else if (out & RIGHT) {
      if (!(Math.abs(dx) > 1e-8)) return null
      y = ay + (dy * (1 - ax)) / dx
      x = 1
    } else {
      if (!(Math.abs(dx) > 1e-8)) return null
      y = ay + (dy * (-1 - ax)) / dx
      x = -1
    }
    if (out === c1) {
      ax = x
      ay = y
      c1 = code(ax, ay)
    } else {
      bx = x
      by = y
      c2 = code(bx, by)
    }
  }
  return null
}

export type OutlineView = {
  pose: CameraPose
  fovY: number
  width: number
  height: number
}

/** How much of the page the box may fill. The rest stays paper, and the stroke stays inside. */
const FRAME_LIMIT = 0.76

/**
 * A camera just outside the door, backed up until every corner of the box sits
 * inside the page. The live scan still opens from the doorway; this pose is only
 * for the drawing.
 */
export function frameRoom(
  corners: readonly [readonly [number, number], readonly [number, number]],
  eyeY: number,
  width: number,
  height: number,
  fovY = LIVE_FOV_Y,
): CameraPose | null {
  if (!Number.isFinite(eyeY) || !(width > 1) || !(height > 1)) return null
  const { minX, maxX, minZ, maxZ } = boxOf(corners)
  if (!(maxX - minX > 0.2) || !(maxZ - minZ > 0.2)) return null
  const floor = floorY(eyeY)
  const ceiling = eyeY + OUTLINE_CEILING_ABOVE_EYE
  const cx = (minX + maxX) / 2
  const cy = (floor + ceiling) / 2
  const cz = (minZ + maxZ) / 2
  const halfY = Math.tan((fovY * Math.PI) / 360)
  const halfX = halfY * (width / height)
  if (!(halfX > 1e-4) || !(halfY > 1e-4)) return null
  const pts: OutlinePoint[] = []
  for (const x of [minX, maxX]) {
    for (const y of [floor, ceiling]) {
      for (const z of [minZ, maxZ]) pts.push({ x, y, z })
    }
  }
  const fits = (dist: number) => {
    const basis = basisOf({ position: [cx, cy, maxZ + dist], target: [cx, cy, cz] })
    if (!basis) return false
    for (const p of pts) {
      const cam = cameraOf(p, basis)
      if (!(cam.depth > NEAR)) return false
      if (Math.abs(cam.x / cam.depth / halfX) > FRAME_LIMIT) return false
      if (Math.abs(cam.y / cam.depth / halfY) > FRAME_LIMIT) return false
    }
    return true
  }
  let lo = 0.35
  let hi = 160
  if (!fits(hi)) return { position: [cx, cy, maxZ + hi], target: [cx, cy, cz] }
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  return { position: [cx, cy, maxZ + hi], target: [cx, cy, cz] }
}

/**
 * Project the room into the view. Lines that run past the lens are cut at the
 * near plane and again at the screen, so a wall arrives at the edge of the page
 * instead of flying off it.
 */
export function projectOutline(segments: readonly OutlineSegment[], view: OutlineView): ScreenSegment[] {
  const { width, height, fovY } = view
  if (!(width > 1) || !(height > 1) || !(fovY > 1) || !(fovY < 170)) return []
  const basis = basisOf(view.pose)
  if (!basis) return []
  const halfY = Math.tan((fovY * Math.PI) / 360)
  const halfX = halfY * (width / height)
  if (!(halfX > 1e-4) || !(halfY > 1e-4)) return []
  const out: ScreenSegment[] = []
  for (const seg of segments) {
    const clipped = clipNear(cameraOf(seg.a, basis), cameraOf(seg.b, basis))
    if (!clipped) continue
    const [a, b] = clipped
    const ndc = clipNdc(a.x / a.depth / halfX, a.y / a.depth / halfY, b.x / b.depth / halfX, b.y / b.depth / halfY)
    if (!ndc) continue
    const x1 = (ndc.ax * 0.5 + 0.5) * width
    const y1 = (0.5 - ndc.ay * 0.5) * height
    const x2 = (ndc.bx * 0.5 + 0.5) * width
    const y2 = (0.5 - ndc.by * 0.5) * height
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (!(length > 1)) continue
    out.push({ x1, y1, x2, y2, length, kind: seg.kind })
  }
  return out
}

/** 0..1 of the wall drawing. Reduced motion is the finished room. */
export function outlineDraw(progress: number | null, reducedMotion: boolean) {
  if (reducedMotion) return 1
  if (progress == null || !Number.isFinite(progress)) return OUTLINE_UNKNOWN_DRAW
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  return progress
}

/**
 * Reveal the shell in pen order, up to `amount` of its screen length. The grid
 * is not part of that length: it is already on the sheet.
 */
export function applyDraw(segments: readonly ScreenSegment[], amount: number): DrawnSegment[] {
  const shell = segments.filter((seg) => seg.kind === "shell")
  const total = shell.reduce((sum, seg) => sum + seg.length, 0)
  const fraction = !Number.isFinite(amount) ? 0 : amount <= 0 ? 0 : amount >= 1 ? 1 : amount
  let budget = total * fraction
  const shownOf = new Map<ScreenSegment, number>()
  for (const seg of shell) {
    if (!(seg.length > 0) || budget <= 0) {
      shownOf.set(seg, 0)
      continue
    }
    if (budget >= seg.length - 1e-4) {
      shownOf.set(seg, 1)
      budget -= seg.length
      continue
    }
    shownOf.set(seg, budget / seg.length)
    budget = 0
  }
  return segments.map((seg) => ({ ...seg, shown: seg.kind === "grid" ? 1 : (shownOf.get(seg) ?? 0) }))
}
