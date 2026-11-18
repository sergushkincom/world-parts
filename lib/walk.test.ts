import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PLAN_CALIBRATION } from "./data.ts"
import {
  PITCH_LIMIT,
  WALK_SPEED,
  WALK_STANDOFF,
  WALK_WALL_INSET,
  applyLook,
  approachStand,
  clampDistance,
  clampToAabb,
  combineAxes,
  dampAlpha,
  dampAngle,
  flatBasis,
  gazePoint,
  lookAtAngles,
  roomAabb,
  standAt,
  stepWalk,
  wrapAngle,
  type Aabb,
  type Vec3,
} from "./walk.ts"

const eye = 0
const workshop = roomAabb(PLAN_CALIBRATION.workshop!.world, eye)

function near(a: number, b: number, eps = 1e-6) {
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)
}

function nearVec(a: Vec3, b: Vec3, eps = 1e-6) {
  near(a.x, b.x, eps)
  near(a.y, b.y, eps)
  near(a.z, b.z, eps)
}

describe("room AABB from calibration", () => {
  it("uses the workshop walls and locks y to eye height", () => {
    // Corners are (−2.8, −12.3) and (2.8, 0). Inset 0.4 keeps the eye off the shell.
    assert.deepEqual(workshop, {
      minX: -2.8 + WALK_WALL_INSET,
      maxX: 2.8 - WALK_WALL_INSET,
      minY: 0,
      maxY: 0,
      minZ: -12.3 + WALK_WALL_INSET,
      maxZ: 0 - WALK_WALL_INSET,
    })
  })

  it("accepts corners in either order", () => {
    const flipped = roomAabb(
      [
        [2.8, 0],
        [-2.8, -12.3],
      ],
      0.2,
    )
    assert.equal(flipped.minX, workshop.minX)
    assert.equal(flipped.maxZ, workshop.maxZ)
    assert.equal(flipped.minY, 0.2)
    assert.equal(flipped.maxY, 0.2)
  })

  it("refuses to invert a corridor that is narrower than the inset", () => {
    const box = roomAabb(
      [
        [-0.2, -4],
        [0.2, 0],
      ],
      0,
      5,
    )
    assert.ok(box.maxX > box.minX)
    assert.ok(box.maxX - box.minX >= 0.09)
    assert.equal(box.minY, box.maxY)
  })
})

describe("clamp", () => {
  const box: Aabb = { minX: -2, maxX: 2, minY: 0, maxY: 0, minZ: -10, maxZ: -0.4 }

  it("leaves an interior point and pins the rest to the faces", () => {
    nearVec(clampToAabb({ x: 0, y: 3, z: -4 }, box), { x: 0, y: 0, z: -4 })
    nearVec(clampToAabb({ x: 9, y: -2, z: 4 }, box), { x: 2, y: 0, z: -0.4 })
    nearVec(clampToAabb({ x: -9, y: 0, z: -40 }, box), { x: -2, y: 0, z: -10 })
  })
})

describe("stepWalk", () => {
  const bounds = workshop
  const origin: Vec3 = { x: 0, y: 4, z: -5 }

  it("walks forward along −Z at yaw 0 and locks eye height", () => {
    const next = stepWalk({ position: origin, yaw: 0, stick: { forward: 1, strafe: 0 }, speed: 2, dt: 0.5, bounds })
    nearVec(next, { x: 0, y: 0, z: -6 })
  })

  it("strafes to +X when yaw is 0", () => {
    const next = stepWalk({
      position: { x: 0, y: 0, z: -5 },
      yaw: 0,
      stick: { forward: 0, strafe: 1 },
      speed: 1,
      dt: 1,
      bounds,
    })
    nearVec(next, { x: 1, y: 0, z: -5 })
  })

  it("does not go faster on a diagonal", () => {
    const next = stepWalk({
      position: { x: 0, y: 0, z: -5 },
      yaw: 0,
      stick: { forward: 1, strafe: 1 },
      speed: 1,
      dt: 1,
      bounds,
    })
    const travelled = Math.hypot(next.x, next.z + 5)
    near(travelled, 1)
  })

  it("stops at the wall instead of leaving the room", () => {
    const next = stepWalk({
      position: { x: 0, y: 0, z: bounds.maxZ - 0.1 },
      yaw: 0,
      stick: { forward: -1, strafe: 0 },
      speed: 5,
      dt: 1,
      bounds,
    })
    near(next.z, bounds.maxZ)
    near(next.y, 0)
    assert.ok(next.x >= bounds.minX && next.x <= bounds.maxX)
  })

  it("matches the published walk speed over one second", () => {
    const basis = flatBasis(0)
    near(basis.forwardZ, -1)
    const next = stepWalk({
      position: { x: 0, y: 0, z: -5 },
      yaw: 0,
      stick: combineAxes([
        { forward: 1, strafe: 0 },
        { forward: 1, strafe: 0 },
      ]),
      speed: WALK_SPEED,
      dt: 1,
      bounds,
    })
    // Two forward keys still clamp to one axis.
    near(next.z, -5 - WALK_SPEED)
  })
})

