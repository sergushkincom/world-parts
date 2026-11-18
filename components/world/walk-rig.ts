/**
 * First-person session for the live world.
 *
 * PlayCanvas fly stays off. Its keyboard listener is on `window`, so turning it on would move the
 * camera while someone types in search. This session listens on the canvas alone: keys arrive only
 * when that view is focused. Orbit is the engine's CameraControls; walk replaces its per-frame
 * update so a drag here is a look, not an orbit, and queued mouse deltas are discarded instead of
 * jumping the camera on the way back.
 *
 * The movement math lives in `lib/walk.ts`. Nothing here is copied from another viewer.
 */
import { Vec3, type Application, type Entity } from "playcanvas"
import type { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs"
import type { CameraPose } from "@/lib/data"
import {
  LOOK_RADIANS_PER_PIXEL,
  PITCH_LIMIT,
  WALK_SPEED,
  applyLook,
  clampDistance,
  clampToAabb,
  combineAxes,
  dampAlpha,
  dampAngle,
  gazePoint,
  standAt,
  stepWalk,
  wrapAngle,
  type Aabb,
  type LocomotionMode,
  type Stick,
  type Vec3 as WalkVec,
} from "@/lib/walk"

type InputReader = { read: () => unknown }

type Drainable = CameraControls & {
  _desktopInput: InputReader
  _orbitMobileInput: InputReader
  _flyMobileInput: InputReader
  _gamepadInput: InputReader
}

type Body = WalkVec & { yaw: number; pitch: number }

const KEYS: Record<string, Stick> = {
  w: { forward: 1, strafe: 0 },
  s: { forward: -1, strafe: 0 },
  a: { forward: 0, strafe: -1 },
  d: { forward: 0, strafe: 1 },
  arrowup: { forward: 1, strafe: 0 },
  arrowdown: { forward: -1, strafe: 0 },
  arrowleft: { forward: 0, strafe: -1 },
  arrowright: { forward: 0, strafe: 1 },
}

const ZERO: Stick = { forward: 0, strafe: 0 }

function toVec(p: [number, number, number]) {
  return new Vec3(p[0], p[1], p[2])
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export type WalkRig = {
  setMode: (mode: LocomotionMode) => void
  flyTo: (pose: CameraPose) => void
  reset: (home: CameraPose) => void
  setStick: (stick: Stick) => void
  destroy: () => void
}

export function attachWalkRig(opts: {
  app: Application
  canvas: HTMLCanvasElement
  camera: Entity
  controls: CameraControls
  getBounds: () => Aabb
  /** CameraControls focus curve. Unset uses the library default. Reduced motion forces a jump. */
  getDamping: () => number | undefined
}): WalkRig {
  const { app, canvas, camera, controls } = opts
  const originalUpdate = controls.update.bind(controls)
  let mode: LocomotionMode = "orbit"
  let body: Body = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }
  let glide: Body | null = null
  let gazeDistance = 2.5
  let stick: Stick = ZERO
  let keys: Stick = ZERO
  const held = new Set<string>()
  let look: { id: number; x: number; y: number } | null = null
  let draining = false

  const easing = () => {
    if (reducedMotion()) return 0
    const damping = opts.getDamping()
    return damping === undefined ? 0.98 : damping
  }

  const apply = () => {
    camera.setPosition(body.x, body.y, body.z)
    camera.setEulerAngles((body.pitch * 180) / Math.PI, (body.yaw * 180) / Math.PI, 0)
  }

  const sample = () => {
    const p = camera.getPosition()
    const f = camera.forward
    const horiz = Math.hypot(f.x, f.z)
    body = {
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: horiz < 1e-4 ? body.yaw : Math.atan2(-f.x, -f.z),
      pitch: Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, Math.atan2(f.y, horiz || 1))),
    }
    const focus = controls.focusPoint
    gazeDistance = clampDistance(Math.hypot(focus.x - p.x, focus.y - p.y, focus.z - p.z))
  }

  const drain = () => {
    const bag = controls as Drainable
    bag._desktopInput.read()
    bag._orbitMobileInput.read()
    bag._flyMobileInput.read()
    bag._gamepadInput.read()
  }

  const installDrain = () => {
    if (draining) return
    draining = true
    controls.update = () => {
      drain()
    }
  }

  const restoreUpdate = () => {
    if (!draining) return
    draining = false
    controls.update = originalUpdate
  }

  /**
   * Put CameraControls on this pose in one step. Its focus flight lerps from the pose it had when
   * walk took over, which is no longer where the camera stands.
   */
  const snapOrbit = (position: WalkVec, lookAt: WalkVec) => {
    drain()
    restoreUpdate()
    const prev = controls.focusDamping
    controls.focusDamping = 0
    controls.reset(toVec([lookAt.x, lookAt.y, lookAt.z]), toVec([position.x, position.y, position.z]))
    originalUpdate(1 / 60)
    controls.focusDamping = prev
  }

  const beginGlide = (goal: Body) => {
    if (dampAlpha(easing(), 1 / 60) === 1) {
      body = goal
      glide = null
      apply()
      return
    }
    glide = goal
  }

  const enterWalk = () => {
    sample()
    installDrain()
    // Keys are heard only while the canvas is focused. Don't pull focus out of search.
    const active = document.activeElement
    const typing = active instanceof HTMLElement && active.closest("input, textarea, [contenteditable='true']")
    if (!typing) canvas.focus({ preventScroll: true })
    const bounds = opts.getBounds()
    const stood = clampToAabb({ x: body.x, y: bounds.minY, z: body.z }, bounds)
    beginGlide({ ...stood, yaw: body.yaw, pitch: body.pitch })
    mode = "walk"
  }

  const exitWalk = () => {
    glide = null
    held.clear()
    keys = ZERO
    stick = ZERO
    look = null
    const bounds = opts.getBounds()
    const stood = clampToAabb(body, bounds)
    body = { ...body, ...stood }
    apply()
    const target = gazePoint(body, body.yaw, body.pitch, gazeDistance)
    mode = "orbit"
    snapOrbit(body, target)
  }

  const tick = (dt: number) => {
    if (mode !== "walk") return
    const step = Math.min(Math.max(dt, 0), 0.05)
    const bounds = opts.getBounds()
    const wish = combineAxes([keys, stick])
    const moving = wish.forward !== 0 || wish.strafe !== 0
    if (glide && !moving) {
      const alpha = dampAlpha(easing(), step)
      const y = body.y + (glide.y - body.y) * alpha
      // Walls clamp x and z. Y eases to eye height instead of snapping, so reduced motion is the only jump.
      const next = clampToAabb(
        {
          x: body.x + (glide.x - body.x) * alpha,
          y: bounds.minY,
          z: body.z + (glide.z - body.z) * alpha,
        },
        bounds,
      )
      body = {
        x: next.x,
        y,
        z: next.z,
        yaw: dampAngle(body.yaw, glide.yaw, alpha),
        pitch: body.pitch + (glide.pitch - body.pitch) * alpha,
      }
      const settled =
        Math.hypot(body.x - glide.x, body.y - glide.y, body.z - glide.z) < 0.015 &&
        Math.abs(wrapAngle(body.yaw - glide.yaw)) < 0.01 &&
        Math.abs(body.pitch - glide.pitch) < 0.01
      if (settled) {
        body = glide
        glide = null
      }
    } else {
      if (moving) glide = null
      const next = stepWalk({ position: body, yaw: body.yaw, stick: wish, speed: WALK_SPEED, dt: step, bounds })
      body = { ...body, ...next }
    }
    apply()
  }

  const syncKeys = () => {
    let forward = 0
    let strafe = 0
    for (const key of held) {
      const axis = KEYS[key]
      if (!axis) continue
      forward += axis.forward
      strafe += axis.strafe
    }
    keys = combineAxes([{ forward, strafe }])
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (mode !== "walk") return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const axis = KEYS[event.key.toLowerCase()]
    if (!axis) return
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat) return
    held.add(event.key.toLowerCase())
    syncKeys()
    glide = null
  }

  const onKeyUp = (event: KeyboardEvent) => {
    const name = event.key.toLowerCase()
    if (!held.has(name)) return
    held.delete(name)
    syncKeys()
  }

  const releaseKeys = () => {
    if (held.size === 0) return
    held.clear()
    keys = ZERO
  }

  const onPointerDown = (event: PointerEvent) => {
    if (mode !== "walk") return
    if (event.pointerType === "mouse" && event.button !== 0) return
    canvas.focus({ preventScroll: true })
    look = { id: event.pointerId, x: event.clientX, y: event.clientY }
    glide = null
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!look || event.pointerId !== look.id || mode !== "walk") return
    const dx = event.clientX - look.x
    const dy = event.clientY - look.y
    look = { id: event.pointerId, x: event.clientX, y: event.clientY }
    if (dx === 0 && dy === 0) return
    const next = applyLook({ yaw: body.yaw, pitch: body.pitch, dx, dy, radiansPerPixel: LOOK_RADIANS_PER_PIXEL })
    body = { ...body, yaw: next.yaw, pitch: next.pitch }
    glide = null
    apply()
  }

  const onPointerUp = (event: PointerEvent) => {
    if (look?.id === event.pointerId) look = null
  }

  const onUpdate = (dt: number) => tick(dt)

  app.on("update", onUpdate)
  canvas.addEventListener("keydown", onKeyDown)
  canvas.addEventListener("keyup", onKeyUp)
  canvas.addEventListener("blur", releaseKeys)
  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("pointermove", onPointerMove)
  canvas.addEventListener("pointerup", onPointerUp)
  canvas.addEventListener("pointercancel", onPointerUp)

  const orbitReset = (pose: CameraPose) => {
    if (reducedMotion() || opts.getDamping() === 0) {
      snapOrbit(
        { x: pose.position[0], y: pose.position[1], z: pose.position[2] },
        { x: pose.target[0], y: pose.target[1], z: pose.target[2] },
      )
      return
    }
    controls.reset(toVec(pose.target), toVec(pose.position))
  }

  return {
    setMode: (next) => {
      if (next === mode) return
      if (next === "walk") enterWalk()
      else exitWalk()
    },
    flyTo: (pose) => {
      if (mode !== "walk") {
        orbitReset(pose)
        return
      }
      const bounds = opts.getBounds()
      const target = { x: pose.target[0], y: pose.target[1], z: pose.target[2] }
      // The authored camera spot already stands clear of the object. Drop it to eye height
      // instead of stopping a fixed distance from the target, which can sit inside a large splat.
      const stood = standAt(
        { x: pose.position[0], y: pose.position[1], z: pose.position[2] },
        target,
        bounds,
      )
      gazeDistance = clampDistance(
        Math.hypot(stood.position.x - target.x, stood.position.y - target.y, stood.position.z - target.z),
      )
      beginGlide({ ...stood.position, yaw: stood.yaw, pitch: stood.pitch })
    },
    reset: (home) => {
      if (mode !== "walk") {
        orbitReset(home)
        return
      }
      const stood = standAt(
        { x: home.position[0], y: home.position[1], z: home.position[2] },
        { x: home.target[0], y: home.target[1], z: home.target[2] },
        opts.getBounds(),
      )
      gazeDistance = clampDistance(
        Math.hypot(
          stood.position.x - home.target[0],
          stood.position.y - home.target[1],
          stood.position.z - home.target[2],
        ),
      )
      beginGlide({ ...stood.position, yaw: stood.yaw, pitch: stood.pitch })
    },
    setStick: (next) => {
      stick = next
      if (next.forward !== 0 || next.strafe !== 0) glide = null
    },
    destroy: () => {
      app.off("update", onUpdate)
      canvas.removeEventListener("keydown", onKeyDown)
      canvas.removeEventListener("keyup", onKeyUp)
      canvas.removeEventListener("blur", releaseKeys)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointercancel", onPointerUp)
      restoreUpdate()
    },
  }
}
