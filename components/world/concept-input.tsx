"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { COPY, SUGGESTED_CONCEPTS } from "@/lib/data"
import { isSearchable, type WorldHit } from "@/lib/search"
import { cn } from "@/lib/utils"
import { useWorldHits } from "@/hooks/use-world-hits"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { WorldHitOption } from "@/components/search/world-hit-option"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"

const LISTBOX_ID = "room-results"
const optionId = (hit: WorldHit) => `${LISTBOX_ID}-${hit.object.id}`

export function ConceptInput() {
  const { state, conceptInputRef, setDraft, segmentDraft, submitConcept, select, frame, openCard } = useWorld()
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const hits = useWorldHits(state.draft)
  const offline = state.serverStatus !== "online"
  const hintId = "concept-hint"
  const showResults = open && isSearchable(state.draft) && hits.length > 0
  const active = hits[activeIndex]

  React.useEffect(() => setActiveIndex(-1), [state.draft])

  const openHit = (hit: WorldHit) => {
    setOpen(false)
    select(hit.object.id, "only")
    frame(hit.object.id)
    openCard(hit.object.id, "part")
  }

  const hint =
    state.notice?.text ??
    (state.serverStatus === "checking"
      ? "Connecting to the segmentation server…"
      : state.serverStatus === "unreachable"
        ? "Server unreachable — segment view is paused."
        : isSearchable(state.draft)
          ? hits.length
            ? `${hits.length} in this room · ${COPY.searchHintRoom}`
            : `Not in this room yet — Enter segments "${state.draft.trim()}" in this view.`
          : COPY.conceptLimit)
  const isError = state.notice?.tone === "error" || state.serverStatus === "unreachable"

  return (
    <section aria-label="Find or segment" className="flex flex-col gap-2.5 px-panel-x py-section-y max-panel:gap-2 max-panel:py-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const hit = showResults ? (active ?? hits[0]) : hits.length && isSearchable(state.draft) ? hits[0] : undefined
          if (hit) openHit(hit)
          else segmentDraft()
        }}
      >
        <label htmlFor="concept-input" className="text-label font-medium uppercase tracking-wider text-muted-foreground">
          {COPY.conceptLabel}
        </label>
        <div className="relative flex items-center gap-2">
          <Input
            className="min-w-0 flex-1"
            id="concept-input"
            ref={conceptInputRef}
            role="combobox"
            aria-expanded={showResults}
            aria-controls={LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={showResults && active ? optionId(active) : undefined}
            aria-keyshortcuts="/"
            value={state.draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
              if ((e.key === "ArrowDown" || e.key === "ArrowUp") && hits.length) {
                e.preventDefault()
                setOpen(true)
                const step = e.key === "ArrowDown" ? 1 : -1
                setActiveIndex((i) => (i === -1 && step === -1 ? hits.length - 1 : (i + step + hits.length) % hits.length))
              }
              if (e.key === "Escape") {
                e.stopPropagation()
                if (showResults) setOpen(false)
                else e.currentTarget.blur()
              }
            }}
            placeholder={COPY.conceptPlaceholder}
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            aria-invalid={state.notice?.tone === "error" || undefined}
            aria-describedby={hintId}
          />
          <Button type="submit" disabled={offline || !state.draft.trim()} aria-keyshortcuts="g">
            {COPY.segmentButton}
            <Kbd aria-hidden className="bg-primary-foreground/15 text-primary-foreground max-panel:hidden">
              G
            </Kbd>
          </Button>

          {showResults && (
            <ul
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Matches in this room"
              className="absolute top-full inset-x-0 z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-xl"
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
        </div>
        <p
          id={hintId}
          aria-live="polite"
          className={cn("text-label leading-snug text-muted-foreground", isError && "text-destructive")}
        >
          {hint}
        </p>
      </form>

      <ul
        aria-label="Suggested concepts"
        onScroll={(e) => {
          const el = e.currentTarget
          el.dataset.end = String(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
        }}
        className={cn(
          "no-scrollbar -mx-panel-x flex gap-1.5 px-panel-x panel:flex-wrap",
          "max-panel:overflow-x-auto max-panel:overscroll-x-contain",
          "max-panel:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]",
          "max-panel:data-[end=true]:[mask-image:none]",
        )}
      >
        {SUGGESTED_CONCEPTS.map((concept) => {
          const existing = state.objects.find((o) => o.concept === concept)
          const done = existing && DRAWABLE.includes(existing.status)
          const pending = existing && (existing.status === "queued" || existing.status === "segmenting")
          return (
            <li key={concept}>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="rounded-full font-normal"
                disabled={offline || pending}
                aria-label={done ? `${concept}, already lifted — frame it` : `Segment ${concept}`}
                onClick={() => submitConcept(concept)}
              >
                {pending ? <Spinner aria-hidden /> : done ? <CheckIcon aria-hidden data-icon="inline-start" /> : null}
                {concept}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
