"use client"

import * as React from "react"
import { CrosshairIcon, XIcon } from "lucide-react"
import { COPY, OBJECT_PALETTE, type Equipment, type WorldObject } from "@/lib/data"
import { formatCount } from "@/lib/geometry"
import { equipmentFor, partsInstalledIn, placeLabel } from "@/lib/parts"
import { cn } from "@/lib/utils"
import { DRAWABLE, useWorld, type CardTab } from "@/components/world/world-provider"
import { StatusBadge } from "@/components/world/status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })

function Facts({ rows }: { rows: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-label">
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-right tabular-nums text-pretty">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function ObjectTab({ object }: { object: WorldObject }) {
  const { select, frame } = useWorld()
  const drawable = DRAWABLE.includes(object.status)
  return (
    <div className="flex flex-col gap-3">
      <Facts
        rows={[
          ["Concept", object.concept],
          ["Splats", object.splats === null ? "—" : formatCount(object.splats)],
          ["Views", object.views],
          ["Votes", object.votes],
          ["First segmented", object.firstSegmentedAt ? date.format(new Date(object.firstSegmentedAt)) : "—"],
        ]}
      />
      {object.status === "failed" && object.failReason && (
        <p className="rounded-md bg-status-failed/10 px-2 py-1.5 text-label text-status-failed">{object.failReason}</p>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={!drawable}
        onClick={() => {
          select(object.id, "only")
          frame(object.id)
        }}
      >
        <CrosshairIcon aria-hidden data-icon="inline-start" />
        Frame in 3D
      </Button>
    </div>
  )
}

function UnitPartsTab({ object, equipment }: { object: WorldObject; equipment: Equipment | undefined }) {
  if (object.status === "queued" || object.status === "segmenting") {
    return <p className="text-row text-muted-foreground">Part lookup runs once the object is lifted.</p>
  }
  if (!equipment) return <p className="text-row text-muted-foreground">{COPY.notEquipment}</p>
  const parts = partsInstalledIn(equipment.assetId)
  if (!parts.length) return <p className="text-row text-muted-foreground">{COPY.noPartsInUnit}</p>
  return (
    <ul className="flex flex-col gap-2">
      {parts.map((part) => (
        <li key={part.partNo} className="flex flex-col gap-0.5">
          <span className="font-mono text-label text-muted-foreground">{part.partNo}</span>
          <span className="text-row">{part.name}</span>
          <span className="text-label text-muted-foreground">
            {part.storedIn.length
              ? `spare: ${part.storedIn.map((l) => `${placeLabel(l, { shelf: false })} · ${l.qty}`).join(", ")}`
              : "no spare in stock"}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Floating card for one object: what SAM3 made of it, and which inventory part it is. */
export function ObjectCard() {
  const { state, closeCard, setCardTab } = useWorld()
  const object = state.objects.find((o) => o.id === state.cardId)
  if (!object) return null

  const equipment = equipmentFor(object)
  const color = OBJECT_PALETTE[object.colorIndex % OBJECT_PALETTE.length]

  return (
    <section
      aria-label={`${object.name} card`}
      className={cn(
        "z-30 flex flex-col overflow-hidden border bg-popover text-popover-foreground shadow-2xl",
        "panel:absolute panel:top-14 panel:right-3 panel:max-h-[calc(100%-4.5rem)] panel:w-80 panel:rounded-lg",
        "max-panel:fixed max-panel:inset-x-0 max-panel:bottom-0 max-panel:max-h-[70dvh] max-panel:rounded-t-xl max-panel:border-b-0",
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <h2 className="min-w-0 flex-1 truncate text-row font-semibold">{object.name}</h2>
        <StatusBadge object={object} tabIndex={-1} />
        <Button variant="ghost" size="icon-xs" aria-label="Close card" aria-keyshortcuts="Escape" onClick={closeCard}>
          <XIcon aria-hidden />
        </Button>
      </header>
      <Tabs
        value={state.cardTab}
        onValueChange={(v) => setCardTab(v as CardTab)}
        className="min-h-0 gap-0 overflow-y-auto overscroll-contain p-3"
      >
        <TabsList className="mb-3 w-full">
          <TabsTrigger value="object">Object</TabsTrigger>
          <TabsTrigger value="part">Parts in this unit</TabsTrigger>
        </TabsList>
        <TabsContent value="object">
          <ObjectTab object={object} />
        </TabsContent>
        <TabsContent value="part">
          <UnitPartsTab object={object} equipment={equipment} />
        </TabsContent>
      </Tabs>
    </section>
  )
}
