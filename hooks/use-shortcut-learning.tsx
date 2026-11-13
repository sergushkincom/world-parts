"use client"

import * as React from "react"
import { GAUSSIAN_VIEWS, STORAGE_KEYS } from "@/lib/data"
import { readJSON, writeJSON } from "@/lib/storage"
import {
  SHORTCUTS,
  applyGate,
  dismissHint,
  flushTeach,
  gestureUsed,
  offerGesture as queueGesture,
  initialTeachState,
  learnKey,
  learningProgress,
  msUntilTeach,
  parseRecord,
  pointerUsed,
  resetTips,
  sameRecord,
  setTipsOff,
  toStored,
  HINT_HOLD_MS,
  type GestureId,
  type Hint,
  type LearningRecord,
  type ShortcutId,
  type TeachGate,
  type TeachState,
} from "@/lib/shortcut-learning"

for (const view of GAUSSIAN_VIEWS) {
  const row = SHORTCUTS.find((shortcut) => shortcut.id === view.id)
  if (!row || row.keys[0] !== view.key || row.action !== view.fullLabel) {
    throw new Error(`Shortcut list is out of date for the ${view.id} Gaussian view`)
  }
}

const TYPING = "input, textarea, select, [contenteditable='true']"

function isStoredObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING) != null
}

type Api = {
  ready: boolean
  touch: boolean
  tipsOff: boolean
  hint: Hint | null
  learned: ReadonlySet<ShortcutId>
  gesturesSeen: ReadonlySet<GestureId>
  progress: { learned: number; total: number }
  notePointer: (id: ShortcutId) => void
  noteKey: (id: ShortcutId) => void
  noteGesture: (id: GestureId) => void
  offerGesture: (id: GestureId) => void
  dismiss: () => void
  resetTips: () => void
  setTipsOff: (off: boolean) => void
  setGate: (patch: Partial<Pick<TeachGate, "paused" | "coachGestures">>) => void
}

const ShortcutLearningContext = React.createContext<Api | null>(null)

export function ShortcutLearningProvider({ children }: { children: React.ReactNode }) {
  const [teach, setTeach] = React.useState<TeachState>(initialTeachState)
  const [ready, setReady] = React.useState(false)
  const teachRef = React.useRef(teach)
  teachRef.current = teach
  const readyRef = React.useRef(false)

  const commit = React.useCallback((next: TeachState, persist = true) => {
    const prev = teachRef.current
    if (next === prev) return
    teachRef.current = next
    setTeach(next)
    if (persist && readyRef.current && !sameRecord(next.record, prev.record)) {
      writeJSON(STORAGE_KEYS.shortcutLearning, toStored(next.record))
    }
  }, [])

  React.useLayoutEffect(() => {
    const read = readJSON(STORAGE_KEYS.shortcutLearning, isStoredObject)
    const record: LearningRecord = read.value ? (parseRecord(read.value) ?? initialTeachState().record) : initialTeachState().record
    const touch = window.matchMedia("(pointer: coarse)").matches
    readyRef.current = true
    setReady(true)
    commit({ ...teachRef.current, record, gate: { ...teachRef.current.gate, touch } }, false)
    const media = window.matchMedia("(pointer: coarse)")
    const onChange = () => commit(applyGate(teachRef.current, { touch: media.matches }))
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [commit])

  React.useEffect(() => {
    const sync = () => {
      const typing = isTyping(document.activeElement)
      if (typing === teachRef.current.gate.typing) return
      commit(applyGate(teachRef.current, { typing }))
    }
    document.addEventListener("focusin", sync)
    document.addEventListener("focusout", sync)
    return () => {
      document.removeEventListener("focusin", sync)
      document.removeEventListener("focusout", sync)
    }
  }, [commit])

  React.useEffect(() => {
    if (!ready) return
    const wait = msUntilTeach(teachRef.current, Date.now())
    if (wait === null) return
    const id = window.setTimeout(() => commit(flushTeach(teachRef.current, Date.now())), wait)
    return () => window.clearTimeout(id)
  }, [ready, teach, commit])

  React.useEffect(() => {
    if (!teach.hint) return
    const id = window.setTimeout(() => commit(dismissHint(teachRef.current)), HINT_HOLD_MS)
    return () => window.clearTimeout(id)
  }, [teach.hint, commit])

  // Capture runs before the room's own Esc (card, selection, leave), and yields to a dialog or a field.
  React.useEffect(() => {
    if (!teach.hint) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (isTyping(event.target)) return
      if (document.querySelector("[role='menu'], [role='alertdialog'], [role='dialog']")) return
      event.preventDefault()
      event.stopImmediatePropagation()
      commit(dismissHint(teachRef.current))
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [teach.hint, commit])

  const api = React.useMemo<Api>(() => {
    const now = () => Date.now()
    return {
      ready,
      touch: teach.gate.touch,
      tipsOff: teach.record.tipsOff,
      hint: teach.hint,
      learned: new Set(teach.record.learned),
      gesturesSeen: new Set(teach.record.gesturesSeen),
      progress: learningProgress(teach.record, teach.gate.touch),
      notePointer: (id) => {
        if (!readyRef.current) return
        commit(pointerUsed(teachRef.current, id, now()))
      },
      noteKey: (id) => {
        if (!readyRef.current) return
        commit(learnKey(teachRef.current, id))
      },
      noteGesture: (id) => {
        if (!readyRef.current) return
        commit(gestureUsed(teachRef.current, id))
      },
      offerGesture: (id) => {
        if (!readyRef.current) return
        commit(queueGesture(teachRef.current, id, Date.now()))
      },
      dismiss: () => commit(dismissHint(teachRef.current)),
      resetTips: () => {
        if (!readyRef.current) return
        commit(resetTips(teachRef.current))
      },
      setTipsOff: (off) => {
        if (!readyRef.current) return
        commit(setTipsOff(teachRef.current, off))
      },
      setGate: (patch) => commit(applyGate(teachRef.current, patch)),
    }
  }, [ready, teach, commit])

  return <ShortcutLearningContext.Provider value={api}>{children}</ShortcutLearningContext.Provider>
}

export function useShortcutLearning(): Api {
  const api = React.useContext(ShortcutLearningContext)
  if (!api) throw new Error("useShortcutLearning must be used inside the room")
  return api
}

/** A click from a mouse or finger. Keyboard activation of a focused control reports detail 0. */
export function activatedByPointer(event: { detail: number }): boolean {
  return event.detail > 0
}
