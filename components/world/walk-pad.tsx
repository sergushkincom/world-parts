"use client"

import * as React from "react"
import type { Stick } from "@/lib/walk"

const ZERO: Stick = { forward: 0, strafe: 0 }

function useCoarsePointer() {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(pointer: coarse)")
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  )
}

/**
 * One thumb stick for touch screens. A cross of buttons covered the map on a short phone,
 * so movement is a single drag target that also takes arrow keys while it is focused.
 */
export function WalkPad({ active, onStick }: { active: boolean; onStick: (stick: Stick) => void }) {
  const coarse = useCoarsePointer()
  const padRef = React.useRef<HTMLButtonElement>(null)
  const onStickRef = React.useRef(onStick)
  onStickRef.current = onStick
  const [nub, setNub] = React.useState({ x: 0, y: 0 })

  const publish = React.useCallback((stick: Stick, point = { x: 0, y: 0 }) => {
    setNub(point)
    onStickRef.current(stick)
  }, [])

  React.useEffect(() => {
    if (active && coarse) return
    publish(ZERO)
  }, [active, coarse, publish])

  if (!active || !coarse) return null

  const fromEvent = (event: React.PointerEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2)
    const dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2)
    const strafe = Math.max(-1, Math.min(1, dx))
    const forward = Math.max(-1, Math.min(1, -dy))
    publish({ forward, strafe }, { x: strafe, y: -forward })
  }

  return (
    <button
      ref={padRef}
      type="button"
      aria-label="Move. Drag from the centre, or press the arrow keys."
      className="pointer-events-auto absolute bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] left-[4.5rem] z-30 size-16 rounded-full bg-black/75 shadow-lg backdrop-blur-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        fromEvent(event)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        fromEvent(event)
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        publish(ZERO)
      }}
      onPointerCancel={() => publish(ZERO)}
      onLostPointerCapture={() => publish(ZERO)}
      onKeyDown={(event) => {
        const stick =
          event.key === "ArrowUp"
            ? { forward: 1, strafe: 0 }
            : event.key === "ArrowDown"
              ? { forward: -1, strafe: 0 }
              : event.key === "ArrowLeft"
                ? { forward: 0, strafe: -1 }
                : event.key === "ArrowRight"
                  ? { forward: 0, strafe: 1 }
                  : null
        if (!stick || event.repeat) return
        event.preventDefault()
        event.stopPropagation()
        publish(stick, { x: stick.strafe, y: stick.forward })
      }}
      onKeyUp={(event) => {
        if (event.key.startsWith("Arrow")) publish(ZERO)
      }}
      onBlur={() => publish(ZERO)}
    >
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85"
        style={{ transform: `translate(calc(-50% + ${nub.x * 16}px), calc(-50% + ${-nub.y * 16}px))` }}
      />
    </button>
  )
}
