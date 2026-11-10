import { SCENE, type Point } from "@/lib/data"

/**
 * Lifting the still's 2D masks onto the live world.
 *
 * The world is one static splat cloud: no splat knows which object it belongs to. But the still frame was
 * taken from a known camera, so every splat lands on a pixel of the still.
 * A splat belongs to an object when it lands inside the object's mask and sits at the object's depth,
 * not on the wall behind it.
 */

/**
 * The still's camera, calibrated by laying the still over the live render at 50% and moving the camera until
 * the two lined up (back wall, table, motors, pallet): 52° vertical FOV, 0.2 below the world's origin, pitched
 * 3.3° down. Not the viewer's start camera (that one is wider for comfort), so the two views differ a little.
 */
export const STILL_CAMERA = { fovY: 52, y: -0.2, pitchDown: 3.3 }
const TAN = Math.tan(((STILL_CAMERA.fovY / 2) * Math.PI) / 180)
const ASPECT = SCENE.width / SCENE.height
const SIN = Math.sin((STILL_CAMERA.pitchDown * Math.PI) / 180)
const COS = Math.cos((STILL_CAMERA.pitchDown * Math.PI) / 180)

/** The ID mask is drawn at a quarter of the still's size: plenty for a mask, cheap to upload. */
export const MASK_SCALE = 0.25
export const MASK_W = Math.round(SCENE.width * MASK_SCALE)
export const MASK_H = Math.round(SCENE.height * MASK_SCALE)

/** `depth`: how far the object is from the still's camera, when known (the hand-measured pose target). */
export type MaskObject = { id: string; polygon: Point[]; depth?: number }

/** What the live view needs per object: the depth band its splats live in, and their centre for the marker. */
export type SplatStats = { maskId: number; near: number; far: number; anchor: [number, number, number]; count: number }

/** Still-frame pixel of a world point, or null behind the camera. Same maths as the shader's. */
function toStill(x: number, y: number, z: number): [number, number] | null {
  const yr = y - STILL_CAMERA.y
  const depth = -z * COS - yr * SIN
  if (depth < 0.05) return null
  const yc = yr * COS - z * SIN
  const nx = x / depth / (TAN * ASPECT)
  const ny = yc / depth / TAN
  return [((nx + 1) / 2) * MASK_W, ((1 - ny) / 2) * MASK_H]
}

/** Red value per mask id, spaced out so the canvas's anti-aliased edges can be snapped back (see below). */
export const ID_STEP = 30

/**
 * Draws each object's polygon in its own red value (id × ID_STEP) on a black canvas; 0 means "no object".
 * Canvas paths are always anti-aliased, so edge pixels get in-between reds that would read as another object:
 * afterwards every pixel snaps to its id if it's close, or to 0.
 */
