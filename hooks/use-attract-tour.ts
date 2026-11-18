"use client"

import * as React from "react"
import {
  tourAllowed,
  tourCommand,
  createTour,
  pauseTour,
  startTour,
  stopTour,
  tickTour,
  type TourState,
} from "@/lib/tour"

const subscribeNoop = () => () => {}

/** `?present=1` forces the tour for a recording. Routing drops unknown params, so the tab remembers it. */
function readPresent() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("present")
    if (fromUrl === "1" || fromUrl === "0") window.sessionStorage.setItem("world-parts:present", fromUrl)
    return (fromUrl ?? window.sessionStorage.getItem("world-parts:present")) === "1"
  } catch {
    return new URLSearchParams(window.location.search).get("present") === "1"
  }
}

function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function readReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export type AttractView = {
  phase: TourState["phase"]
  objectId: string | null
  highlight: boolean
}

const OFF: AttractView = { phase: "off", objectId: null, highlight: false }

/**
 * Plays the idle tour on the live camera. The state machine is `lib/tour`; this hook
 * owns the clock, the reduced-motion and `?present=1` gates, and the first input that ends it.
 * A Find (framed or card) pauses without freezing, so that flight still runs.
 * Any other stop freezes the camera where it is.
 */
export function useAttractTour({
  enabled,
  ready,
  framedId,
  cardId,
  stops,
  flyTo,
  goHome,
  hold,
  onUserStop,
}: {
  enabled: boolean
  ready: boolean
  framedId: string | null
  cardId: string | null
  stops: readonly string[]
  flyTo: (id: string) => void
  goHome: () => void
  hold: () => void
  /** The viewer took the camera. The Find effect must not pull it home on the next render. */
  onUserStop?: () => void
}): AttractView {
  const present = React.useSyncExternalStore(subscribeNoop, readPresent, () => false)
  const reducedMotion = React.useSyncExternalStore(subscribeReduced, readReduced, () => false)
  const machine = React.useRef(createTour())
  const [view, setView] = React.useState<AttractView>(OFF)
  const flyToRef = React.useRef(flyTo)
  const goHomeRef = React.useRef(goHome)
  const holdRef = React.useRef(hold)
  const onUserStopRef = React.useRef(onUserStop)
  const stopsRef = React.useRef(stops)
  flyToRef.current = flyTo
  goHomeRef.current = goHome
  holdRef.current = hold
  onUserStopRef.current = onUserStop
  stopsRef.current = stops
  const stopsKey = stops.join("\0")
  const allowed = tourAllowed({ ready, framedId, cardId, reducedMotion, present })
  // A frame or an open card is about to move the camera itself.
  const release = Boolean(framedId || cardId)

  const publish = React.useCallback((state: TourState) => {
    setView((current) =>
      current.phase === state.phase && current.objectId === state.objectId && current.highlight === state.highlight
        ? current
        : { phase: state.phase, objectId: state.objectId, highlight: state.highlight },
    )
  }, [])

  React.useEffect(() => {
    if (!enabled) return
    if (!allowed) {
      const prev = machine.current
      if (prev.phase === "off") return
      const next = pauseTour(prev)
      machine.current = next
      if (!release) holdRef.current()
      publish(next)
      return
    }
    if (machine.current.phase === "off" && !machine.current.dismissed && stopsRef.current.length > 0) {
      machine.current = startTour(machine.current, stopsRef.current)
      publish(machine.current)
    }
    if (machine.current.phase === "off") return

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const current = machine.current
      if (current.phase === "off") return
      // A hidden tab does not fast-forward the visit; one tick crosses one phase.
      const dt = Math.min(100, now - last)
      last = now
      const next = tickTour(current, dt)
      if (next !== current) {
        machine.current = next
        const command = tourCommand(current, next)
        if (command === "fly" && next.objectId) flyToRef.current(next.objectId)
        else if (command === "home") goHomeRef.current()
        publish(next)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [enabled, allowed, release, stopsKey, publish])

  React.useEffect(() => {
    if (!enabled) return
    const dismiss = (freeze: boolean) => {
      const prev = machine.current
      if (prev.phase === "off" && prev.dismissed) return
      const running = prev.phase !== "off"
      machine.current = stopTour(prev)
      if (running && freeze) {
        onUserStopRef.current?.()
        holdRef.current()
      } else if (!running) {
        onUserStopRef.current?.()
      }
      if (running) publish(machine.current)
    }
    const onPointer = () => dismiss(true)
    const onWheel = () => dismiss(true)
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      const running = machine.current.phase !== "off"
      if (!running && machine.current.dismissed) return
      // The first Escape only ends the tour. The next one leaves the room, as usual.
      if (running && event.key === "Escape") event.preventDefault()
      dismiss(running)
    }
    window.addEventListener("pointerdown", onPointer, true)
    window.addEventListener("wheel", onWheel, { capture: true, passive: true })
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("pointerdown", onPointer, true)
      window.removeEventListener("wheel", onWheel, true)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [enabled, publish])

  return enabled ? view : OFF
}
