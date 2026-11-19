/**
 * A point on the scan, for Measure.
 *
 * First choice is PlayCanvas's depth picker: it redraws the splat for that click and reads the
 * depth of the gaussian the renderer actually shows. That is the visible surface, not a mesh,
 * and a thin or half-transparent edge can sit a few centimetres off.
 *
 * On WebGL the unified splat path sorts on the CPU, and that renderer does not implement the
 * engine's gsplat pick dispatch. When the depth read comes back empty, the click falls back to
 * the nearest splat centre within a few pixels. The centre is inside the blob, so that point is
 * the coarser of the two.
 */
import { Picker, Vec3, type Application, type Entity } from "playcanvas"
import {
  MAX_MEASURE_UNITS,
  MEASURE_PICK_PX,
  buildCenterGrid,
  pixelRadiusFactor,
  raycastCenters,
  type CenterGrid,
  type MeasurePoint,
} from "@/lib/measure"

export type SurfacePick =
  | { status: "hit"; point: MeasurePoint; source: "depth" | "centre" }
  | { status: "miss" }
  | { status: "loading" }
  | { status: "stale" }

/** Longest edge of the depth buffer. Full canvas resolution makes the extra splat draw stall a click. */
const MAX_PICK_EDGE = 512

export function createSurfacePicker(opts: {
  app: Application
  camera: Entity
  getSplat: () => Entity | null
}) {
  const { app, camera } = opts
  let picker: Picker | null = null
  let generation = 0
  let grid: CenterGrid | null = null
  let gridFrom: Float32Array | null = null
  const nearPoint = new Vec3()
  const farPoint = new Vec3()

  const centersOf = () => {
    const splat = opts.getSplat()
    const resource = splat?.gsplat?.resource as { centers?: Float32Array } | null | undefined
    const centers = resource?.centers
    if (!centers || centers.length < 3) return null
    return centers
  }

  const prepare = () => {
    const centers = centersOf()
    if (!centers || centers === gridFrom) return
    gridFrom = centers
    grid = buildCenterGrid(centers)
  }

  const inFront = (eye: Vec3, forward: Vec3, point: MeasurePoint) => {
    const dx = point.x - eye.x
    const dy = point.y - eye.y
    const dz = point.z - eye.z
    const along = dx * forward.x + dy * forward.y + dz * forward.z
    return Number.isFinite(along) && along > 0.05 && along < MAX_MEASURE_UNITS
  }

  const pickDepth = async (x: number, y: number, token: number): Promise<MeasurePoint | null> => {
    const cam = camera.camera
    if (!cam) return null
    const width = Math.max(1, app.graphicsDevice.clientRect.width)
    const height = Math.max(1, app.graphicsDevice.clientRect.height)
    const scale = Math.min(1, MAX_PICK_EDGE / Math.max(width, height))
    if (!picker) picker = new Picker(app, Math.floor(width * scale), Math.floor(height * scale), true)
    picker.resize(Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale)))
    try {
      picker.prepare(cam, app.scene)
    } catch {
      return null
    }
    if (token !== generation) return null
    const world = await picker.getWorldPointAsync(x * scale, y * scale)
    if (token !== generation || !world) return null
    return { x: world.x, y: world.y, z: world.z }
  }

  const pickCentre = (x: number, y: number): MeasurePoint | null => {
    const cam = camera.camera
    if (!cam || !grid) return null
    const height = Math.max(1, app.graphicsDevice.clientRect.height)
    cam.screenToWorld(x, y, cam.nearClip, nearPoint)
    cam.screenToWorld(x, y, cam.farClip, farPoint)
    return raycastCenters(
      grid,
      {
        origin: { x: nearPoint.x, y: nearPoint.y, z: nearPoint.z },
        direction: { x: farPoint.x - nearPoint.x, y: farPoint.y - nearPoint.y, z: farPoint.z - nearPoint.z },
      },
      pixelRadiusFactor(cam.fov, height, MEASURE_PICK_PX),
    )
  }

  return {
    prepare,
    destroy() {
      generation++
      picker?.destroy()
      picker = null
      grid = null
      gridFrom = null
    },
    async pick(x: number, y: number): Promise<SurfacePick> {
      const token = ++generation
      const cam = camera.camera
      if (!opts.getSplat()?.gsplat || !cam) return { status: "loading" }
      prepare()
      // Captured before the depth read: a second click may move the camera while this one is in flight.
      const eye = camera.getPosition().clone()
      const forward = camera.forward.clone()
      const depth = await pickDepth(x, y, token)
      if (token !== generation) return { status: "stale" }
      if (depth && inFront(eye, forward, depth)) return { status: "hit", point: depth, source: "depth" }
      // The depth pass can miss a sparse gaussian. The centre index was built for that click.
      const centre = pickCentre(x, y)
      if (token !== generation) return { status: "stale" }
      if (centre && inFront(eye, forward, centre)) return { status: "hit", point: centre, source: "centre" }
      return camera.camera ? { status: "miss" } : { status: "loading" }
    },
  }
}
