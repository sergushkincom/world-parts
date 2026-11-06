"use client"

import * as React from "react"
import { LAYOUT } from "@/lib/data"

interface SheetHandleProps {
  snap: number
  onSnap: (index: number) => void
  onDrag: (fraction: number | null) => void
}

const TAP_TOLERANCE_PX = 4

function nearestSnap(fraction: number) {
  let best = 0
  LAYOUT.sheetSnaps.forEach((s, i) => {
    if (Math.abs(s - fraction) < Math.abs(LAYOUT.sheetSnaps[best] - fraction)) best = i
  })
  return best
}

/** Bottom-sheet drag handle, shown under 900 px. Drag, tap to cycle, or use arrow keys. */
export function SheetHandle({ snap, onSnap, onDrag }: SheetHandleProps) {
  const drag = React.useRef<{ startY: number; startFraction: number; moved: boolean } | null>(null)
  const last = LAYOUT.sheetSnaps.length - 1
  const min = LAYOUT.sheetSnaps[0]
  const max = LAYOUT.sheetSnaps[last]

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Panel height"
      aria-controls="segmentation-panel"
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={snap}
      aria-valuetext={LAYOUT.sheetSnapLabels[snap]}
      className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-t-xl active:cursor-grabbing panel:hidden"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { startY: e.clientY, startFraction: LAYOUT.sheetSnaps[snap], moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dy = d.startY - e.clientY
        if (Math.abs(dy) > TAP_TOLERANCE_PX) d.moved = true
        if (d.moved) onDrag(Math.min(max, Math.max(min, d.startFraction + dy / window.innerHeight)))
      }}
      onPointerUp={(e) => {
        const d = drag.current
        drag.current = null
        if (!d) return
        if (!d.moved) {
          onSnap(snap === last ? 0 : snap + 1)
        } else {
          const dy = d.startY - e.clientY
          onSnap(nearestSnap(d.startFraction + dy / window.innerHeight))
        }
        onDrag(null)
      }}
      onPointerCancel={() => {
        drag.current = null
        onDrag(null)
      }}
      onKeyDown={(e) => {
        const next =
          e.key === "ArrowUp" || e.key === "ArrowRight"
            ? Math.min(last, snap + 1)
            : e.key === "ArrowDown" || e.key === "ArrowLeft"
              ? Math.max(0, snap - 1)
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? last
                  : e.key === "Enter" || e.key === " "
                    ? snap === last
                      ? 0
                      : snap + 1
                    : null
        if (next === null) return
        e.preventDefault()
        onSnap(next)
      }}
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/40" />
    </div>
  )
}
