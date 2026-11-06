import type { Point } from "@/lib/data"

export function centroid(points: Point[]): Point {
  let x = 0
  let y = 0
  for (const [px, py] of points) {
    x += px
    y += py
  }
  return [x / points.length, y / points.length]
}

export function bounds(points: Point[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { width: maxX - minX, height: maxY - minY }
}

/** Maps scene coordinates to container pixels, matching object-fit: contain / preserveAspectRatio meet. */
export function containMapping(containerW: number, containerH: number, sceneW: number, sceneH: number) {
  const k = Math.min(containerW / sceneW, containerH / sceneH)
  return { k, offsetX: (containerW - sceneW * k) / 2, offsetY: (containerH - sceneH * k) / 2 }
}

export function toPointsAttr(points: Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ")
}

export function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n)
}
