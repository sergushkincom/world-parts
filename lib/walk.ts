/**
 * First-person walk inside a scanned room.
 *
 * The floor plan's two calibration corners are the walls in world x and z. Walking clamps to that
 * box, pulled in by an inset so the eye stays off the shell (a snow-globe limit: you can look
 * around, you cannot leave the capture). Eye height is the scan camera's y, and it is the whole
 * vertical extent of the box, so the same clamp locks height.
 *
 * Yaw matches PlayCanvas: 0 looks down −Z, positive pitch looks up, positive yaw turns toward −X.
 */

export type LocomotionMode = "orbit" | "walk"

export type Vec3 = { x: number; y: number; z: number }

export type Aabb = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

/** Metres kept between the eye and the calibrated wall. */
export const WALK_WALL_INSET = 0.4

/** Metres per second on the floor. A workshop is about 12 m deep. */
export const WALK_SPEED = 1.75

/** How far short of the object Find stops, so the eye is not inside the splats. */
export const WALK_STANDOFF = 1.6

/** Matches CameraControls `zoomRange` so handing back to orbit does not rescale the pivot. */
export const ORBIT_DISTANCE = { min: 0.2, max: 6 } as const

/** Same feel as CameraControls `rotateSpeed` (0.2° per pixel). */
export const LOOK_RADIANS_PER_PIXEL = (0.2 * Math.PI) / 180

export const PITCH_LIMIT = (80 * Math.PI) / 180

export type Stick = { forward: number; strafe: number }

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function wrapAngle(rad: number) {
  const turn = Math.PI * 2
  let a = rad % turn
  if (a > Math.PI) a -= turn
  if (a < -Math.PI) a += turn
  return a
}

/**
 * Room box from the two calibration corners `(x, z)`. `eyeY` is both min and max y.
 * Inset shrinks x and z, but never far enough to flip a narrow room inside out.
 */
export function roomAabb(
  corners: readonly [readonly [number, number], readonly [number, number]],
  eyeY: number,
  inset = WALK_WALL_INSET,
): Aabb {
  const [a, b] = corners
  let minX = Math.min(a[0], b[0])
  let maxX = Math.max(a[0], b[0])
  let minZ = Math.min(a[1], b[1])
  let maxZ = Math.max(a[1], b[1])
  const room = Math.min(maxX - minX, maxZ - minZ)
  const pad = Math.min(Math.max(0, inset), Math.max(0, room / 2 - 0.05))
  minX += pad
  maxX -= pad
  minZ += pad
  maxZ -= pad
  return { minX, maxX, minY: eyeY, maxY: eyeY, minZ, maxZ }
}

export function clampToAabb(point: Vec3, box: Aabb): Vec3 {
  return {
    x: clampNum(point.x, box.minX, box.maxX),
    y: clampNum(point.y, box.minY, box.maxY),
    z: clampNum(point.z, box.minZ, box.maxZ),
  }
}

/** Flat facing on the floor. Yaw 0 is −Z. */
export function flatBasis(yaw: number) {
  return {
    forwardX: -Math.sin(yaw),
    forwardZ: -Math.cos(yaw),
    rightX: Math.cos(yaw),
    rightZ: Math.sin(yaw),
  }
}

export function combineAxes(parts: readonly Stick[]): Stick {
  let forward = 0
  let strafe = 0
  for (const part of parts) {
    forward += part.forward
    strafe += part.strafe
  }
  return { forward: clampNum(forward, -1, 1), strafe: clampNum(strafe, -1, 1) }
}

/**
 * One integration step. Diagonal input is normalised so it is not faster than straight ahead.
 * Y is forced through the box, which is a single eye height.
 */
