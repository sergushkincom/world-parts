"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, BoxIcon, MapPinIcon } from "lucide-react"
import type { Part, StoredLocation } from "@/lib/data"
import { getRoom, installedLabel, isInWorld, locationLabel } from "@/lib/parts"
import { partPlace, type Sort, type SortKey } from "@/lib/parts-list"
import { cn } from "@/lib/utils"
import { PartStatusChips } from "@/components/parts/part-status"
import { RouteLink, locationRoute } from "@/components/parts/route-link"

type Column = { id: string; sort?: SortKey; label: string; className?: string }

const COLUMNS: Column[] = [
  { id: "partNo", sort: "partNo", label: "Part no.", className: "w-44" },
  { id: "name", sort: "name", label: "Name" },
  { id: "stock", sort: "stock", label: "Stock", className: "w-20 text-right" },
  { id: "location", sort: "location", label: "Location" },
  { id: "status", sort: "status", label: "Status", className: "w-44" },
]

/** Split view: narrower, one place per part (the one the 3D view shows). */
const COMPACT_COLUMNS: Column[] = [
  { id: "name", sort: "name", label: "Name" },
  { id: "partNo", sort: "partNo", label: "Part no." },
  { id: "room", sort: "location", label: "Room" },
  { id: "place", label: "Bin / shelf" },
  { id: "stock", sort: "stock", label: "Stock", className: "text-right" },
  { id: "status", sort: "status", label: "Status" },
]

/** ↑/↓ move between visible rows (table on desktop, cards on phones); Enter opens. */
export function focusRow(container: HTMLElement | null, index: number | "first") {
  const rows = [...(container?.querySelectorAll<HTMLElement>("[data-row]") ?? [])].filter((r) => r.offsetParent !== null)
  rows[index === "first" ? 0 : Math.max(0, Math.min(rows.length - 1, index))]?.focus()
}

const partOf = (row: HTMLElement | undefined) => row?.closest("[data-part]")?.getAttribute("data-part") ?? null

/** `onMove` gets the part a row arrow landed on (the split view selects as focus moves). */
function onRowKeyDown(
  e: React.KeyboardEvent<HTMLElement>,
  open: () => void,
  onExitTop: () => void,
  onMove?: (partNo: string) => void,
) {
  if (e.target !== e.currentTarget) return
  const container = e.currentTarget.closest<HTMLElement>("[data-rows]")
  const rows = [...(container?.querySelectorAll<HTMLElement>("[data-row]") ?? [])].filter((r) => r.offsetParent !== null)
  const i = rows.indexOf(e.currentTarget)
  const moveTo = (row: HTMLElement | undefined) => {
    if (!row) return
    row.focus()
    const partNo = partOf(row)
    if (partNo) onMove?.(partNo)
  }
  if (e.key === "ArrowDown") {
    e.preventDefault()
    moveTo(rows[i + 1])
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    if (i === 0) onExitTop()
    else moveTo(rows[i - 1])
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    open()
  }
}

