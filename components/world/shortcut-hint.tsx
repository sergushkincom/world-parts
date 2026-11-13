"use client"

import { XIcon } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import { useShortcutLearning } from "@/hooks/use-shortcut-learning"

/**
 * One chip above the view pill. The live region stays mounted so a screen reader
 * hears the next tip without a second chip stacking on the first.
 */
export function ShortcutHint() {
  const { hint, dismiss } = useShortcutLearning()

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none absolute bottom-[max(4.25rem,calc(env(safe-area-inset-bottom)+3.5rem))] left-1/2 z-30 flex w-max max-w-[calc(100%-6rem)] -translate-x-1/2 justify-center"
    >
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