export function stepWalk(args: {
  position: Vec3
  yaw: number
  stick: Stick
  speed: number
  dt: number
  bounds: Aabb
}): Vec3 {
  const { forwardX, forwardZ, rightX, rightZ } = flatBasis(args.yaw)
  let { forward, strafe } = args.stick
  const mag = Math.hypot(forward, strafe)
  if (mag > 1) {
    forward /= mag
    strafe /= mag
  }
  const scale = args.speed * args.dt
  return clampToAabb(
    {
      x: args.position.x + (forwardX * forward + rightX * strafe) * scale,
      y: args.position.y,
      z: args.position.z + (forwardZ * forward + rightZ * strafe) * scale,
    },
    args.bounds,
  )
}

export function lookAtAngles(from: Vec3, target: Vec3) {
  const dx = target.x - from.x
  const dy = target.y - from.y
  const dz = target.z - from.z
  const horiz = Math.hypot(dx, dz)
  return {
    yaw: Math.atan2(-dx, -dz),
    pitch: clampNum(Math.atan2(dy, horiz), -PITCH_LIMIT, PITCH_LIMIT),
  }
}

export function applyLook(args: {
  yaw: number
  pitch: number
  dx: number
  dy: number
  radiansPerPixel?: number
  pitchLimit?: number
}) {
  const sens = args.radiansPerPixel ?? LOOK_RADIANS_PER_PIXEL
  const limit = args.pitchLimit ?? PITCH_LIMIT
  // Drag right turns toward +X (yaw decreases). Drag up looks up.
  return {
    yaw: wrapAngle(args.yaw - args.dx * sens),
    pitch: clampNum(args.pitch - args.dy * sens, -limit, limit),
  }
}

export function gazePoint(position: Vec3, yaw: number, pitch: number, distance: number): Vec3 {
  const cp = Math.cos(pitch)
  return {
    x: position.x - Math.sin(yaw) * cp * distance,
    y: position.y + Math.sin(pitch) * distance,
    z: position.z - Math.cos(yaw) * cp * distance,
  }
}

export function clampDistance(distance: number) {
  if (!Number.isFinite(distance) || distance <= 0) return 2.5
  return clampNum(distance, ORBIT_DISTANCE.min, ORBIT_DISTANCE.max)
}

/**
 * Where to stand so Find walks up to `target` and faces it.
 * The stand point is `standoff` metres from the target, on the side toward `from`
 * (or toward `prefer`, then the door at +Z, when the eye is already on the target).
 */
export function approachStand(args: {
  from: Vec3
  target: Vec3
  bounds: Aabb
  standoff?: number
  prefer?: Vec3
}): { position: Vec3; yaw: number; pitch: number } {
  const standoff = args.standoff ?? WALK_STANDOFF
  let dx = args.from.x - args.target.x
  let dz = args.from.z - args.target.z
  let len = Math.hypot(dx, dz)
  if (len < 1e-3 && args.prefer) {
    dx = args.prefer.x - args.target.x
    dz = args.prefer.z - args.target.z
    len = Math.hypot(dx, dz)
  }
  if (len < 1e-3) {
    dx = 0
    dz = 1
    len = 1
  }
  const position = clampToAabb(
    {
      x: args.target.x + (dx / len) * standoff,
      y: args.bounds.minY,
      z: args.target.z + (dz / len) * standoff,
    },
    args.bounds,
  )
  return { position, ...lookAtAngles(position, args.target) }
}

/** Home, or any authored pose, dropped onto the eye-height floor and kept inside the room. */
export function standAt(position: Vec3, lookAt: Vec3, bounds: Aabb) {
  const stood = clampToAabb({ x: position.x, y: bounds.minY, z: position.z }, bounds)
  return { position: stood, ...lookAtAngles(stood, lookAt) }
}

/** Share of the remaining gap to close this frame. Damping 0 jumps. Same curve as CameraControls. */
export function dampAlpha(damping: number, dt: number) {
  if (!(damping > 0) || !(dt > 0)) return 1
  return 1 - Math.pow(damping, dt * 1000)
}

export function dampAngle(current: number, target: number, alpha: number) {
  return wrapAngle(current + wrapAngle(target - current) * alpha)
}
