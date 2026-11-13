"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { shiftClearOf } from "@/lib/shortcut-learning"
import { Kbd } from "@/components/ui/kbd"
import { useShortcutLearning } from "@/hooks/use-shortcut-learning"

/**
 * The chip's home is centered above the pill. If the minimap card covers that spot,
 * the whole slot slides aside so the tip stays readable and the map stays put.
 */
export function HintSlot({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const shift = React.useRef({ x: 0, y: 0 })
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    if (!active) {
      shift.current = { x: 0, y: 0 }
      setOffset({ x: 0, y: 0 })
      return
    }
    const place = () => {
      const slot = ref.current
      const card = document.querySelector("[data-minimap-card]")
      if (!slot || slot.offsetWidth === 0 || !card) {
        if (shift.current.x !== 0 || shift.current.y !== 0) {
          shift.current = { x: 0, y: 0 }
          setOffset({ x: 0, y: 0 })
        }
        return
      }
      const rect = slot.getBoundingClientRect()
      const bounds = card.getBoundingClientRect()
      const next = shiftClearOf(
        {
          left: rect.left - shift.current.x,
          top: rect.top - shift.current.y,
          width: rect.width,
          height: rect.height,
        },
        { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
        { width: window.innerWidth, height: window.innerHeight },
      )
      if (next.x === shift.current.x && next.y === shift.current.y) return
      shift.current = next
      setOffset(next)
    }
    place()
    const id = window.setInterval(place, 200)
    window.addEventListener("resize", place)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("resize", place)
    }
  }, [active])

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-[max(4.25rem,calc(env(safe-area-inset-bottom)+3.5rem))] left-1/2 z-40 flex w-max max-w-[calc(100%-6rem)] -translate-x-1/2 justify-center"
      style={{ translate: `${offset.x}px ${offset.y}px` }}
    >
      {children}
    </div>
  )
}

/**
 * One chip above the view pill. The live region stays mounted so a screen reader
 * hears the next tip without a second chip stacking on the first.
 */
export function ShortcutHint() {
  const { hint, dismiss } = useShortcutLearning()

  return (
    <div aria-live="polite" aria-atomic="true" className="flex w-max max-w-[calc(100vw-6rem)] justify-center">
      {hint && (
        <div
          data-shortcut-hint={hint.kind}
          data-shortcut-id={hint.id}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/75 py-1 pr-1 pl-3 text-label text-scene-ink shadow-lg backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
        >
          <span className="sr-only">{hint.announcement}</span>
          <span aria-hidden className="inline-flex items-center gap-1">
            <span>{hint.lead}</span>
            {hint.keys.length > 0 && (
              <>
                {hint.kind === "introduce" && <span>·</span>}
                {hint.keys.map((key) => (
                  <Kbd key={key} className="h-4 min-w-4 bg-white/10 px-1 text-[0.625rem] text-scene-ink">
                    {key}
                  </Kbd>
                ))}
              </>
            )}
          </span>
          <button
            type="button"
            aria-label="Dismiss tip"
            onClick={dismiss}
            className="grid size-7 shrink-0 place-items-center rounded-full text-scene-ink/70 outline-none hover:bg-white/15 hover:text-scene-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-panel:size-11"
          >
            <XIcon aria-hidden className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
