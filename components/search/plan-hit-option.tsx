"use client"

import { MapPinIcon, PackageIcon, WrenchIcon, type LucideIcon } from "lucide-react"
import type { Room } from "@/lib/data"
import { placeLabel } from "@/lib/parts"
import type { PlanHit } from "@/lib/search"
import { cn } from "@/lib/utils"

type PartHit = Exclude<PlanHit, { kind: "equipment" }>

const KIND: Record<PartHit["kind"], { icon: LucideIcon; label: string }> = {
  stored: { icon: PackageIcon, label: "Stored" },
  installed: { icon: WrenchIcon, label: "Installed" },
  inventory: { icon: MapPinIcon, label: "Inventory only" },
}

export function planHitWhere(room: Room, hit: PartHit) {
  switch (hit.kind) {
    case "stored":
      return `${room.name} · ${placeLabel(hit.location)} · ${hit.location.qty} in stock`
    case "installed":
      return `${room.name} · in ${hit.object.name.toLowerCase()} ${hit.equipment.assetId}`
    case "inventory":
      return `${room.name} · ${placeLabel(hit.location, { shelf: false })} · ${hit.location.qty}`
  }
}

/** A part result on the plan: the icon says whether it is a spare in a bin, fitted in a unit, or on a shelf with no scene. */
export function PlanHitOption({
  id,
  room,
  hit,
  active,
  onOpen,
  onHover,
}: {
  id: string
  room: Room
  hit: PartHit
  active: boolean
  onOpen: () => void
  onHover: () => void
}) {
  const { icon: Icon, label } = KIND[hit.kind]
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
      <Icon aria-hidden className={cn("size-4 shrink-0", hit.kind === "inventory" ? "text-muted-foreground" : "text-primary")} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {hit.part.name}
          <span className="ml-1.5 font-mono text-label font-normal text-muted-foreground">{hit.part.partNo}</span>
        </span>
        <span className="truncate text-label text-muted-foreground">
          <span className="sr-only">{`${label}: `}</span>
          {planHitWhere(room, hit)}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-label text-muted-foreground">
        {label.toLowerCase()}
      </span>
    </li>
  )
}
