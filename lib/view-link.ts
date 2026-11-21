import type { CameraPose } from "@/lib/data"

/** Farther than any room, so a pasted `cam` cannot send the camera into nowhere. */
const LIMIT = 80

function round2(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** `px,py,pz,tx,ty,tz`, two decimals. Position is where the camera stands, target is where it looks. */
export function formatCamera(pose: CameraPose): string {
  return [...pose.position, ...pose.target].map(round2).join(",")
}

/**
 * The `cam` query value, or null when it is missing or not a camera.
 * Six finite numbers, inside the room's neighbourhood, with a real look direction.
 */
export function parseCamera(raw: string | null | undefined): CameraPose | null {
  if (!raw) return null
  const parts = raw.split(",")
  if (parts.length !== 6) return null
  const nums = parts.map((part) => Number(part.trim()))
  if (nums.some((n) => !Number.isFinite(n) || Math.abs(n) > LIMIT)) return null
  const [px, py, pz, tx, ty, tz] = nums as [number, number, number, number, number, number]
  const dx = tx - px
  const dy = ty - py
  const dz = tz - pz
  if (dx * dx + dy * dy + dz * dz < 1e-6) return null
  return { position: [px, py, pz], target: [tx, ty, tz] }
}
