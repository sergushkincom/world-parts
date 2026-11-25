"use client"

import * as React from "react"
import { PLAN_CALIBRATION, type RoomId } from "@/lib/data"
import { useElementSize } from "@/hooks/use-element-size"
import { LIVE_FOV_Y, applyDraw, frameRoom, outlineDraw, projectOutline, roomOutline, type DrawnSegment } from "@/lib/room-outline"

const SHELL = "#e7f1ff"
const INK = "#5aa2ff"

function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function readReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Blueprint of the room, drawn in place of the progress bar. The walls follow
 * the download. The scan fades over this from the canvas, so the drawing stays
 * pointer-transparent and out of the way of the room chrome.
 */
export function LoadOutline({
  roomId,
  eyeY,
  progress,
  sizeLabel,
}: {
  roomId: RoomId
  eyeY: number
  progress: number | null
  sizeLabel: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(ref)
  const reduced = React.useSyncExternalStore(subscribeReduced, readReduced, () => false)
  const draw = outlineDraw(progress, reduced)

  const projected = React.useMemo(() => {
    const corners = PLAN_CALIBRATION[roomId]?.world
    if (!corners || size.width < 2 || size.height < 2) return []
    const pose = frameRoom(corners, eyeY, size.width, size.height)
    if (!pose) return []
    return projectOutline(roomOutline(corners, eyeY), {
      pose,
      fovY: LIVE_FOV_Y,
      width: size.width,
      height: size.height,
    })
  }, [roomId, eyeY, size.width, size.height])

  const lines = React.useMemo(() => applyDraw(projected, draw), [projected, draw])

  return (
    <div
      ref={ref}
      role="status"
      data-load-outline=""
      data-outline-draw={draw.toFixed(3)}
      className="blueprint-grid pointer-events-none absolute inset-0 overflow-hidden bg-blueprint"
    >
      <p className="sr-only">{`Loading 3D world, ${sizeLabel}`}</p>
      {size.width > 1 && size.height > 1 && (
        <svg className="absolute inset-0 h-full w-full" aria-hidden viewBox={`0 0 ${size.width} ${size.height}`}>
          {lines.map((seg, i) => (
            <OutlineLine key={`${seg.kind}-${i}`} seg={seg} animate={seg.kind === "shell" && !reduced} />
          ))}
        </svg>
      )}
    </div>
  )
}

function OutlineLine({ seg, animate }: { seg: DrawnSegment; animate: boolean }) {
  const drawn = seg.kind === "shell"
  const dash = drawn
    ? { pathLength: 1, style: { strokeDasharray: 1, strokeDashoffset: 1 - seg.shown } as React.CSSProperties }
    : {}
  const motion = animate ? "outline-draw" : undefined
  return (
    <>
      {drawn && (
        <line
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={INK}
          strokeWidth={5}
          strokeOpacity={0.28}
          strokeLinecap="round"
          className={motion}
          {...dash}
        />
      )}
      <line
        x1={seg.x1}
        y1={seg.y1}
        x2={seg.x2}
        y2={seg.y2}
        stroke={drawn ? SHELL : INK}
        strokeWidth={drawn ? 1.6 : 1}
        strokeOpacity={drawn ? 0.95 : 0.28}
        strokeLinecap="round"
        className={motion}
        {...dash}
      />
    </>
  )
}
