"use client"

import { OBJECT_PALETTE } from "@/lib/data"
import { formatCount } from "@/lib/geometry"
import type { WorldHit } from "@/lib/search"
import { cn } from "@/lib/utils"

/** One "in world" search result: colour swatch, object, linked part and splat count. */
export function WorldHitOption({
  id,
  hit,
  active,
  onOpen,
  onHover,
}: {
  id: string
  hit: WorldHit
  active: boolean
  onOpen: () => void
  onHover: () => void
}) {
  const { object, equipment } = hit
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
      onPointerMove={onHover}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-row",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-sm"
        style={{ backgroundColor: OBJECT_PALETTE[object.colorIndex % OBJECT_PALETTE.length] }}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{object.name}</span>
        <span className="truncate text-label text-muted-foreground">
          {equipment ? `${equipment.assetId} · ${equipment.name}` : "Not registered equipment"}
        </span>
      </span>
      <span className="shrink-0 text-label tabular-nums text-muted-foreground">
        {`${formatCount(object.splats ?? 0)} splats`}
      </span>
    </li>
  )
}
