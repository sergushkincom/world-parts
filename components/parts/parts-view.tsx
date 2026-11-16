"use client"

import * as React from "react"
import { PackageSearchIcon, SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { COPY, PARTS, PARTS_SUMMARY, ROOMS, type Part, type RoomId } from "@/lib/data"
import { validateParts } from "@/lib/parts"
import { getPart } from "@/lib/parts"
import {
  PART_FILTERS,
  matchesQuery,
  partAtAsset,
  partPlace,
  sortParts,
  type PartFilter,
  type Sort,
  type SortKey,
} from "@/lib/parts-list"
import { navigate, type Route } from "@/hooks/use-hash-route"
import { useMediaQuery } from "@/hooks/use-media-query"
import { PartDrawer } from "@/components/parts/part-drawer"
import { PartsTable, focusRow } from "@/components/parts/parts-table"
import { SplitPane } from "@/components/parts/split-pane"
import { SplitStage, type StageFocus } from "@/components/parts/split-stage"
import { ViewSwitch } from "@/components/parts/view-switch"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const subscribeNoop = () => () => {}
const scannedRooms = ROOMS.filter((r) => r.scanned).map((r) => r.name.toLowerCase()).join(", ")

/**
 * Level 0: the start screen. Every part, where it is, and whether to worry about it.
 * `split` puts a compact list next to the selected part's room in 3D, selection shared both ways.
 */
export function PartsView({ q, part, split = false }: { q: string; part: string | null; split?: boolean }) {
  const hydrated = React.useSyncExternalStore(subscribeNoop, () => true, () => false)
  const [filter, setFilter] = React.useState<PartFilter>("all")
  const [sort, setSort] = React.useState<Sort>({ key: "status", dir: "asc" })
  const inputRef = React.useRef<HTMLInputElement>(null)
  const rowsRef = React.useRef<HTMLDivElement>(null)
  const lastOpened = React.useRef<string | null>(null)
  const [previewPart, setPreviewPart] = React.useState<string | null>(null)
  const [pickNote, setPickNote] = React.useState<string | null>(null)
  // Equipment picked in 3D. The row it selects may keep its spare elsewhere; the camera stays on the pick
  // until the next selection from the list.
  const [stageFocus, setStageFocus] = React.useState<StageFocus | null>(null)
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const route = React.useCallback(
    (next: { q?: string; part: string | null }): Route => ({ level: split ? "split" : "parts", q: next.q ?? q, part: next.part }),
    [split, q],
  )

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

  const setQuery = (next: string) => navigate(route({ q: next, part }), { replace: true })
  // In the split view every row change is a selection; one history entry per row would bury the back button.
  const open = (partNo: string) => {
    lastOpened.current = partNo
    setPickNote(null)
    setStageFocus(null)
    navigate(route({ part: partNo }), { replace: split })
  }
  const close = React.useCallback(() => {
    setStageFocus(null)
    navigate(route({ part: null }), { replace: split })
    // Back to the row the drawer came from.
    const from = lastOpened.current
    requestAnimationFrame(() => {
      const row = [...(rowsRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])].find(
        (r) => r.offsetParent !== null && r.closest("[data-part]")?.getAttribute("data-part") === from,
      )
      ;(row ?? inputRef.current)?.focus()
    })
  }, [route, split])

  // 3D → list: of the parts kept in or fitted in that equipment, keep the current one, else the first the list
  // shows (parts whose 3D place is that equipment first).
  const pickFromWorld = ({ room, assetId, name: objectName }: { room: RoomId; assetId: string | null; name: string }) => {
    const at = (p: Part) => assetId !== null && partAtAsset(p, assetId)
    const home = (p: Part) => at(p) && partPlace(p)?.assetId === assetId
    const current = getPart(part)
    const next = current && at(current) ? current : (visible.find(home) ?? visible.find(at) ?? PARTS.find(at))
    setStageFocus(assetId ? { room, assetId } : null)
    if (!next) {
      setPickNote(`${objectName}: no parts on record`)
      return
    }
    setPickNote(visible.includes(next) ? null : `${next.name} is hidden by the current search or filter`)
    if (next.partNo !== part) navigate(route({ part: next.partNo }), { replace: true })
  }

  // Keep the selected row in view, wherever the selection came from.
  React.useEffect(() => {
    if (!split || !part || !hydrated) return
    const row = [...(rowsRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])].find(
      (r) => r.offsetParent !== null && r.closest("[data-part]")?.getAttribute("data-part") === part,
    )
    row?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" })
  }, [split, part, hydrated, reducedMotion])
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

  const list = !hydrated ? (
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
      compact={split}
      onHover={split ? setPreviewPart : undefined}
      onMove={split ? open : undefined}
    />
  )

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex flex-col gap-3 border-b px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center gap-3 max-[600px]:flex-wrap">
          <h1 className="hidden shrink-0 text-row font-semibold sm:block">Parts</h1>
          <div role="search" className="relative min-w-0 flex-1 max-[600px]:basis-full sm:max-w-xl">
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
          <div className="ml-auto max-[600px]:ml-0">
            <ViewSwitch view={split ? "split" : "parts"} q={q} part={part} />
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
                title={f.id === "room" ? `Stored or installed in a scanned room: ${scannedRooms}` : undefined}
                className="gap-1.5 px-2.5"
              >
                {f.label}
                <span className="tabular-nums text-muted-foreground">{hydrated ? counts[f.id] : "–"}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p aria-live="polite" className="text-label text-muted-foreground">
            {hydrated &&
              (visible.length === PARTS.length ? PARTS_SUMMARY : `${visible.length} of ${PARTS_SUMMARY}`)}
            {split && pickNote && ` · ${pickNote}`}
          </p>
        </div>
      </header>

      {split ? (
        <SplitPane
          list={
            <div ref={rowsRef} className="h-full overflow-auto">
              {list}
            </div>
          }
          stage={
            <SplitStage
              part={getPart(part) ?? null}
              focus={stageFocus}
              previewPart={getPart(previewPart) ?? null}
              onPickPart={pickFromWorld}
            />
          }
        />
      ) : (
        <main
          ref={rowsRef}
          className={`min-h-0 flex-1 overflow-y-auto transition-[padding] md:px-3 ${part ? "md:pr-[25rem]" : ""}`}
        >
          {list}
        </main>
      )}

      {part && !split && (
        <PartDrawer partNo={part} onClose={close} partRoute={(partNo) => ({ level: "parts", q, part: partNo })} />
      )}
    </div>
  )
}
