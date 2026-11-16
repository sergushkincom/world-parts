"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const MIN = 30
const MAX = 70
const STEP = 5
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n))

/**
 * List left, 3D right, with a draggable divider (pointer, or ←/→ when focused; Home resets).
 * Under the panel breakpoint (900px) the two stack, 3D on top, and the divider goes away.
 */
export function SplitPane({ list, stage }: { list: React.ReactNode; stage: React.ReactNode }) {
  const [listShare, setListShare] = React.useState(50)
  const [dragging, setDragging] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  const moveTo = (clientX: number) => {
    const box = rootRef.current?.getBoundingClientRect()
    if (box?.width) setListShare(clamp(((clientX - box.left) / box.width) * 100))
  }

  return (
    <div
      ref={rootRef}
      className={cn("flex min-h-0 flex-1 flex-col panel:flex-row", dragging && "cursor-col-resize select-none")}
      style={{ "--list-share": `${listShare}%` } as React.CSSProperties}
    >
      <main id={listId} className="min-h-0 min-w-0 flex-1 md:px-3 panel:flex-none panel:basis-(--list-share)">
        {list}
      </main>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list and 3D view"
        aria-controls={listId}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(listShare)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragging(true)
        }}
        onPointerMove={(e) => dragging && moveTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => setListShare(50)}
        onKeyDown={(e) => {
          const next =
            e.key === "ArrowLeft" ? listShare - STEP : e.key === "ArrowRight" ? listShare + STEP : e.key === "Home" ? 50 : null
          if (next === null) return
          e.preventDefault()
          setListShare(clamp(next))
        }}
        className={cn(
          "group relative z-10 hidden w-px shrink-0 cursor-col-resize touch-none bg-border outline-none panel:block",
          "before:absolute before:inset-y-0 before:-right-1.5 before:-left-1.5 before:content-['']",
          "hover:bg-ring focus-visible:bg-ring",
          dragging && "bg-ring",
        )}
      >
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 h-8 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background group-hover:border-ring group-focus-visible:border-ring"
        />
      </div>

      <section
        aria-label="Selected part in its room"
        className="order-first h-[42dvh] shrink-0 border-b panel:order-none panel:h-auto panel:min-w-0 panel:flex-1 panel:border-b-0"
      >
        {stage}
      </section>
    </div>
  )
}
