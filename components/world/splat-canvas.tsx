"use client"

/**
 * WebGL part of the live world. Imported only on the client (see splat-view.tsx):
 * PlayCanvas needs `window` and a canvas, so it can never render on the server.
 */
import * as React from "react"
import {
  Application,
  Asset,
  Color,
  Entity,
  FILLMODE_NONE,
  RESOLUTION_AUTO,
  Vec2,
  Vec3,
  WORKBUFFER_UPDATE_ONCE,
} from "playcanvas"
import { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs"

export type CameraPose = { position: [number, number, number]; target: [number, number, number] }

export type SplatStatus =
  | { kind: "loading"; progress: number | null }
  | { kind: "ready" }
  | { kind: "error"; message: string }

/** Where a 3D point lands on the canvas, in CSS pixels. `visible` is false behind the camera or off screen. */
export type ScreenPoint = { x: number; y: number; visible: boolean }
export type Project = (p: [number, number, number]) => ScreenPoint

/** A sphere of splats to light up in the object's colour; everything else dims a little. */
export type Focus = { center: [number, number, number]; radius: number; color: [number, number, number] }

/**
 * Per-splat tint, written into PlayCanvas's splat work buffer (`setWorkBufferModifier`).
 * It re-runs only when the focus changes, not every frame.
 * The world is one static cloud, so "the object" is the splats within a sphere around its anchor.
 */
const FOCUS_GLSL = /* glsl */ `
uniform vec3 uFocusCenter;
uniform float uFocusRadius;
uniform vec3 uFocusColor;
uniform float uFocusOn;

void modifySplatCenter(inout vec3 center) {
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
}
void modifySplatColor(vec3 center, inout vec4 color) {
  if (uFocusOn < 0.5) return;
  float d = distance(center, uFocusCenter) / uFocusRadius;
  float inside = 1.0 - smoothstep(0.75, 1.0, d);
  vec3 lit = mix(color.rgb, uFocusColor, 0.45) * 1.15;
  color.rgb = mix(color.rgb * 0.45, lit, inside);
}
`

export type SplatCanvasHandle = {
  focus: (focus: Focus | null) => void
  flyTo: (pose: CameraPose) => void
  reset: () => void
  getPose: () => CameraPose | null
}

type Props = {
  src: string
  home: CameraPose
  /** Euler angles applied to the splat entity. */
  rotation: [number, number, number]
  onStatus: (s: SplatStatus) => void
  onFirstInteraction?: () => void
  /** Called every frame after the camera moved, with a projector for 3D points. Write to the DOM here, not to state. */
  onFrame?: (project: Project) => void
}

const v = (p: [number, number, number]) => new Vec3(p[0], p[1], p[2])
const EDITABLE = "input, textarea, select, [contenteditable='true']"

export const SplatCanvas = React.forwardRef<SplatCanvasHandle, Props>(function SplatCanvas(
  { src, home, rotation, onStatus, onFirstInteraction, onFrame },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const controlsRef = React.useRef<CameraControls | null>(null)
  const cameraRef = React.useRef<Entity | null>(null)
  const splatRef = React.useRef<Entity | null>(null)
  const statusRef = React.useRef(onStatus)
  statusRef.current = onStatus
  const interactRef = React.useRef(onFirstInteraction)
  interactRef.current = onFirstInteraction
  const homeRef = React.useRef(home)
  const frameRef = React.useRef(onFrame)
  frameRef.current = onFrame

  React.useImperativeHandle(ref, () => ({
    focus: (focus) => {
      const gsplat = splatRef.current?.gsplat
      if (!gsplat) return
      gsplat.setParameter("uFocusOn", focus ? 1 : 0)
      if (focus) {
        gsplat.setParameter("uFocusCenter", focus.center)
        gsplat.setParameter("uFocusRadius", focus.radius)
        gsplat.setParameter("uFocusColor", focus.color)
      }
      gsplat.workBufferUpdate = WORKBUFFER_UPDATE_ONCE
    },
    flyTo: (pose) => controlsRef.current?.reset(v(pose.target), v(pose.position)),
    reset: () => controlsRef.current?.reset(v(homeRef.current.target), v(homeRef.current.position)),
    getPose: () => {
      const cam = cameraRef.current
      const controls = controlsRef.current
      if (!cam || !controls) return null
      const p = cam.getPosition()
      const f = cam.forward
      const d = 1.5
      const r = (n: number) => Math.round(n * 100) / 100
      return {
        position: [r(p.x), r(p.y), r(p.z)],
        target: [r(p.x + f.x * d), r(p.y + f.y * d), r(p.z + f.z * d)],
      }
    },
  }))

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let app: Application
    try {
      app = new Application(canvas, { graphicsDeviceOptions: { antialias: false } })
    } catch {
      statusRef.current({ kind: "error", message: "WebGL is not available in this browser." })
      return
    }
    app.setCanvasFillMode(FILLMODE_NONE)
    app.setCanvasResolution(RESOLUTION_AUTO)

    const resize = () => app.resizeCanvas(canvas.clientWidth, canvas.clientHeight)
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const camera = new Entity("camera")
    camera.addComponent("camera", { clearColor: new Color(0.09, 0.09, 0.1), fov: 60, nearClip: 0.01, farClip: 100 })
    camera.addComponent("script")
    camera.setPosition(v(homeRef.current.position))
    camera.lookAt(v(homeRef.current.target))
    app.root.addChild(camera)
    cameraRef.current = camera

    const controls = camera.script!.create(CameraControls) as CameraControls
    controls.enableFly = false
    controls.moveSpeed = 1
    controls.moveFastSpeed = 2
    controls.moveSlowSpeed = 0.5
    controls.zoomRange = new Vec2(0.2, 6)
    controls.reset(v(homeRef.current.target), v(homeRef.current.position))
    controlsRef.current = controls

    const asset = new Asset("world", "gsplat", { url: src })
    asset.on("progress", (received: number, total: number) =>
      statusRef.current({ kind: "loading", progress: total ? received / total : null }),
    )
    asset.ready(() => {
      const splat = new Entity("splat")
      splat.addComponent("gsplat", { asset })
      splat.setLocalEulerAngles(rotation[0], rotation[1], rotation[2])
      app.root.addChild(splat)
      splat.gsplat!.setWorkBufferModifier({ glsl: FOCUS_GLSL })
      splat.gsplat!.setParameter("uFocusOn", 0)
      splatRef.current = splat
      statusRef.current({ kind: "ready" })
    })
    asset.on("error", (err: unknown) =>
      statusRef.current({ kind: "error", message: typeof err === "string" ? err : "The world could not be loaded." }),
    )
    statusRef.current({ kind: "loading", progress: null })
    app.assets.add(asset)
    app.assets.load(asset)
    app.start()

    // Markers ride on the splat: project their anchors once per frame, after the controls moved the camera.
    const world = new Vec3()
    const screen = new Vec3()
    const toPoint = new Vec3()
    const project: Project = (p) => {
      world.set(p[0], p[1], p[2])
      toPoint.sub2(world, camera.getPosition())
      if (toPoint.dot(camera.forward) <= 0.05) return { x: 0, y: 0, visible: false }
      camera.camera!.worldToScreen(world, screen)
      const visible = screen.x >= -40 && screen.y >= -40 && screen.x <= canvas.clientWidth + 40 && screen.y <= canvas.clientHeight + 40
      return { x: screen.x, y: screen.y, visible }
    }
    const onUpdate = () => frameRef.current?.(project)
    app.on("postrender", onUpdate)
    if (process.env.NODE_ENV === "development") (window as unknown as { __pcApp?: Application }).__pcApp = app

    const first = () => {
      interactRef.current?.()
      canvas.removeEventListener("pointerdown", first)
      canvas.removeEventListener("wheel", first)
    }
    canvas.addEventListener("pointerdown", first)
    canvas.addEventListener("wheel", first, { passive: true })

    // Orbit mode ignores W/A/S/D (they only drive fly mode, which is off), so typing elsewhere can't move the camera.
    const typing = () => (document.activeElement as HTMLElement | null)?.closest?.(EDITABLE) != null
    const onKey = (e: KeyboardEvent) => {
      if (typing() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "r" || e.key === "R") {
        e.preventDefault()
        controls.reset(v(homeRef.current.target), v(homeRef.current.position))
      }
    }
    window.addEventListener("keydown", onKey)

    return () => {
      canvas.removeEventListener("pointerdown", first)
      canvas.removeEventListener("wheel", first)
      window.removeEventListener("keydown", onKey)
      app.off("postrender", onUpdate)
      observer.disconnect()
      controlsRef.current = null
      splatRef.current = null
      cameraRef.current = null
      app.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the app is created once per src
  }, [src])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full touch-none outline-none"
      aria-label="Live 3D view of the workshop. Drag to look around, scroll or pinch to zoom."
      tabIndex={0}
    />
  )
})
