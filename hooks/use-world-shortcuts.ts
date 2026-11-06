"use client"

import * as React from "react"
import { GAUSSIAN_VIEWS } from "@/lib/data"
import { useWorld } from "@/components/world/world-provider"

const SKIP_INSIDE = "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='alertdialog'], [role='slider']"

/**
 * Global keys: G segments, / focuses search, Esc steps out (card → selection → plant),
 * ↑/↓ move through the list, Space toggles, 1/2/3 switch Gaussian view.
 */
export function useWorldShortcuts({ onEscapeRoot }: { onEscapeRoot?: () => void } = {}) {
  const world = useWorld()
  const worldRef = React.useRef(world)
  worldRef.current = world
  const escapeRootRef = React.useRef(onEscapeRoot)
  escapeRootRef.current = onEscapeRoot

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest?.(SKIP_INSIDE)) return
      if (document.querySelector("[role='alertdialog'], [role='menu']")) return

      const { state, segmentDraft, clearSelection, closeCard, focusRow, select, setView, conceptInputRef } =
        worldRef.current
      const onRow = target.dataset?.objectRow !== undefined
      const onBody = target === document.body

      switch (e.key) {
        case "g":
        case "G":
          e.preventDefault()
          segmentDraft()
          return
        case "/":
          e.preventDefault()
          conceptInputRef.current?.focus()
          conceptInputRef.current?.select()
          return
        case "Escape":
          e.preventDefault()
          if (state.cardId) closeCard()
          else if (state.selection.length || state.framedId) clearSelection()
          else escapeRootRef.current?.()
          return
        case "ArrowDown":
        case "ArrowUp": {
          if (!onRow && !onBody) return
          const ids = state.objects.map((o) => o.id)
          if (!ids.length) return
          e.preventDefault()
          const current = ids.indexOf(state.activeId ?? "")
          const step = e.key === "ArrowDown" ? 1 : -1
          const next = current === -1 ? 0 : Math.min(ids.length - 1, Math.max(0, current + step))
          if (e.shiftKey) select(ids[next], "range")
          focusRow(ids[next])
          return
        }
        case " ":
          if (onBody && state.activeId) {
            e.preventDefault()
            select(state.activeId, "toggle")
          }
          return
        default: {
          const view = GAUSSIAN_VIEWS.find((v) => v.key === e.key)
          if (view && state.selection.length) {
            e.preventDefault()
            setView(view.id)
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
