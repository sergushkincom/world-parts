import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PLAN_CALIBRATION, WORLDS, type RoomId } from "./data.ts"
import { floorY } from "./guide.ts"
import {
  LIVE_FOV_Y,
  OUTLINE_CEILING_ABOVE_EYE,
  OUTLINE_UNKNOWN_DRAW,
  applyDraw,
  frameRoom,
  outlineDraw,
  projectOutline,
  roomOutline,
  type OutlineSegment,
  type ScreenSegment,
} from "./room-outline.ts"

const HOME = { position: [0, 0, 0] as [number, number, number], target: [0, 0, -1] as [number, number, number] }

function near(a: number, b: number, eps = 1.5) {
  assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)
}

function shellOf<T extends { kind: string }>(segments: readonly T[]) {
  return segments.filter((seg) => seg.kind === "shell")
}

describe("room outline", () => {
  const workshop = PLAN_CALIBRATION.workshop!
  const lines = roomOutline(workshop.world, 0)

  it("closes the box, floor first, then the corners", () => {
    const shell = shellOf(lines)
    assert.equal(shell.length, 12)
    const nearZ = Math.max(workshop.world[0][1], workshop.world[1][1])
    const farZ = Math.min(workshop.world[0][1], workshop.world[1][1])
    assert.equal(shell[0].a.z, farZ)
    assert.equal(shell[0].b.z, farZ)
    assert.ok(shell.some((seg) => seg.a.z === nearZ && seg.b.z === nearZ))
    const floor = floorY(0)
    assert.equal(shell[0].a.y, floor)
    assert.equal(shell[4].b.y, OUTLINE_CEILING_ABOVE_EYE)
  })

  it("keeps a sparse floor grid inside the walls", () => {
    const grid = lines.filter((seg) => seg.kind === "grid")
    assert.ok(grid.length > 4 && grid.length < 20)
    const { minX, maxX } = {
      minX: Math.min(workshop.world[0][0], workshop.world[1][0]),
      maxX: Math.max(workshop.world[0][0], workshop.world[1][0]),
    }
    for (const seg of grid) {
      assert.ok(seg.a.x > minX - 1e-6 && seg.a.x < maxX + 1e-6)
      assert.ok(seg.b.x > minX - 1e-6 && seg.b.x < maxX + 1e-6)
    }
  })

  it("returns nothing for a flat box or a bad eye height", () => {
    assert.deepEqual(roomOutline([[0, 0], [0, -5]], 0), [])
    assert.deepEqual(roomOutline(workshop.world, Number.NaN), [])
  })
})

describe("projection", () => {
  const view = { pose: HOME, fovY: LIVE_FOV_Y, width: 1280, height: 720 }

  it("fits the whole workshop on the page, centred, with paper around it", () => {
    const corners = PLAN_CALIBRATION.workshop!.world
    const pose = frameRoom(corners, 0, view.width, view.height)
    assert.ok(pose)
    const projected = projectOutline(roomOutline(corners, 0), { ...view, pose })
    const shell = shellOf(projected) as ScreenSegment[]
    assert.equal(shell.length, 12)
    for (const seg of shell) {
      for (const x of [seg.x1, seg.x2]) assert.ok(x > 8 && x < view.width - 8)
      for (const y of [seg.y1, seg.y2]) assert.ok(y > 8 && y < view.height - 8)
    }
    const xs = shell.flatMap((seg) => [seg.x1, seg.x2])
    const ys = shell.flatMap((seg) => [seg.y1, seg.y2])
    near((Math.min(...xs) + Math.max(...xs)) / 2, view.width / 2, 4)
    near((Math.min(...ys) + Math.max(...ys)) / 2, view.height / 2, 4)
    assert.ok(Math.max(...xs) - Math.min(...xs) > view.width * 0.55)
  })

  it("drops a segment that sits behind the camera", () => {
    const behind: OutlineSegment[] = [
      {
        a: { x: -1, y: 0, z: 2 },
        b: { x: 1, y: 0, z: 2 },
        kind: "shell",
      },
    ]
    assert.deepEqual(projectOutline(behind, view), [])
  })

  it("projects every scanned room on a phone and on a desktop", () => {
    const rooms: RoomId[] = ["workshop", "storeroom", "production", "corridor"]
    for (const room of rooms) {
      const cal = PLAN_CALIBRATION[room]
      assert.ok(cal)
      assert.ok(WORLDS[room])
      for (const size of [
        { width: 390, height: 700 },
        { width: 1440, height: 900 },
      ]) {
        const pose = frameRoom(cal.world, 0, size.width, size.height)
        assert.ok(pose, room)
        const projected = projectOutline(roomOutline(cal.world, 0), { pose, fovY: LIVE_FOV_Y, ...size })
        assert.equal(shellOf(projected).length, 12, `${room} ${size.width}`)
        assert.ok(projected.some((seg) => seg.kind === "grid"), room)
      }
    }
  })

  it("returns nothing for an empty view", () => {
    const lines = roomOutline(PLAN_CALIBRATION.workshop!.world, 0)
    assert.deepEqual(projectOutline(lines, { pose: HOME, fovY: LIVE_FOV_Y, width: 0, height: 720 }), [])
    assert.deepEqual(
      projectOutline(lines, { pose: { position: [0, 0, 0], target: [0, 0, 0] }, fovY: 60, width: 800, height: 600 }),
      [],
    )
  })
})

describe("draw amount", () => {
  const shell: ScreenSegment[] = [
    { x1: 0, y1: 0, x2: 10, y2: 0, length: 10, kind: "shell" },
    { x1: 0, y1: 0, x2: 0, y2: 10, length: 30, kind: "shell" },
  ]
  const grid: ScreenSegment = { x1: 0, y1: 1, x2: 4, y2: 1, length: 4, kind: "grid" }

  it("follows the download, and reduced motion is already finished", () => {
    assert.equal(outlineDraw(null, false), OUTLINE_UNKNOWN_DRAW)
    assert.equal(outlineDraw(null, true), 1)
    assert.equal(outlineDraw(0, false), 0)
    assert.equal(outlineDraw(0.4, false), 0.4)
    assert.equal(outlineDraw(2, false), 1)
    assert.equal(outlineDraw(Number.NaN, false), OUTLINE_UNKNOWN_DRAW)
    assert.equal(outlineDraw(0.2, true), 1)
  })

  it("draws the walls in order and leaves the grid on the sheet", () => {
    const half = applyDraw([...shell, grid], 0.25)
    near(half[0].shown, 1, 1e-6)
    near(half[1].shown, 0, 1e-6)
    assert.equal(half[2].shown, 1)
    const start = applyDraw(shell, 0)
    assert.deepEqual(
      start.map((seg) => seg.shown),
      [0, 0],
    )
    const done = applyDraw([...shell, grid], 1)
    assert.ok(done.every((seg) => seg.shown === 1))
  })
})
