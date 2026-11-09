"use client"

import * as React from "react"
import { KeyboardIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

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
 * Ordered by how often you need it: look and zoom first. Orbit only, like a product viewer:
 * no W/A/S/D fly mode, so there is one way to move and nothing to explain.
 */
function groupsFor(touch: boolean): Group[] {
  if (touch) {
    return [
      {
        title: "Touch",
        rows: [
          { action: "Look around", how: "Drag" },
          { action: "Zoom", how: "Pinch" },
          { action: "Move", how: "Two-finger drag" },
        ],
      },
    ]
  }
  return [
    {
      title: "Mouse",
      rows: [
        { action: "Look around", how: "Drag" },
        { action: "Zoom", how: "Scroll" },
        { action: "Move", how: <span className="flex items-center gap-1">Right-drag or {keys("Shift")} + drag</span> },
      ],
    },
    {
      title: "Keys",
      rows: [
        { action: "Reset view", how: keys("R") },
        { action: "This panel", how: keys("?") },
        { action: "Back to plant", how: keys("Esc") },
      ],
    },
  ]
}

/**
 * The viewer's controls, on demand. Not a modal: it sits next to its button, the world stays usable,
 * and it closes on Esc, outside click or `?`.
 */
export function ViewControlsHelp() {
  const [open, setOpen] = React.useState(false)
  const [touch, setTouch] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()

  React.useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), [])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest?.("input, textarea, select, [contenteditable='true']")) return
      if (e.key === "?") {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === "Escape" && open) {
        // Handled here so Esc closes the panel instead of leaving the room.
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    function onPointer(e: PointerEvent) {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false)
    }
    window.addEventListener("keydown", onKey, true)
    if (open) document.addEventListener("pointerdown", onPointer)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      document.removeEventListener("pointerdown", onPointer)
    }
  }, [open])

  return (
    <div className="pointer-events-auto relative">
      <Button
        ref={buttonRef}
        size="sm"
        variant="secondary"
        aria-expanded={open}
        aria-controls={open ? `${titleId}-panel` : undefined}
        aria-keyshortcuts="Shift+/"
        onClick={() => setOpen((o) => !o)}
      >
        <KeyboardIcon aria-hidden data-icon="inline-start" />
        Controls
        <Kbd className="ml-0.5 hidden bg-black/10 panel:inline-flex">?</Kbd>
      </Button>
      {open && (
        <div
          ref={panelRef}
          id={`${titleId}-panel`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="absolute top-full right-0 z-20 mt-2 w-64 rounded-md border border-white/10 bg-black/85 p-3 text-scene-ink shadow-lg backdrop-blur-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 id={titleId} className="text-sm font-medium">
              Controls
            </h2>
            <button
              type="button"
              aria-label="Close controls"
              onClick={() => setOpen(false)}
              className="-mr-1 grid size-6 place-items-center rounded-sm text-scene-ink/60 hover:bg-white/10 hover:text-scene-ink"
            >
              <XIcon aria-hidden className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {groupsFor(touch).map((g) => (
              <section key={g.title} aria-label={g.title}>
                <h3 className="mb-1 text-label tracking-wider text-scene-ink/50 uppercase">{g.title}</h3>
                <dl className="flex flex-col gap-1">
                  {g.rows.map((r) => (
                    <div key={r.action} className="flex items-center justify-between gap-3 text-label">
                      <dt className="text-scene-ink/80">{r.action}</dt>
                      <dd className="text-scene-ink">{r.how}</dd>
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
