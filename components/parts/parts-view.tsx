"use client"

import * as React from "react"
import { PackageSearchIcon, SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { COPY, PARTS, WORLD_ROOM, ROOMS } from "@/lib/data"
import { validateParts } from "@/lib/parts"
import { PART_FILTERS, matchesQuery, sortParts, type PartFilter, type Sort, type SortKey } from "@/lib/parts-list"
import { navigate } from "@/hooks/use-hash-route"
import { PartDrawer } from "@/components/parts/part-drawer"
import { PartsTable, focusRow } from "@/components/parts/parts-table"
import { ViewSwitch } from "@/components/parts/view-switch"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const subscribeNoop = () => () => {}
const roomName = ROOMS.find((r) => r.id === WORLD_ROOM)?.name ?? WORLD_ROOM

/** Level 0: the start screen. Every part, where it is, and whether to worry about it. */
export function PartsView({ q, part }: { q: string; part: string | null }) {
  const hydrated = React.useSyncExternalStore(subscribeNoop, () => true, () => false)
  const [filter, setFilter] = React.useState<PartFilter>("all")
  const [sort, setSort] = React.useState<Sort>({ key: "status", dir: "asc" })
  const inputRef = React.useRef<HTMLInputElement>(null)
  const rowsRef = React.useRef<HTMLDivElement>(null)
  const lastOpened = React.useRef<string | null>(null)

  const issues = React.useMemo(() => validateParts(), [])
  const matching = React.useMemo(() => PARTS.filter((p) => matchesQuery(p, q)), [q])
  const counts = React.useMemo(
    () => Object.fromEntries(PART_FILTERS.map((f) => [f.id, matching.filter(f.test).length])) as Record<PartFilter, number>,
    [matching],
  )
  const visible = React.useMemo(() => {
    const test = PART_FILTERS.find((f) => f.id === filter)!.test
    return sortParts(matching.filter(test), sort)
  }, [matching, filter, sort])

  const setQuery = (next: string) => navigate({ level: "parts", q: next, part }, { replace: true })
  const open = (partNo: string) => {
    lastOpened.current = partNo
    navigate({ level: "parts", q, part: partNo })
  }
  const close = React.useCallback(() => {
    navigate({ level: "parts", q, part: null })
    // Back to the row the drawer came from.
    const from = lastOpened.current
    requestAnimationFrame(() => {
      const row = [...(rowsRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])].find(
        (r) => r.offsetParent !== null && r.closest("[data-part]")?.getAttribute("data-part") === from,
      )
      ;(row ?? inputRef.current)?.focus()
    })
  }, [q])
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const inField = (e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable='true']")
      if (e.key === "/" && !inField) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === "Escape" && part && !inField) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [part, close])

  const term = q.trim()

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-col gap-3 border-b px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="hidden shrink-0 text-row font-semibold sm:block">Parts</h1>
          <div role="search" className="relative min-w-0 flex-1 sm:max-w-xl">
            <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  focusRow(rowsRef.current, "first")
                } else if (e.key === "Enter") {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  if (visible[0]) open(visible[0].partNo)
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  if (q) setQuery("")
                  else e.currentTarget.blur()
                }
              }}
              placeholder={COPY.conceptPlaceholder}
              aria-label="Search parts and equipment"
              aria-keyshortcuts="/"
              autoComplete="off"
              spellCheck={false}
              className="h-9 w-full rounded-md border bg-input/30 pr-16 pl-8 text-row outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
            />
            <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
              {q ? (
                <Button variant="ghost" size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
                  <XIcon aria-hidden />
                </Button>
              ) : (
                <Kbd aria-hidden>/</Kbd>
              )}
            </span>
          </div>
          <div className="ml-auto">
            <ViewSwitch view="parts" q={q} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(v) => v && setFilter(v as PartFilter)}
            aria-label="Filter parts"
            className="flex-wrap"
          >
            {PART_FILTERS.map((f) => (
              <ToggleGroupItem
                key={f.id}
                value={f.id}
                disabled={counts[f.id] === 0 && filter !== f.id}
                title={f.id === "room" ? `Stored in the ${roomName}` : undefined}
                className="gap-1.5 px-2.5"
              >
                {f.label}
                <span className="tabular-nums text-muted-foreground">{hydrated ? counts[f.id] : "–"}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p aria-live="polite" className="text-label text-muted-foreground">
            {hydrated && `${visible.length} of ${PARTS.length} parts`}
          </p>
        </div>
      </header>

      <main
        ref={rowsRef}
        className={`min-h-0 flex-1 overflow-y-auto transition-[padding] md:px-3 ${part ? "md:pr-[25rem]" : ""}`}
      >
        {!hydrated ? (
          <div aria-busy="true" aria-label="Loading parts" className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : issues.length > 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TriangleAlertIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{"Inventory data doesn't add up"}</EmptyTitle>
              <EmptyDescription>{issues.join(" · ")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : PARTS.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageSearchIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No parts in the inventory yet</EmptyTitle>
              <EmptyDescription>Parts appear here once the inventory is imported.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : visible.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageSearchIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{term ? COPY.noResults(term) : "No parts match this filter"}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (term) setQuery("")
                  setFilter("all")
                }}
              >
                {term ? "Clear search" : "Show all parts"}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <PartsTable
            parts={visible}
            sort={sort}
            onSort={onSort}
            activePart={part}
            onOpen={open}
            onExitTop={() => inputRef.current?.focus()}
          />
        )}
      </main>

      {part && (
        <PartDrawer partNo={part} onClose={close} partRoute={(partNo) => ({ level: "parts", q, part: partNo })} />
      )}
    </div>
  )
}
