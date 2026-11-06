"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { COPY, PLANT_STATS, SUGGESTED_CONCEPTS } from "@/lib/data"
import { isSearchable, type RoomResults, type SearchOption } from "@/lib/search"
import { cn } from "@/lib/utils"
import { useWorld } from "@/components/world/world-provider"
import { WorldHitOption } from "@/components/search/world-hit-option"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

const LISTBOX_ID = "plant-results"

function sharedNote(group: Extract<RoomResults, { kind: "inventory" }>) {
  const notes = new Set(group.hits.map((h) => h.row.note))
  return notes.size === 1 ? [...notes][0] : null
}

export function PlantSearch({
  q,
  onQuery,
  groups,
  options,
  onOpen,
  inputRef,
}: {
  q: string
  onQuery: (q: string) => void
  groups: RoomResults[]
  options: SearchOption[]
  onOpen: (option: SearchOption) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const { state } = useWorld()
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const searching = isSearchable(q)
  const showResults = open && searching
  const active = options[activeIndex]

  React.useEffect(() => setActiveIndex(-1), [q])

  const openOption = (option: SearchOption | undefined) => {
    if (!option) return
    setOpen(false)
    onOpen(option)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!options.length) return
        e.preventDefault()
        setOpen(true)
        const step = e.key === "ArrowDown" ? 1 : -1
        setActiveIndex((i) => (i === -1 && step === -1 ? options.length - 1 : (i + step + options.length) % options.length))
        return
      }
      case "Enter":
        e.preventDefault()
        openOption(active ?? options[0])
        return
      case "Escape":
        e.preventDefault()
        e.stopPropagation()
        if (showResults) setOpen(false)
        else if (q) onQuery("")
        else e.currentTarget.blur()
    }
  }

  let flatIndex = -1

  return (
    <div className="relative flex w-full max-w-xl flex-col gap-2">
      <label htmlFor="plant-search" className="sr-only">
        {COPY.conceptLabel}
      </label>
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="plant-search"
          type="text"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={showResults && active ? active.id : undefined}
          aria-keyshortcuts="/"
          value={q}
          onChange={(e) => {
            onQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={COPY.conceptPlaceholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          className="h-11 bg-card pr-10 pl-9 text-base shadow-sm md:text-sm"
        />
        {q ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onQuery("")
              inputRef.current?.focus()
            }}
          >
            <XIcon aria-hidden />
          </Button>
        ) : (
          <Kbd aria-hidden className="absolute top-1/2 right-3 -translate-y-1/2">
            /
          </Kbd>
        )}
      </div>

      {!searching && (
        <p className="text-center text-label text-muted-foreground">
          {state.hydrated ? (
            `${PLANT_STATS.roomsScanned} of ${PLANT_STATS.roomsTotal} rooms scanned · ${state.objects.length} objects in world · ${PLANT_STATS.partsInInventory} parts in inventory`
          ) : (
            <Skeleton className="mx-auto h-4 w-72" />
          )}
        </p>
      )}

      {searching && !showResults && (
        <p aria-live="polite" className="text-center text-label text-muted-foreground">
          {options.length
            ? `${options.length} ${options.length === 1 ? "match" : "matches"} in ${groups.length} ${groups.length === 1 ? "room" : "rooms"} — focus the field to see them`
            : COPY.noResults(q.trim())}
        </p>
      )}

      {showResults && (
        <div
          className={cn(
            "z-30 flex max-h-[60vh] flex-col overflow-hidden border bg-popover text-popover-foreground shadow-2xl",
            "sm:absolute sm:top-13 sm:inset-x-0 sm:rounded-lg",
            "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[65dvh] max-sm:rounded-t-xl max-sm:border-b-0",
          )}
        >
          <div className="flex items-center justify-between border-b px-3 py-2 sm:hidden">
            <span className="text-label font-medium text-muted-foreground">
              {options.length ? `${options.length} results` : "No results"}
            </span>
            <Button
              variant="ghost"
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>

          {!state.hydrated ? (
            <p className="flex items-center gap-2 p-3 text-label text-muted-foreground">
              <Spinner aria-hidden />
              Loading the world…
            </p>
          ) : options.length === 0 ? (
            <div className="flex flex-col gap-2.5 p-3">
              <p role="status" className="text-row">
                {COPY.noResults(q.trim())}
              </p>
              <ul aria-label="Suggestions" className="flex flex-wrap gap-1.5">
                {SUGGESTED_CONCEPTS.map((concept) => (
                  <li key={concept}>
                    <Button
                      variant="outline"
                      size="xs"
                      className="rounded-full font-normal"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onQuery(concept)}
                    >
                      {concept}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul id={LISTBOX_ID} role="listbox" aria-label="Search results" className="overflow-y-auto overscroll-contain p-1.5">
              {groups.map((group) => {
                const headerId = `${LISTBOX_ID}-${group.room.id}`
                const note = group.kind === "inventory" ? sharedNote(group) : null
                return (
                  <li key={group.room.id} role="presentation" className="not-first:mt-1.5">
                    <div id={headerId} className="px-2 py-1 text-label text-muted-foreground">
                      <span className="font-medium text-foreground">{group.room.name}</span>
                      {group.kind === "world" ? " · in world" : ` · inventory only${note ? ` — ${note}` : ""}`}
                    </div>
                    <ul role="group" aria-labelledby={headerId}>
                      {group.kind === "world"
                        ? group.hits.map((hit) => {
                            const option = options[++flatIndex]
                            const index = flatIndex
                            return (
                              <WorldHitOption
                                key={option.id}
                                id={option.id}
                                hit={hit}
                                active={index === activeIndex}
                                onHover={() => setActiveIndex(index)}
                                onOpen={() => openOption(option)}
                              />
                            )
                          })
                        : group.hits.map(({ row, part }) => {
                            const option = options[++flatIndex]
                            const index = flatIndex
                            return (
                              <li
                                key={option.id}
                                id={option.id}
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => openOption(option)}
                                onPointerMove={() => setActiveIndex(index)}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-row",
                                  index === activeIndex && "bg-accent text-accent-foreground",
                                )}
                              >
                                <span aria-hidden className="size-2.5 shrink-0 rounded-sm border border-dashed border-muted-foreground" />
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate font-medium">{part.name}</span>
                                  <span className="truncate text-label text-muted-foreground">
                                    <span className="font-mono">{part.number}</span>
                                    {note ? null : ` · ${row.note}`}
                                  </span>
                                </span>
                                <span className="shrink-0 text-label tabular-nums text-muted-foreground">{`${row.qty} in stock`}</span>
                              </li>
                            )
                          })}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
