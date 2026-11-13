/** Drawing-buffer scale for the live world. Does not reload the splat. */
export type SplatQuality = "auto" | "high" | "low"

export const SPLAT_QUALITIES: { id: SplatQuality; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "high", label: "High" },
  { id: "low", label: "Low" },
]

/**
 * Pixel ratio handed to PlayCanvas `graphicsDevice.maxPixelRatio`.
 * Low is 1×. High uses the screen's ratio, capped at 2. Auto sits between them on retina
 * screens so the three settings are actually different, and matches the screen on 1× displays.
 */
export function pixelRatioFor(quality: SplatQuality): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  if (quality === "low") return 1
  if (quality === "high") return Math.min(2, dpr)
  return Math.min(1.5, dpr)
}

export function isSplatQuality(value: unknown): value is SplatQuality {
  return value === "auto" || value === "high" || value === "low"
}
