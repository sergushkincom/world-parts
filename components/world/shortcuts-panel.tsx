"use client"

import * as React from "react"
import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react"
import {
  shortcutsIn,
  GESTURES,
  type GestureId,
  type ShortcutDef,
  type ShortcutGroup,
  type ShortcutId,
} from "@/lib/shortcut-learning"
import { useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const keys = (...k: readonly string[]) => (
  <KbdGroup>
    {k.map((key) => (
      <Kbd key={key} className="bg-white/10 text-scene-ink">
        {key}
      </Kbd>
    ))}
  </KbdGroup>
)

function LearnedMark() {
  return (
    <>
      <CheckIcon aria-hidden className="size-3 shrink-0 text-scene-ink" />
      <span className="sr-only">, learned</span>
    </>
  )
}

function KeyRow({ shortcut, learned }: { shortcut: ShortcutDef; learned: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-label">
      <dt className="flex min-w-0 items-center gap-1.5 text-scene-ink/80">
        {learned && <LearnedMark />}
        <span className="min-w-0">{shortcut.action}</span>
      </dt>
      <dd className="shrink-0 text-scene-ink">{keys(...shortcut.keys)}</dd>
    </div>
  )
}

function PlainRow({ action, how }: { action: string; how: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-label">
      <dt className="text-scene-ink/80">{action}</dt>
      <dd className="shrink-0 text-scene-ink">{how}</dd>
    </div>
  )
}

const SKIP_MENU = "[role='menu'], [role='alertdialog']"

/**
 * Full shortcut list, on demand. Sits by the ? button. Escape, outside click and ? close it
 * without leaving the room. A coarse pointer gets gestures; a narrow window with a mouse
 * still lists keys, because that keyboard is what the tips are teaching.
 * Learned keys (and gestures the hands have already used) carry a check, with a count.
 */
export function ShortcutsPanel({
  open,
  onOpenChange,
  onResetOrbit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResetOrbit?: () => void
}) {
  const { touch, tipsOff, setTipsOff, resetTips, learned, gesturesSeen, progress } = useShortcutLearning()
  const panelRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()

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
        // Immediate, so Esc closes this list and does not also count as the room's Esc shortcut.
        e.preventDefault()
        e.stopImmediatePropagation()
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

  const reset = () => {
    resetTips()
    onResetOrbit?.()
  }

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
          className="absolute right-0 bottom-full z-20 mb-2 max-h-[min(24rem,calc(100dvh-8rem))] w-72 overflow-y-auto overscroll-contain rounded-md border border-white/10 bg-black/85 p-3 text-scene-ink shadow-lg backdrop-blur-sm outline-none max-panel:max-h-48"
        >
          <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 flex items-start justify-between gap-2 bg-black/95 px-3 pt-3 pb-2">
            <div>
              <h2 id={titleId} className="text-sm font-medium">
                {touch ? "Gestures" : "Shortcuts"}
              </h2>
              <p className="text-label text-scene-ink/60 tabular-nums" data-shortcut-progress>
                {progress.learned} of {progress.total} learned
              </p>
            </div>
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
          {touch ? (
            <GestureList seen={gesturesSeen} />
          ) : (
            <div className="flex flex-col gap-3">
              <Section title="Navigation" learned={learned} />
              <section aria-label="View">
                <h3 className="mb-1 text-label tracking-wider text-scene-ink/50 uppercase">View</h3>
                <dl className="flex flex-col gap-1.5">
                  <PlainRow action="Orbit" how="Drag" />
                  <PlainRow
                    action="Pan"
                    how={<span className="flex items-center gap-1">Right-drag or {keys("Shift")} + drag</span>}
                  />
                  <PlainRow action="Zoom" how="Scroll" />
                  {shortcutsIn("View").map((shortcut) => (
                    <KeyRow key={shortcut.id} shortcut={shortcut} learned={learned.has(shortcut.id)} />
                  ))}
                </dl>
              </section>
              <Section title="Objects" learned={learned} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/10 pt-2">
            <label className="flex items-center gap-2 text-label text-scene-ink/80">
              <input
                type="checkbox"
                checked={tipsOff}
                onChange={(event) => setTipsOff(event.target.checked)}
                className="size-3.5 accent-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              />
              Don&apos;t show tips
            </label>
            <button
              type="button"
              onClick={reset}
              className="rounded-sm text-label text-scene-ink/70 outline-none hover:text-scene-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Reset tips
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  learned,
}: {
  title: Exclude<ShortcutGroup, "View">
  learned: ReadonlySet<ShortcutId>
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-1 text-label tracking-wider text-scene-ink/50 uppercase">{title}</h3>
      <dl className="flex flex-col gap-1.5">
        {shortcutsIn(title).map((shortcut) => (
          <KeyRow key={shortcut.id} shortcut={shortcut} learned={learned.has(shortcut.id)} />
        ))}
      </dl>
    </section>
  )
}

function GestureList({ seen }: { seen: ReadonlySet<GestureId> }) {
  return (
    <section aria-label="Gestures">
      <h3 className="mb-1 text-label tracking-wider text-scene-ink/50 uppercase">Gestures</h3>
      <dl className="flex flex-col gap-1.5">
        {GESTURES.map((gesture) => (
          <div key={gesture.id} className="flex items-center justify-between gap-3 text-label">
            <dt className="flex min-w-0 items-center gap-1.5 text-scene-ink/80">
              {seen.has(gesture.id) && <LearnedMark />}
              <span>{gesture.action}</span>
            </dt>
            <dd className="shrink-0 text-scene-ink">{gesture.how}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