describe("look", () => {
  it("turns right toward +X and looks up, then stops at the pitch limit", () => {
    const turned = applyLook({ yaw: 0, pitch: 0, dx: 100, dy: -50 })
    assert.ok(turned.yaw < 0)
    assert.ok(turned.pitch > 0)
    const pinned = applyLook({ yaw: 0, pitch: 0, dx: 0, dy: -1e6 })
    near(pinned.pitch, PITCH_LIMIT)
    const down = applyLook({ yaw: 0, pitch: 0, dx: 0, dy: 1e6 })
    near(down.pitch, -PITCH_LIMIT)
  })

  it("round-trips a gaze through look-at angles", () => {
    const position = { x: 0.2, y: 0, z: -3 }
    const target = gazePoint(position, 0.4, -0.2, 2)
    const angles = lookAtAngles(position, target)
    near(angles.yaw, 0.4)
    near(angles.pitch, -0.2)
    nearVec(gazePoint(position, angles.yaw, angles.pitch, 2), target)
  })

  it("keeps an orbit hand-off distance inside the zoom range", () => {
    assert.equal(clampDistance(0), 2.5)
    assert.equal(clampDistance(Number.NaN), 2.5)
    assert.equal(clampDistance(0.01), 0.2)
    assert.equal(clampDistance(1.6), 1.6)
    assert.equal(clampDistance(40), 6)
  })
})

describe("approach and stand", () => {
  it("walks up to the pump and stays at eye height, facing it", () => {
    const target = { x: -0.66, y: -0.55, z: -4.56 }
    const stood = approachStand({
      from: { x: 0, y: 1.2, z: 0 },
      target,
      bounds: workshop,
    })
    near(stood.position.y, 0)
    const dist = Math.hypot(stood.position.x - target.x, stood.position.z - target.z)
    near(dist, WALK_STANDOFF, 1e-6)
    const facing = lookAtAngles(stood.position, target)
    near(stood.yaw, facing.yaw)
    near(stood.pitch, facing.pitch)
    assert.ok(stood.pitch < 0, "the pump sits below eye height")
    assert.ok(stood.position.x >= workshop.minX && stood.position.x <= workshop.maxX)
    assert.ok(stood.position.z >= workshop.minZ && stood.position.z <= workshop.maxZ)
  })

  it("stops on the wall when the clear side of the object is outside the room", () => {
    // Eye is on the back wall; the object is a step toward the door. The standoff
    // would stand behind the wall, so the clamp keeps the eye on the shell and still facing the object.
    const target = { x: 0, y: 0.4, z: -11.2 }
    const stood = approachStand({
      from: { x: 0, y: 0, z: workshop.minZ },
      target,
      bounds: workshop,
    })
    near(stood.position.z, workshop.minZ)
    near(stood.position.y, 0)
    const facing = lookAtAngles(stood.position, target)
    near(stood.yaw, facing.yaw)
    near(Math.abs(wrapAngle(stood.yaw)), Math.PI, 0.05)
  })

  it("uses the framing side when the eye is already on the target", () => {
    const target = { x: 1, y: 0.2, z: -6 }
    const stood = approachStand({
      from: { x: 1, y: 0, z: -6 },
      prefer: { x: 1, y: 0, z: -3 },
      target,
      bounds: workshop,
      standoff: 1,
    })
    near(stood.position.z, -5)
    near(stood.position.x, 1)
  })

  it("drops a reset pose onto the floor without leaving the box", () => {
    const stood = standAt({ x: 10, y: 2, z: 1 }, { x: 10, y: 2, z: -4 }, workshop)
    near(stood.position.x, workshop.maxX)
    near(stood.position.y, 0)
    near(stood.position.z, workshop.maxZ)
    const facing = lookAtAngles(stood.position, { x: 10, y: 2, z: -4 })
    near(stood.yaw, facing.yaw)
  })
})

describe("damping", () => {
  it("jumps when motion is reduced and eases otherwise", () => {
    assert.equal(dampAlpha(0, 0.016), 1)
    assert.equal(dampAlpha(0.98, 0), 1)
    const alpha = dampAlpha(0.98, 0.016)
    assert.ok(alpha > 0.2 && alpha < 0.4)
  })

  it("takes the short way around a wrap", () => {
    const next = dampAngle(3, -3, 1)
    near(wrapAngle(next), wrapAngle(-3))
    const half = dampAngle(3, -3, 0.5)
    // Halfway along the short arc (~0.28 rad), not halfway across the long one.
    near(wrapAngle(half - 3), wrapAngle(-3 - 3) * 0.5, 1e-6)
  })
})
