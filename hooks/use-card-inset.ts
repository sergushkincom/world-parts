"use client"

import * as React from "react"

export type Rect = { left: number; top: number; right: number; bottom: number }

/**
 * The part of the container covered by the object card, in container pixels, or null when the
 * card is closed or sits outside the container. Framing uses it to keep the object clear of the card.
 */
export function useCardRect(containerRef: React.RefObject<HTMLElement | null>, cardOpen: boolean): Rect | null {
  const [rect, setRect] = React.useState<Rect | null>(null)

  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (!cardOpen || !container) {
      setRect(null)
      return
    }
    const measure = () => {
      const card = document.querySelector("[data-object-card]")
      if (!card) return setRect(null)
      const c = container.getBoundingClientRect()
      const k = card.getBoundingClientRect()
      const next = {
        left: Math.round(Math.max(k.left, c.left) - c.left),
        top: Math.round(Math.max(k.top, c.top) - c.top),
        right: Math.round(Math.min(k.right, c.right) - c.left),
        bottom: Math.round(Math.min(k.bottom, c.bottom) - c.top),
      }
      if (next.right <= next.left || next.bottom <= next.top) return setRect(null)
      setRect((prev) =>
        prev && prev.left === next.left && prev.top === next.top && prev.right === next.right && prev.bottom === next.bottom
          ? prev
          : next,
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    const card = document.querySelector("[data-object-card]")
    if (card) ro.observe(card)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [containerRef, cardOpen])

  return rect
}
