"use client"

import * as React from "react"
import { CrosshairIcon, MoreHorizontalIcon, PencilIcon, RotateCwIcon, Trash2Icon } from "lucide-react"
import { OBJECT_PALETTE, TIMING, type WorldObject } from "@/lib/data"
import { formatCount } from "@/lib/geometry"
import { cn } from "@/lib/utils"
import { DRAWABLE, useWorld, type SelectMode } from "@/components/world/world-provider"
import { StatusBadge } from "@/components/world/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

function modeFrom(e: React.MouseEvent | React.KeyboardEvent): SelectMode {
  if (e.shiftKey) return "range"
  if (e.metaKey || e.ctrlKey) return "toggle"
  return "only"
}

function metaLine(o: WorldObject) {
  if (o.status === "queued") return "Waiting for the server"
  if (o.status === "segmenting") return "Segment view, then lift to splats"
  if (o.status === "failed") return o.failReason ?? "Segmentation failed"
  const base = `${formatCount(o.splats ?? 0)} splats · ${o.views} views`
  return o.status === "low_confidence" ? `${base} · ${o.votes} votes` : base
}

export function ObjectRow({ object: o }: { object: WorldObject }) {
  const { state, select, setActive, hover, frame, rename, remove, retry, registerRow, focusRow } = useWorld()
  const [editing, setEditing] = React.useState(false)
  const openRenameRef = React.useRef(false)
  const selected = state.selection.includes(o.id)
  const hovered = state.hoveredId === o.id
  const rovingTab = state.activeId === o.id ? 0 : -1
  const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
  const drawable = DRAWABLE.includes(o.status)
  const metaId = `${o.id}-meta`

  const doFrame = () => {
    select(o.id, "only")
    frame(o.id)
  }

  const finishRename = (value: string | null) => {
    if (value !== null) rename(o.id, value)
    setEditing(false)
    requestAnimationFrame(() => focusRow(o.id))
  }

  return (
    <li
      className={cn(
        "group/row relative flex min-h-12 items-center gap-2.5 px-panel-x py-1.5",
        "motion-transition transition-colors",
        selected ? "bg-accent" : hovered && "bg-accent/50",
      )}
      onPointerEnter={() => drawable && hover(o.id)}
      onPointerLeave={() => hover(null)}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: color }} />}
      <Checkbox
        tabIndex={-1}
        checked={selected}
        aria-label={`Select ${o.name}`}
        onClick={(e) => {
          e.preventDefault()
          select(o.id, e.shiftKey ? "range" : "toggle")
        }}
      />
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-sm", !drawable && "opacity-40")}
        style={{ backgroundColor: color }}
      />

      {editing ? (
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            finishRename(new FormData(e.currentTarget).get("name") as string)
          }}
        >
          <Input
            name="name"
            defaultValue={o.name}
            aria-label={`Rename ${o.name}`}
            autoFocus
            maxLength={40}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => finishRename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                finishRename(null)
              }
            }}
            className="h-7 text-row"
          />
        </form>
      ) : (
        <button
          ref={(el) => registerRow(o.id, el)}
          type="button"
          data-object-row
          tabIndex={rovingTab}
          aria-pressed={selected}
          aria-describedby={metaId}
          aria-keyshortcuts="Space Enter F F2 Delete"
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-sm text-left outline-offset-4"
          onFocus={() => setActive(o.id)}
          onClick={(e) => select(o.id, modeFrom(e))}
          onDoubleClick={() => drawable && doFrame()}
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.preventDefault()
              select(o.id, e.shiftKey ? "range" : "toggle")
            } else if (e.key === "Enter") {
              e.preventDefault()
              select(o.id, modeFrom(e))
            } else if ((e.key === "f" || e.key === "F") && drawable) {
              e.preventDefault()
              doFrame()
            } else if (e.key === "F2") {
              e.preventDefault()
              setEditing(true)
            } else if (e.key === "Delete" || e.key === "Backspace") {
              e.preventDefault()
              remove(o.id)
            }
          }}
        >
          <span className="w-full truncate text-row font-medium">{o.name}</span>
          <span
            id={metaId}
            title={o.status === "failed" ? o.failReason : undefined}
            className={cn(
              "w-full truncate text-label tabular-nums text-muted-foreground",
              o.status === "failed" && "text-status-failed",
            )}
          >
            {metaLine(o)}
          </span>
          {o.status === "segmenting" && (
            <span aria-hidden className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-muted">
              <span
                key={o.startedAt}
                className="segment-progress block h-full bg-status-active"
                style={{ "--segment-ms": `${TIMING.segmentMsPerView}ms` } as React.CSSProperties}
              />
            </span>
          )}
        </button>
      )}

      {o.status === "failed" ? (
        <Button variant="outline" size="xs" tabIndex={rovingTab} onClick={() => retry(o.id)} aria-label={`Retry ${o.name}`}>
          <RotateCwIcon aria-hidden data-icon="inline-start" />
          Retry
        </Button>
      ) : (
        <StatusBadge object={o} tabIndex={rovingTab} />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            tabIndex={rovingTab}
            aria-label={`Actions for ${o.name}`}
            className="text-muted-foreground"
          >
            <MoreHorizontalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44"
          onCloseAutoFocus={(e) => {
            if (openRenameRef.current) {
              e.preventDefault()
              openRenameRef.current = false
              setEditing(true)
            }
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={!drawable} onSelect={doFrame}>
              <CrosshairIcon aria-hidden />
              Frame
              <DropdownMenuShortcut>F</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => (openRenameRef.current = true)}>
              <PencilIcon aria-hidden />
              Rename
              <DropdownMenuShortcut>F2</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={() => remove(o.id)}>
              <Trash2Icon aria-hidden />
              Remove
              <DropdownMenuShortcut>Del</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
