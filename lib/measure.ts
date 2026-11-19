/**
 * Distance on a Gaussian-splat scan.
 *
 * One world unit is one metre. Walk already uses that: the workshop is about 12 m deep and its
 * calibrated back wall sits near z = −12.3. SpAItial built the scan from a photo, not a survey,
 * so a reading is approximate. This constant is the only scale.
 *
 * The two-point tape (end marks, a label at the midpoint) takes its idea from
 * reall3d-com/Reall3dViewer (MIT). The geometry here is not that project's code.
 */

export const SPLAT_METRES_PER_UNIT = 1

/** Further than any room. A hit past this is a missed depth, not a surface. */
export const MAX_MEASURE_UNITS = 40

/** A press that moves less than this is a point. Past it, the drag still looks around. */
export const MEASURE_DRAG_PX = 8

/** CPU fallback: a splat centre within this many pixels of the click can be the point. */
export const MEASURE_PICK_PX = 12

export type MeasurePoint = { x: number; y: number; z: number }

export type MeasureRay = { origin: MeasurePoint; direction: MeasurePoint }

export function isMeasureTap(dx: number, dy: number, slop = MEASURE_DRAG_PX) {
  return dx * dx + dy * dy <= slop * slop
}

export function distanceMetres(a: MeasurePoint, b: MeasurePoint, metresPerUnit = SPLAT_METRES_PER_UNIT) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * metresPerUnit
}

export function midpoint(a: MeasurePoint, b: MeasurePoint): MeasurePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

/**
 * Metres, with enough decimals to read a spare part: millimetres under 1 m, centimetres under
 * 10 m, and one decimal past that.
 */
export function formatMetres(metres: number) {
  if (!Number.isFinite(metres) || metres < 0) return "— m"
  const digits = metres >= 10 ? 1 : metres >= 1 ? 2 : 3
  return `${metres.toFixed(digits)} m`
}

/** A third click starts again. A finished tape stays until that new point exists. */
export function applyMeasureClick(points: readonly MeasurePoint[], hit: MeasurePoint): MeasurePoint[] {
  if (points.length >= 2) return [hit]
  return [...points, hit]
}

export type MeasureIssue = "none" | "miss" | "loading"

/** The line the status chip reads. A finished tape keeps its distance. */
export function measureStatus(points: readonly MeasurePoint[], issue: MeasureIssue) {
  if (points.length >= 2) {
    return `≈ ${formatMetres(distanceMetres(points[0], points[1]))} · approximate`
  }
  if (issue === "loading") return "The scan is still loading."
  if (issue === "miss") {
    return points.length === 1
      ? "No surface there. Click a second point on the scan."
      : "No surface there. Click the scan."
  }
  if (points.length === 1) return "Click the second point. Esc clears."
  return "Click two points. Esc clears. Distances are approximate."
}

/** World radius at distance 1 for `radiusPx` on a pinhole camera of this vertical field of view. */
export function pixelRadiusFactor(fovDeg: number, viewportHeight: number, radiusPx: number) {
  const half = ((fovDeg * Math.PI) / 180) / 2
  return (radiusPx / Math.max(1, viewportHeight)) * 2 * Math.tan(half)
}

const CELL = 0.5
const CELL_OFF = 200
const CELL_SPAN = 512

function cellKey(x: number, y: number, z: number) {
  const ix = Math.floor(x / CELL) + CELL_OFF
  const iy = Math.floor(y / CELL) + CELL_OFF
  const iz = Math.floor(z / CELL) + CELL_OFF
  if (ix < 0 || iy < 0 || iz < 0 || ix >= CELL_SPAN || iy >= CELL_SPAN || iz >= CELL_SPAN) return -1
  return ix | (iy << 9) | (iz << 18)
}

export type CenterGrid = {
  centers: Float32Array
  buckets: Map<number, Uint32Array>
  /** Reused so a click does not allocate a flag per splat. */
  seen: Uint32Array
  stamp: number
}

/**
 * Splat centres grouped into 0.5 m cells, so a click does not walk the whole cloud.
 * Centres outside ±100 m are dropped: no room is that large, and a stray gaussian is not a surface.
 */
export function buildCenterGrid(centers: Float32Array): CenterGrid {
  const lists = new Map<number, number[]>()
  const count = Math.floor(centers.length / 3)
  for (let i = 0; i < count; i++) {
    const key = cellKey(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2])
    if (key < 0) continue
    const list = lists.get(key)
    if (list) list.push(i)
    else lists.set(key, [i])
  }
  const buckets = new Map<number, Uint32Array>()
  for (const [key, list] of lists) buckets.set(key, Uint32Array.from(list))
  return { centers, buckets, seen: new Uint32Array(count), stamp: 1 }
}

/**
 * Nearest splat centre in front of the camera, within `radiusFactor` times its distance of the ray.
 * The centre sits inside the gaussian, so this is a fallback for when the depth pick has no surface.
 */
export function raycastCenters(grid: CenterGrid, ray: MeasureRay, radiusFactor: number, maxT = MAX_MEASURE_UNITS): MeasurePoint | null {
  const len = Math.hypot(ray.direction.x, ray.direction.y, ray.direction.z)
  if (!(len > 0) || !(radiusFactor > 0)) return null
  const dx = ray.direction.x / len
  const dy = ray.direction.y / len
  const dz = ray.direction.z / len
  const { origin, centers } = { origin: ray.origin, centers: grid.centers }
  const seen = grid.seen
  let stamp = grid.stamp + 1
  if (stamp === 0xffffffff) {
    seen.fill(0)
    stamp = 1
  }
  grid.stamp = stamp
  let bestT = Infinity
  let best: MeasurePoint | null = null

  const consider = (index: number) => {
    if (seen[index] === stamp) return
    seen[index] = stamp
    const cx = centers[index * 3]
    const cy = centers[index * 3 + 1]
    const cz = centers[index * 3 + 2]
    const ox = cx - origin.x
    const oy = cy - origin.y
    const oz = cz - origin.z
    const t = ox * dx + oy * dy + oz * dz
    if (t < 0.05 || t > maxT || t >= bestT) return
    const perp2 = ox * ox + oy * oy + oz * oz - t * t
    const limit = t * radiusFactor
    if (perp2 > limit * limit) return
    bestT = t
    best = { x: cx, y: cy, z: cz }
  }

  const step = CELL * 0.5
  for (let t = 0.05; t <= maxT; t += step) {
    // Samples overlap by a cell, so anything closer than `bestT` has already been tested.
    if (best && t > bestT + CELL * 2) break
    const x = origin.x + dx * t
    const y = origin.y + dy * t
    const z = origin.z + dz * t
    const reach = Math.max(1, Math.ceil((t * radiusFactor) / CELL))
    const ix = Math.floor(x / CELL)
    const iy = Math.floor(y / CELL)
    const iz = Math.floor(z / CELL)
    for (let oz = -reach; oz <= reach; oz++) {
      for (let oy = -reach; oy <= reach; oy++) {
        for (let ox = -reach; ox <= reach; ox++) {
          const key = cellKey((ix + ox + 0.5) * CELL, (iy + oy + 0.5) * CELL, (iz + oz + 0.5) * CELL)
          const bucket = key < 0 ? undefined : grid.buckets.get(key)
          if (!bucket) continue
          for (let i = 0; i < bucket.length; i++) consider(bucket[i])
        }
      }
    }
  }
  return best
}