export function drawIdMask(objects: MaskObject[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = MASK_W
  canvas.height = MASK_H
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, MASK_W, MASK_H)
  objects.forEach((o, i) => {
    ctx.fillStyle = `rgb(${(i + 1) * ID_STEP}, 0, 0)`
    ctx.beginPath()
    o.polygon.forEach(([x, y], j) => (j ? ctx.lineTo(x * MASK_SCALE, y * MASK_SCALE) : ctx.moveTo(x * MASK_SCALE, y * MASK_SCALE)))
    ctx.closePath()
    ctx.fill()
    // Grow each mask a little: the calibration is by eye, and thin objects would otherwise lose their edges.
    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = 4
    ctx.lineJoin = "round"
    ctx.stroke()
  })
  const image = ctx.getImageData(0, 0, MASK_W, MASK_H)
  const px = image.data
  for (let k = 0; k < px.length; k += 4) {
    const id = Math.round(px[k] / ID_STEP)
    px[k] = Math.abs(px[k] - id * ID_STEP) <= 6 ? id : 0
    px[k + 1] = 0
    px[k + 2] = 0
    px[k + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

const quantile = (sorted: Float32Array, q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

/**
 * One pass over all splat centres. Per object: the depths of splats inside its mask. The band sits around the
 * object's known depth, give or take its own size; without one, around the nearest cluster in the mask (things in
 * front of the wall). The anchor is the mean of the splats inside the mask and the band.
 */
export function measureObjects(centers: Float32Array, mask: HTMLCanvasElement, objects: MaskObject[]) {
  const ids = mask.getContext("2d")!.getImageData(0, 0, MASK_W, MASK_H).data
  const depths: number[][] = objects.map(() => [])
  for (let i = 0; i < centers.length; i += 3) {
    const px = toStill(centers[i], centers[i + 1], centers[i + 2])
    if (!px) continue
    const u = px[0] | 0
    const v = px[1] | 0
    if (u < 0 || v < 0 || u >= MASK_W || v >= MASK_H) continue
    const id = ids[(v * MASK_W + u) * 4]
    if (id) depths[id - 1].push(-centers[i + 2])
  }

  /** Mean of the splats inside object `id`'s mask and the depth band. */
  const centreIn = (id: number, near: number, far: number) => {
    let sx = 0
    let sy = 0
    let sz = 0
    let n = 0
    for (let k = 0; k < centers.length; k += 3) {
      const d = -centers[k + 2]
      if (d < near || d > far) continue
      const px = toStill(centers[k], centers[k + 1], centers[k + 2])
      if (!px) continue
      const u = px[0] | 0
      const v = px[1] | 0
      if (u < 0 || v < 0 || u >= MASK_W || v >= MASK_H || ids[(v * MASK_W + u) * 4] !== id) continue
      sx += centers[k]
      sy += centers[k + 1]
      sz += centers[k + 2]
      n++
    }
    return { anchor: [sx / n, sy / n, sz / n] as [number, number, number], count: n }
  }

  const stats = new Map<string, SplatStats>()
  objects.forEach((o, i) => {
    if (depths[i].length < 20) return
    const sorted = Float32Array.from(depths[i]).sort()
    let minX = Infinity
    let maxX = -Infinity
    for (const [x] of o.polygon) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
    const widthAt = (depth: number) => ((maxX - minX) / (SCENE.height / 2 / TAN)) * depth

    // Without a hint: the nearest cluster in the mask (things in front of the wall).
    const front = quantile(sorted, 0.03)
    let near = front - 0.15
    let far = Math.max(quantile(sorted, 0.25), front + widthAt(front))
    let centre = centreIn(i + 1, near, far)

    // A known depth wins when the object is really there: the mask can also catch things in front of it
    // (the cabinet sits behind the table). A hint with almost no splats around it was measured wrong.
    if (o.depth) {
      const half = Math.max(0.5, widthAt(o.depth) * 0.75)
      const hinted = centreIn(i + 1, o.depth - half, o.depth + half)
      if (hinted.count >= 200) {
        near = o.depth - half
        far = o.depth + half
        centre = hinted
      }
    }
    // Too few splats to trust (a small object, or the mask missed it): keep the hand-measured marker, no tint.
    if (centre.count < 150) return
    stats.set(o.id, { maskId: i + 1, near, far, anchor: centre.anchor, count: centre.count })
  })
  return stats
}

/** The same projection, in GLSL, for the work-buffer tint. Kept next to `toStill` so they can't drift apart. */
export const STILL_PROJECT_GLSL = /* glsl */ `
vec2 toStillUv(vec3 c) {
  float yr = c.y - (${STILL_CAMERA.y.toFixed(6)});
  float depth = -c.z * ${COS.toFixed(6)} - yr * ${SIN.toFixed(6)};
  float yc = yr * ${COS.toFixed(6)} - c.z * ${SIN.toFixed(6)};
  float nx = c.x / depth / ${(TAN * ASPECT).toFixed(6)};
  float ny = yc / depth / ${TAN.toFixed(6)};
  return vec2((nx + 1.0) * 0.5, (1.0 - ny) * 0.5);
}
`