function LocationLink({ part, location }: { part: Part; location: StoredLocation }) {
  const inWorld = isInWorld(location)
  return (
    <RouteLink
      to={locationRoute(part, location)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1.5 rounded text-row underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      title={inWorld ? "Open in the 3D room" : "Show on the plan"}
    >
      {inWorld ? (
        <BoxIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
      ) : (
        <MapPinIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{locationLabel(location)}</span>
    </RouteLink>
  )
}

function FullCells({ part: p }: { part: Part }) {
  return (
    <>
      <td className="border-b px-3 py-2 align-top font-mono whitespace-nowrap">{p.partNo}</td>
      <td className="border-b px-3 py-2 align-top">{p.name}</td>
      <td className="border-b px-3 py-2 text-right align-top tabular-nums">{p.stock}</td>
      <td className="border-b px-3 py-2 align-top">
        {p.storedIn.length ? (
          <ul className="flex flex-col gap-0.5">
            {p.storedIn.map((l, i) => (
              <li key={i} className="min-w-0">
                <LocationLink part={p} location={l} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">{installedLabel(p) ?? "—"}</span>
        )}
      </td>
      <td className="border-b px-3 py-2 align-top">
        <PartStatusChips part={p} />
      </td>
    </>
  )
}

function CompactCells({ part }: { part: Part }) {
  const place = partPlace(part)
  return (
    <>
      <td className="border-b px-3 py-1.5 align-top">{part.name}</td>
      <td className="border-b px-3 py-1.5 align-top font-mono text-label whitespace-nowrap">{part.partNo}</td>
      <td className="border-b px-3 py-1.5 align-top whitespace-nowrap">{place ? getRoom(place.room).name : "—"}</td>
      <td className="border-b px-3 py-1.5 align-top whitespace-nowrap text-muted-foreground">
        {place?.label ?? "—"}
        {part.storedIn.length > 1 && <span className="whitespace-nowrap">{` +${part.storedIn.length - 1}`}</span>}
      </td>
      <td className="border-b px-3 py-1.5 text-right align-top tabular-nums">{part.stock}</td>
      <td className="border-b px-3 py-1.5 align-top">
        <PartStatusChips part={part} className="flex-nowrap" />
      </td>
    </>
  )
}

export function PartsTable({
  parts,
  sort,
  onSort,
  activePart,
  onOpen,
  onExitTop,
  compact = false,
  onHover,
  onMove,
}: {
  parts: Part[]
  sort: Sort
  onSort: (key: SortKey) => void
  activePart: string | null
  onOpen: (partNo: string) => void
  onExitTop: () => void
  /** The split view's narrow table: room and bin/shelf instead of every location, no links out. */
  compact?: boolean
  /** Pointer over a row (null when it leaves). */
  onHover?: (partNo: string | null) => void
  /** ↑/↓ landed on a row. */
  onMove?: (partNo: string) => void
}) {
  const columns = compact ? COMPACT_COLUMNS : COLUMNS
  return (
    <div data-rows onPointerLeave={onHover && (() => onHover(null))}>
      <table className="hidden w-full border-separate border-spacing-0 text-row md:table">
        <caption className="sr-only">
          {compact ? "Parts inventory. Select a row to show the part in its room." : "Parts inventory. Select a row to see details."}
        </caption>
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            {columns.map((c) => {
              const active = sort.key === c.sort
              const Icon = !active ? ArrowUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon
              if (!c.sort) {
                return (
                  <th key={c.id} scope="col" className={cn("border-b px-3 py-2 text-left text-label font-medium text-muted-foreground", c.className)}>
                    {c.label}
                  </th>
                )
              }
              const key = c.sort
              return (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("border-b px-3 py-2 text-left text-label font-medium whitespace-nowrap text-muted-foreground", c.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                      active && "text-foreground",
                    )}
                  >
                    {c.label}
                    <Icon aria-hidden className={cn("size-3", !active && "opacity-50")} />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr
              key={p.partNo}
              data-row
              data-part={p.partNo}
              tabIndex={0}
              aria-selected={activePart === p.partNo}
              onClick={() => onOpen(p.partNo)}
              onKeyDown={(e) => onRowKeyDown(e, () => onOpen(p.partNo), onExitTop, onMove)}
              onPointerEnter={onHover && (() => onHover(p.partNo))}
              className="cursor-pointer scroll-mt-10 outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:shadow-[inset_2px_0_0_var(--color-ring)] aria-selected:bg-accent"
            >
              {compact ? <CompactCells part={p} /> : <FullCells part={p} />}
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label="Parts" className="flex flex-col divide-y border-y md:hidden">
        {parts.map((p) => (
          <li key={p.partNo} data-part={p.partNo} className={cn("flex flex-col gap-1 px-4 py-3", activePart === p.partNo && "bg-accent")}>
            <button
              type="button"
              data-row
              aria-pressed={compact ? activePart === p.partNo : undefined}
              onClick={() => onOpen(p.partNo)}
              onKeyDown={(e) => onRowKeyDown(e, () => onOpen(p.partNo), onExitTop, onMove)}
              onPointerEnter={onHover && (() => onHover(p.partNo))}
              className="flex flex-col items-start gap-1 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex w-full items-baseline justify-between gap-3">
                <span className="font-mono text-label text-muted-foreground">{p.partNo}</span>
                <span className="text-label tabular-nums text-muted-foreground">{`${p.stock} in stock`}</span>
              </span>
              <span className="text-row font-medium">{p.name}</span>
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {p.storedIn[0] ? (
                <LocationLink part={p} location={p.storedIn[0]} />
              ) : (
                installedLabel(p) && <span className="text-label text-muted-foreground">{installedLabel(p)}</span>
              )}
              {p.storedIn.length > 1 && (
                <span className="text-label text-muted-foreground">{`+${p.storedIn.length - 1} more`}</span>
              )}
              <PartStatusChips part={p} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
