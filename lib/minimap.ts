import { PLAN_CALIBRATION, ROOMS, SCENE, type Point, type RoomId } from "@/lib/data"
import { STILL_CAMERA } from "@/lib/splat-mask"

/** Where the camera is and where it looks, on the floor (world x, z). `hfov` in radians. */
export type CameraView = { x: number; z: number; fx: number; fz: number; hfov: number }

/** The still frame's camera: in the door, looking straight in (−Z), with the still's own field of view. */
export const STILL_VIEW: CameraView = {
  x: 0,
  z: 0,
  fx: 0,
  fz: -1,
  hfov: 2 * Math.atan(Math.tan(((STILL_CAMERA.fovY / 2) * Math.PI) / 180) * (SCENE.width / SCENE.height)),
}

/** World (x, z) → plan px for a room, from its two calibration points. Null for rooms without a world. */
export function planMapper(roomId: RoomId) {
  const cal = PLAN_CALIBRATION[roomId]
  if (!cal) return null
  // Turn world (x, z) so −Z points the way the still's camera faces on the plan; then u runs with plan x, v with plan y.
  const turn = (x: number, z: number): Point => {
    switch (cal.facing ?? "north") {
      case "north":
        return [x, z]
      case "south":
        return [-x, -z]
      case "west":
        return [z, -x]
      case "east":
        return [-z, x]
    }
  }
  const [u0, v0] = turn(...cal.world[0])
  const [u1, v1] = turn(...cal.world[1])
  const [[px0, py0], [px1, py1]] = cal.plan
  const su = (px1 - px0) / (u1 - u0)
  const sv = (py1 - py0) / (v1 - v0)
  const toPlan = (x: number, z: number): Point => {
    const [u, v] = turn(x, z)
    return [px0 + (u - u0) * su, py0 + (v - v0) * sv]
  }
  /**
   * Directions keep their true angle: the plan room is wider than the world's, so stretching x would open an
   * 82° view into a ~140° fan. The cone shows how much the camera sees, not where each wall lands.
   */
  const dirToPlan = (dx: number, dz: number): Point => turn(dx, dz)
  /** Same as toPlan, but kept inside the room: objects measured just past a wall still land in their room. */
  const room = ROOMS.find((r) => r.id === roomId)
  const inRoom = (x: number, z: number, inset = 8): Point => {
    const [px, py] = toPlan(x, z)
    if (!room) return [px, py]
    const xs = room.polygon.map((p) => p[0])
    const ys = room.polygon.map((p) => p[1])
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi - inset, Math.max(lo + inset, v))
    return [clamp(px, Math.min(...xs), Math.max(...xs)), clamp(py, Math.min(...ys), Math.max(...ys))]
  }
  return { toPlan, dirToPlan, inRoom }
}

/** The view cone on the plan: apex at the camera, edges at ± half the horizontal FOV, long enough to reach any wall. */
export function conePath(map: NonNullable<ReturnType<typeof planMapper>>, view: CameraView, length = 1200): string {
  const [ax, ay] = map.toPlan(view.x, view.z)
  const edge = (sign: number) => {
    const a = (sign * view.hfov) / 2
    // Rotate the forward vector on the floor plane, then map the direction to the plan.
    const dx = view.fx * Math.cos(a) - view.fz * Math.sin(a)
    const dz = view.fz * Math.cos(a) + view.fx * Math.sin(a)
    const [px, py] = map.dirToPlan(dx, dz)
    const n = Math.hypot(px, py) || 1
    return [ax + (px / n) * length, ay + (py / n) * length]
  }
  const [lx, ly] = edge(-1)
  const [rx, ry] = edge(1)
  return `M${ax.toFixed(1)},${ay.toFixed(1)} L${lx.toFixed(1)},${ly.toFixed(1)} L${rx.toFixed(1)},${ry.toFixed(1)} Z`
}

/** The crop around one room, with a margin, for the phone card. */
export function roomViewBox(roomId: RoomId, margin = 40): [number, number, number, number] {
  const room = ROOMS.find((r) => r.id === roomId)
  if (!room) return [0, 0, 0, 0]
  const xs = room.polygon.map((p) => p[0])
  const ys = room.polygon.map((p) => p[1])
  const x = Math.min(...xs) - margin
  const y = Math.min(...ys) - margin
  return [x, y, Math.max(...xs) - Math.min(...xs) + margin * 2, Math.max(...ys) - Math.min(...ys) + margin * 2]
}
