"use client"

import * as React from "react"
import { CircleHelpIcon, XIcon } from "lucide-react"
import { GAUSSIAN_VIEWS } from "@/lib/data"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Row = { action: string; how: React.ReactNode }
type Group = { title: string; rows: Row[] }

const keys = (...k: string[]) => (
  <KbdGroup>
    {k.map((x) => (
      <Kbd key={x} className="bg-white/10 text-scene-ink">
        {x}
      </Kbd>
    ))}
  </KbdGroup>
)

/**
 * Keys that actually fire. G frames the open card and otherwise segments the search.
 * F, F2 and Delete only apply while an object row is focused. R resets the camera in
 * Live 3D and the frame in the still.
 */
function keyGroups(): Group[] {
  return [
    {
      title: "Navigation",
      rows: [
        { action: "Find a part", how: keys("/") },
        { action: "Previous / next object", how: keys("↑", "↓") },
        { action: "Extend the selection", how: keys("Shift", "↑", "↓") },
        { action: "Close card, clear selection, or plant", how: keys("Esc") },
      ],
    },
    {
      title: "View",
      rows: [
        { action: "Orbit", how: "Drag" },
        { action: "Pan", how: <span className="flex items-center gap-1">Right-drag or {keys("Shift")} + drag</span> },
        { action: "Zoom", how: "Scroll" },
        { action: "Reset view", how: keys("R") },
        ...GAUSSIAN_VIEWS.map((v) => ({ action: v.fullLabel, how: keys(v.key) })),
      ],
    },
    {
      title: "Objects",
      rows: [
        { action: "Go to the open object, otherwise segment", how: keys("G") },
        { action: "Toggle selection", how: keys("Space") },
        { action: "Frame the focused row", how: keys("F") },
        { action: "Rename the focused row", how: keys("F2") },
        { action: "Remove the focused row", how: keys("Del") },
      ],
    },
  ]
}

function gestureGroups(): Group[] {
  return [
    {
      title: "Gestures",
      rows: [
        { action: "Rotate", how: "One finger" },
        { action: "Pan", how: "Two fingers" },
        { action: "Zoom", how: "Pinch" },
      ],
    },
  ]
}

const SKIP_MENU = "[role='menu'], [role='alertdialog']"

/**
 * Full shortcut list, on demand. Sits by the ? button. Escape, outside click and ? close it
 * without leaving the room. A coarse pointer or a narrow window gets gestures instead of keys.
 */
export function ShortcutsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const gestures = useMediaQuery("(pointer: coarse), (max-width: 899px)")
  const panelRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()
  const groups = gestures ? gestureGroups() : keyGroups()

  React.useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.closest?.("input, textarea, select, [contenteditable='true']")) return
      if (document.querySelector(SKIP_MENU)) return
      if (e.key === "?") {
        e.preventDefault()
        e.stopPropagation()
        onOpenChange(!open)
      } else if (e.key === "Escape" && open) {
        e.preventDefault()
        e.stopPropagation()
        onOpenChange(false)
        buttonRef.current?.focus()
      }
    }
    function onPointer(e: PointerEvent) {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) onOpenChange(false)
    }
    window.addEventListener("keydown", onKey, true)
    if (open) document.addEventListener("pointerdown", onPointer)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      document.removeEventListener("pointerdown", onPointer)
    }
  }, [open, onOpenChange])

  return (
    <div className="pointer-events-auto absolute right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
            aria-label="Shortcuts"
            aria-expanded={open}
            aria-controls={open ? `${titleId}-panel` : undefined}
            aria-keyshortcuts="Shift+/"
            onClick={() => onOpenChange(!open)}
            className="grid size-11 place-items-center rounded-full bg-black/75 text-scene-ink shadow-lg backdrop-blur-sm outline-none hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white panel:size-10"
          >
            <CircleHelpIcon aria-hidden className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Shortcuts · ?</TooltipContent>
      </Tooltip>
      {open && (
        <div
          ref={panelRef}
          id={`${titleId}-panel`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="absolute right-0 bottom-full z-20 mb-2 max-h-[min(24rem,calc(100dvh-8rem))] w-72 overflow-y-auto overscroll-contain rounded-md border border-white/10 bg-black/85 p-3 text-scene-ink shadow-lg backdrop-blur-sm outline-none"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 id={titleId} className="text-sm font-medium">
              {gestures ? "Gestures" : "Shortcuts"}
            </h2>
            <button
              type="button"
              aria-label="Close shortcuts"
              onClick={() => {
                onOpenChange(false)
                buttonRef.current?.focus()
              }}
              className="grid size-11 place-items-center rounded-sm text-scene-ink/60 hover:bg-white/10 hover:text-scene-ink panel:size-6"
            >
              <XIcon aria-hidden className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <section key={g.title} aria-label={g.title}>
                <h3 className="mb-1 text-label tracking-wider text-scene-ink/50 uppercase">{g.title}</h3>
                <dl className="flex flex-col gap-1.5">
                  {g.rows.map((r) => (
                    <div key={r.action} className="flex items-center justify-between gap-3 text-label">
                      <dt className="text-scene-ink/80">{r.action}</dt>
                      <dd className="shrink-0 text-scene-ink">{r.how}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
