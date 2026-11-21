"use client"

/**
 * WebGL part of the live world. Imported only on the client (see splat-view.tsx):
 * PlayCanvas needs `window` and a canvas, so it can never render on the server.
 */
import * as React from "react"
import {
  ADDRESS_CLAMP_TO_EDGE,
  Application,
  Asset,
  Color,
  Entity,
  FILLMODE_NONE,
  FILTER_NEAREST,
  PIXELFORMAT_RGBA8,
  RESOLUTION_AUTO,
  Texture,
  Vec2,
  Vec3,
  WORKBUFFER_UPDATE_ONCE,
} from "playcanvas"
import { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs"
import { STILL_PROJECT_GLSL } from "@/lib/splat-mask"
import type { CameraView } from "@/lib/minimap"
import type { Aabb, LocomotionMode, Stick } from "@/lib/walk"
import { useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { createGestureTracker, trackGesture, type GestureId } from "@/lib/shortcut-learning"
import { attachWalkRig, type WalkRig } from "@/components/world/walk-rig"
import { WalkPad } from "@/components/world/walk-pad"
import { createSurfacePicker, type SurfacePick } from "@/components/world/splat-pick"
import { isMeasureTap } from "@/lib/measure"

export type CameraPose = { position: [number, number, number]; target: [number, number, number] }

export type SplatStatus =
  | { kind: "loading"; progress: number | null }
  | { kind: "ready" }
  | { kind: "error"; message: string }

/**
 * Where a 3D point lands on the canvas, in CSS pixels.
 * `inFront` is false only behind the camera. `visible` is on screen. A point in front but off
 * the screen still has coordinates, so a floor path can run in from the edge.
 */
export type ScreenPoint = { x: number; y: number; visible: boolean; inFront: boolean }
export type Project = (p: [number, number, number]) => ScreenPoint

/** Light up the splats of one object: inside its still-frame mask and within its depth band. The rest dims. */
export type Focus = { maskId: number; near: number; far: number; color: [number, number, number] }

/**
 * Per-splat tint, written into PlayCanvas's splat work buffer (`setWorkBufferModifier`), re-run only when the
 * focus changes. Each splat is projected into the still with the still's camera; it's part of the object when
 * it lands on the object's colour in the ID mask and sits in the object's depth band (not the wall behind).
 */
const FOCUS_GLSL = /* glsl */ `
uniform sampler2D uObjectMask;
// Packed in two vec4s: separate float uniforms next to the sampler didn't reach this pass.
uniform vec4 uFocusBand; // mask id, near, far, on
uniform vec4 uFocusTint; // rgb
${STILL_PROJECT_GLSL}
void modifySplatCenter(inout vec3 center) {
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
}
void modifySplatColor(vec3 center, inout vec4 color) {
  if (uFocusBand.w < 0.5) return;
  float dist = -center.z;
  vec2 stillUv = toStillUv(center);
  float maskId = texture(uObjectMask, clamp(stillUv, 0.0, 1.0)).r * 255.0;
  float inFrame = step(0.0, stillUv.x) * step(0.0, stillUv.y) * step(stillUv.x, 1.0) * step(stillUv.y, 1.0);
  float onObject = inFrame * step(abs(maskId - uFocusBand.x), 0.5) * step(uFocusBand.y, dist) * step(dist, uFocusBand.z);
  color.rgb = mix(color.rgb * 0.5, mix(color.rgb, uFocusTint.rgb, 0.6), onObject);
}
`

export type SplatCanvasHandle = {
  focus: (focus: Focus | null) => void
  /** Hands the still's object ID mask to the tint shader. */
  setObjectMask: (mask: HTMLCanvasElement) => void
  /** Splat centres (x, y, z per splat), once the world is loaded. */
  centers: () => Float32Array | null
  flyTo: (pose: CameraPose) => void
  reset: () => void
  /** Stop an in-flight `flyTo` and leave the camera where it is. */
  hold: () => void
  getPose: () => CameraPose | null
}

type Props = {
  src: string
  home: CameraPose
  /** Euler angles applied to the splat entity. */
  rotation: [number, number, number]
  /** Back-buffer scale. Changing it resizes the canvas and does not reload the splat. */
  pixelRatio?: number
  /**
   * How fast `flyTo` and `reset` settle: the share of the way left after each millisecond (ease-out).
   * 0 jumps at once. Leave unset for the controls' own default.
   */
  focusDamping?: number
  /**
   * `src` is a streamed `lod-meta.json`: show the coarsest level first, then let the engine stream detail up to
   * `splatBudget` splats (0 = no limit). Timings land in `window.__splatTimings`.
   */
  lod?: { splatBudget: number }
  onStatus: (s: SplatStatus) => void
  onFirstInteraction?: () => void
  /** Orbit, or first-person walk. Walk ignores keys unless this canvas is focused. */
  locomotion?: LocomotionMode
  /** Room walls from the minimap calibration, with eye height as the vertical lock. */
  bounds: Aabb
  /** Measure is on: a short press reads a point on the scan. A drag still looks around. */
  measuring?: boolean
  onMeasurePick?: (pick: SurfacePick) => void
  /**
   * Called every frame after the camera moved, with a projector for 3D points and where the camera stands and
   * looks on the floor. Write to the DOM here, not to state.
   */
  onFrame?: (project: Project, view: CameraView) => void
}

const v = (p: [number, number, number]) => new Vec3(p[0], p[1], p[2])
const EDITABLE = "input, textarea, select, [contenteditable='true']"

export const SplatCanvas = React.forwardRef<SplatCanvasHandle, Props>(function SplatCanvas(
  {
    src,
    home,
    rotation,
    pixelRatio = 1,
    focusDamping,
    lod,
    onStatus,
    onFirstInteraction,
    onFrame,
    locomotion = "orbit",
    bounds,
    measuring = false,
    onMeasurePick,
  },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const { noteKey, noteGesture } = useShortcutLearning()
  const noteKeyRef = React.useRef(noteKey)
  const noteGestureRef = React.useRef(noteGesture)
  noteKeyRef.current = noteKey
  noteGestureRef.current = noteGesture
  const controlsRef = React.useRef<CameraControls | null>(null)
  const cameraRef = React.useRef<Entity | null>(null)
  const splatRef = React.useRef<Entity | null>(null)
  const appRef = React.useRef<Application | null>(null)
  const maskRef = React.useRef<Texture | null>(null)
  const statusRef = React.useRef(onStatus)
  statusRef.current = onStatus
  const interactRef = React.useRef(onFirstInteraction)
  interactRef.current = onFirstInteraction
  const homeRef = React.useRef(home)
  const frameRef = React.useRef(onFrame)
  frameRef.current = onFrame
  const ratioRef = React.useRef(pixelRatio)
  ratioRef.current = pixelRatio
  const lodRef = React.useRef(lod)
  const dampingRef = React.useRef(focusDamping)
  dampingRef.current = focusDamping
  const locomotionRef = React.useRef(locomotion)
  locomotionRef.current = locomotion
  const boundsRef = React.useRef(bounds)
  boundsRef.current = bounds
  const rigRef = React.useRef<WalkRig | null>(null)
  const pickApi = React.useRef<ReturnType<typeof createSurfacePicker> | null>(null)
  const measurePickRef = React.useRef(onMeasurePick)
  measurePickRef.current = onMeasurePick

  React.useImperativeHandle(ref, () => ({
    focus: (focus) => {
      const gsplat = splatRef.current?.gsplat
      if (!gsplat) return
      gsplat.setParameter("uFocusBand", focus ? [focus.maskId, focus.near, focus.far, 1] : [0, 0, 0, 0])
      if (focus) gsplat.setParameter("uFocusTint", [...focus.color, 0])
      gsplat.workBufferUpdate = WORKBUFFER_UPDATE_ONCE
    },
    setObjectMask: (mask) => {
      const gsplat = splatRef.current?.gsplat
      const app = appRef.current
      if (!gsplat || !app) return
      maskRef.current?.destroy()
      const texture = new Texture(app.graphicsDevice, {
        name: "object-mask",
        width: mask.width,
        height: mask.height,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
      })
      texture.setSource(mask)
      maskRef.current = texture
      gsplat.setParameter("uObjectMask", texture)
      gsplat.workBufferUpdate = WORKBUFFER_UPDATE_ONCE
    },
    centers: () => {
      // A streamed (octree) resource has no centres; its object stats come precomputed.
      const resource = splatRef.current?.gsplat?.resource as { centers?: Float32Array } | null | undefined
      return resource?.centers ?? null
    },
    flyTo: (pose) => rigRef.current?.flyTo(pose),
    reset: () => rigRef.current?.reset(homeRef.current),
    hold: () => rigRef.current?.hold(),
    getPose: () => {
      const cam = cameraRef.current
      const controls = controlsRef.current
      if (!cam || !controls) return null
      const p = cam.getPosition()
      const f = cam.forward
      const focus = controls.focusPoint
      const fx = focus.x - p.x
      const fy = focus.y - p.y
      const fz = focus.z - p.z
      const along = fx * f.x + fy * f.y + fz * f.z
      const len2 = fx * fx + fy * fy + fz * fz
      // Orbit looks at its focus, so the link keeps the zoom. Walk leaves that point behind.
      const useFocus = len2 > 1e-4 && along * along > 0.98 * 0.98 * len2 && along > 0.15 && along < 40
      const r = (n: number) => Math.round(n * 100) / 100
      return {
        position: [r(p.x), r(p.y), r(p.z)],
        target: useFocus
          ? [r(focus.x), r(focus.y), r(focus.z)]
          : [r(p.x + f.x * 1.5), r(p.y + f.y * 1.5), r(p.z + f.z * 1.5)],
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
    app.graphicsDevice.maxPixelRatio = ratioRef.current

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
    if (dampingRef.current !== undefined) controls.focusDamping = dampingRef.current
    controls.reset(v(homeRef.current.target), v(homeRef.current.position))
    controlsRef.current = controls

    const surface = createSurfacePicker({
      app,
      camera,
      getSplat: () => splatRef.current,
    })
    pickApi.current = surface

    const rig = attachWalkRig({
      app,
      canvas,
      camera,
      controls,
      getBounds: () => boundsRef.current,
      getDamping: () => dampingRef.current,
    })
    rigRef.current = rig
    rig.setMode(locomotionRef.current)

    // Load timings for the .sog vs streamed comparison, from the start of this world's load.
    const t0 = performance.now()
    const timings: Record<string, number> = {}
    const mark = (name: string) => {
      if (timings[name] !== undefined) return
      timings[name] = Math.round(performance.now() - t0)
      ;(window as unknown as { __splatTimings?: object }).__splatTimings = { src, ...timings }
      console.info(`[splat] ${name}: ${timings[name]} ms`, src)
    }
    const lodConfig = lodRef.current
    if (lodConfig) app.scene.gsplat.splatBudget = lodConfig.splatBudget
    let unclamped = false
    // "Ready" is also reported before anything was requested, so a phase only counts once loading was seen.
    let sawLoading = false
    // Fires every frame with whether all the detail the view wants is resident, and how much is still loading.
    app.systems.gsplat?.on("frame:ready", (_camera: unknown, _layer: unknown, ready: boolean, loading: number) => {
      const comp = splatRef.current?.gsplat
      if (!comp) return
      if (loading > 0) sawLoading = true
      if (!lodConfig) {
        if (ready) mark("fullDetail")
        return
      }
      if (!ready || loading > 0 || !sawLoading) return
      if (!unclamped) {
        // The coarse level is on screen: now let the engine stream the detail the camera needs.
        mark("firstView")
        unclamped = true
        sawLoading = false
        comp.lodRangeMin = 0
        comp.lodRangeMax = 1000
      } else {
        mark("fullDetail")
      }
    })

    const asset = new Asset("world", "gsplat", { url: src })
    asset.on("progress", (received: number, total: number) =>
      statusRef.current({ kind: "loading", progress: total ? received / total : null }),
    )
    asset.ready(() => {
      const splat = new Entity("splat")
      splat.addComponent("gsplat", { asset, unified: true })
      const octree = (splat.gsplat!.resource as { octree?: { lodLevels?: number } } | null)?.octree
      if (lodConfig && octree?.lodLevels) {
        // Coarsest level only for the fastest first view.
        splat.gsplat!.lodRangeMin = splat.gsplat!.lodRangeMax = octree.lodLevels - 1
      }
      mark(lodConfig ? "manifest" : "downloaded")
      splat.setLocalEulerAngles(rotation[0], rotation[1], rotation[2])
      app.root.addChild(splat)
      splat.gsplat!.setWorkBufferModifier({ glsl: FOCUS_GLSL })
      splat.gsplat!.setParameter("uFocusBand", [0, 0, 0, 0])
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
    appRef.current = app

    // Markers ride on the splat: project their anchors once per frame, after the controls moved the camera.
    const world = new Vec3()
    const screen = new Vec3()
    const toPoint = new Vec3()
    const project: Project = (p) => {
      world.set(p[0], p[1], p[2])
      toPoint.sub2(world, camera.getPosition())
      if (toPoint.dot(camera.forward) <= 0.05) return { x: 0, y: 0, visible: false, inFront: false }
      camera.camera!.worldToScreen(world, screen)
      const visible = screen.x >= -40 && screen.y >= -40 && screen.x <= canvas.clientWidth + 40 && screen.y <= canvas.clientHeight + 40
      return { x: screen.x, y: screen.y, visible, inFront: true }
    }
    const view: CameraView = { x: 0, z: 0, fx: 0, fz: -1, hfov: 1 }
    const onUpdate = () => {
      const fn = frameRef.current
      if (!fn) return
      const p = camera.getPosition()
      const f = camera.forward
      const flat = Math.hypot(f.x, f.z) || 1
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
      view.x = p.x
      view.z = p.z
      view.fx = f.x / flat
      view.fz = f.z / flat
      view.hfov = 2 * Math.atan(Math.tan(((camera.camera!.fov / 2) * Math.PI) / 180) * aspect)
      fn(project, view)
    }
    app.on("postrender", onUpdate)
    if (process.env.NODE_ENV === "development") (window as unknown as { __pcApp?: Application }).__pcApp = app

    const firstDrag = () => {
      interactRef.current?.()
      canvas.removeEventListener("pointerdown", firstDrag)
    }
    canvas.addEventListener("pointerdown", firstDrag)

    // R resets from anywhere that isn't a field or a menu. Walk's own keys are on the canvas, so they never reach search.
    const typing = () => (document.activeElement as HTMLElement | null)?.closest?.(EDITABLE) != null
    const onKey = (e: KeyboardEvent) => {
      if (typing() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (document.querySelector("[role='menu'], [role='alertdialog'], [role='dialog']")) return
      if (e.key === "r" || e.key === "R") {
        e.preventDefault()
        rig.reset(homeRef.current)
        noteKeyRef.current("reset")
      }
    }
    window.addEventListener("keydown", onKey)

    return () => {
      canvas.removeEventListener("pointerdown", firstDrag)
      window.removeEventListener("keydown", onKey)
      app.off("postrender", onUpdate)
      observer.disconnect()
      rig.destroy()
      rigRef.current = null
      surface.destroy()
      pickApi.current = null
      controlsRef.current = null
      splatRef.current = null
      maskRef.current?.destroy()
      maskRef.current = null
      appRef.current = null
      cameraRef.current = null
      app.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the app is created once per src
  }, [src])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const tracker = createGestureTracker()
    const onPointer = (phase: "down" | "move" | "up") => (event: PointerEvent) => {
      const gesture: GestureId | null = trackGesture(tracker, {
        phase,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
      })
      if (gesture) noteGestureRef.current(gesture)
    }
    const down = onPointer("down")
    const move = onPointer("move")
    const up = onPointer("up")
    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerup", up)
    canvas.addEventListener("pointercancel", up)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", up)
    }
  }, [])

  React.useEffect(() => {
    if (focusDamping !== undefined && controlsRef.current) controlsRef.current.focusDamping = focusDamping
  }, [focusDamping])

  React.useEffect(() => {
    rigRef.current?.setMode(locomotion)
  }, [locomotion])

  // A short press places a point. The camera keeps the drag, so looking around still works.
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !measuring) return
    pickApi.current?.prepare()
    let down: { id: number; x: number; y: number } | null = null
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      down = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const onUp = (event: PointerEvent) => {
      if (!down || event.pointerId !== down.id) return
      const start = down
      down = null
      if (!isMeasureTap(event.clientX - start.x, event.clientY - start.y)) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const api = pickApi.current
      if (!api) return
      void api.pick(x, y).then((pick) => {
        if (pick.status === "stale") return
        measurePickRef.current?.(pick)
      })
    }
    const onCancel = (event: PointerEvent) => {
      if (down?.id === event.pointerId) down = null
    }
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointercancel", onCancel)
    return () => {
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onCancel)
    }
  }, [measuring])

  const onStick = React.useCallback((stick: Stick) => {
    rigRef.current?.setStick(stick)
  }, [])

  React.useEffect(() => {
    const app = appRef.current
    const canvas = canvasRef.current
    if (!app || !canvas) return
    app.graphicsDevice.maxPixelRatio = pixelRatio
    app.resizeCanvas(canvas.clientWidth, canvas.clientHeight)
  }, [pixelRatio])

  return (
    <>
      <canvas
        ref={canvasRef}
        data-locomotion={locomotion}
        data-measuring={measuring ? "on" : "off"}
        className={
          measuring
            ? "absolute inset-0 size-full cursor-crosshair touch-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
            : locomotion === "walk"
              ? "absolute inset-0 size-full touch-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
              : "absolute inset-0 size-full cursor-grab touch-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white active:cursor-grabbing"
        }
        aria-label={
          measuring
            ? "Measuring. Click two points on the scan. Escape clears. Drag still looks around."
            : locomotion === "walk"
              ? "Live 3D view of the room. Drag to look. When this view is focused, WASD or arrow keys walk at eye height inside the room."
              : "Live 3D view of the room. Drag to look around, scroll or pinch to zoom."
        }
        tabIndex={0}
      />
      <WalkPad active={locomotion === "walk"} onStick={onStick} />
    </>
  )
})
