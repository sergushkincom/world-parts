"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { isSearchable } from "@/lib/search"
import { cn } from "@/lib/utils"
import { useWorldHits } from "@/hooks/use-world-hits"
import { useWorld } from "@/components/world/world-provider"
import { WorldHitOption } from "@/components/search/world-hit-option"
import { Kbd } from "@/components/ui/kbd"
import type { WorldHit } from "@/lib/search"

const LISTBOX_ID = "room-find-results"
const optionId = (hit: WorldHit) => `${LISTBOX_ID}-${hit.object.id}`

/**
 * Primary room action: the same draft, hits and Enter-to-segment behaviour as the panel,
 * focused by `/`.
 */
export function RoomSearch({
  className,
  collapsible = false,
  onActivate,
  onCollapse,
}: {
  className?: string
  /** Narrow layout: Escape, or clear when the field is empty, closes the expanded field. */
  collapsible?: boolean
  onActivate?: () => void
  onCollapse?: () => void
}) {
  const { state, conceptInputRef, setDraft, segmentDraft, select, frame, openCard } = useWorld()
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const hits = useWorldHits(state.draft)
  const showResults = open && isSearchable(state.draft) && hits.length > 0
  const active = hits[activeIndex]
  const idle = state.selection.length === 0 && !state.cardId && !state.framedId
  const noMatch = open && isSearchable(state.draft) && hits.length === 0

  React.useEffect(() => setActiveIndex(-1), [state.draft])

  const openHit = (hit: WorldHit) => {
    setOpen(false)
    select(hit.object.id, "only")
    frame(hit.object.id)
    openCard(hit.object.id, "part")
    onCollapse?.()
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <label htmlFor="room-find" className="sr-only">
        Find a part
      </label>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-full px-3 text-scene-ink",
          "panel:h-10 panel:bg-black/75 panel:shadow-lg panel:backdrop-blur-sm",
        )}
      >
        <SearchIcon aria-hidden className="size-4 shrink-0 text-scene-ink/70" />
        <input
          id="room-find"
          ref={conceptInputRef}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={showResults && active ? optionId(active) : undefined}
          aria-keyshortcuts="/"
          value={state.draft}
          placeholder={idle ? "Find a part… or click a marker" : "Find a part…"}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            onActivate?.()
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) {
              e.preventDefault()
              return
            }
            if (e.key === "Enter") {
              e.preventDefault()
              const hit = showResults ? (active ?? hits[0]) : hits.length && isSearchable(state.draft) ? hits[0] : undefined
              if (hit) openHit(hit)
              else segmentDraft()
              return
            }
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && hits.length) {
              e.preventDefault()
              setOpen(true)
              const step = e.key === "ArrowDown" ? 1 : -1
              setActiveIndex((i) => (i === -1 && step === -1 ? hits.length - 1 : (i + step + hits.length) % hits.length))
            }
            if (e.key === "Escape") {
              e.stopPropagation()
              if (showResults || noMatch) setOpen(false)
              else if (collapsible) onCollapse?.()
              else e.currentTarget.blur()
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-scene-ink outline-none placeholder:text-scene-ink/55"
        />
        {(state.draft || collapsible) && (
          <button
            type="button"
            aria-label={state.draft ? "Clear search" : "Close search"}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full text-scene-ink/70 hover:bg-white/10 hover:text-scene-ink max-panel:size-11",
              !state.draft && "panel:hidden",
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (state.draft) {
                setDraft("")
                conceptInputRef.current?.focus()
              } else onCollapse?.()
            }}
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        )}
        <Kbd aria-hidden className="hidden bg-white/10 text-scene-ink panel:inline-flex">
          /
        </Kbd>
      </div>

      {showResults && (
        <ul
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Matches in this room"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          {hits.map((hit, index) => (
            <WorldHitOption
              key={hit.object.id}
              id={optionId(hit)}
              hit={hit}
              active={index === activeIndex}
              onHover={() => setActiveIndex(index)}
              onOpen={() => openHit(hit)}
            />
          ))}
        </ul>
      )}

      {noMatch && (
        <p className="absolute top-full left-3 z-40 mt-1 text-label text-scene-ink/80 drop-shadow">
          Not in this room — Enter segments it
        </p>
      )}
      {state.notice?.tone === "error" && (
        <p role="alert" className="absolute top-full left-3 z-40 mt-1 text-label text-status-low drop-shadow">
          {state.notice.text}
        </p>
      )}
    </div>
  )
}
