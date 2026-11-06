"use client"

import * as React from "react"
import { CrosshairIcon, LinkIcon, XIcon } from "lucide-react"
import {
  CURRENCY,
  COPY,
  INVENTORY,
  LINK_PICKER_PARTS,
  OBJECT_PALETTE,
  WORLD_ROOM,
  type Part,
  type WorldObject,
} from "@/lib/data"
import { formatCount } from "@/lib/geometry"
import { getPart, stockOnHand } from "@/lib/search"
import { cn } from "@/lib/utils"
import { DRAWABLE, useWorld, type CardTab } from "@/components/world/world-provider"
import { StatusBadge } from "@/components/world/status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const price = new Intl.NumberFormat(CURRENCY.locale, { style: "currency", currency: CURRENCY.code })
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

function LinkPicker({ concept }: { concept: string }) {
  const { linkPart } = useWorld()
  const [open, setOpen] = React.useState(false)
  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-row text-muted-foreground">{COPY.noPartLinked}</p>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <LinkIcon aria-hidden data-icon="inline-start" />
          Link a part
        </Button>
      </div>
    )
  }
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-label text-muted-foreground">{`Link "${concept}" to a part`}</legend>
      {LINK_PICKER_PARTS.map((number) => {
        const part = getPart(number)!
        return (
          <Button
            key={number}
            variant="outline"
            size="sm"
            className="h-auto justify-start py-1.5 text-left font-normal"
            onClick={() => linkPart(concept, number)}
          >
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-label">{part.number}</span>
              <span className="truncate">{part.name}</span>
            </span>
          </Button>
        )
      })}
      <Button variant="ghost" size="xs" className="self-start" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </fieldset>
  )
}

function PartTab({ object, part, location }: { object: WorldObject; part: Part | undefined; location: string }) {
  if (object.status === "queued" || object.status === "segmenting") {
    return <p className="text-row text-muted-foreground">Part lookup runs once the object is lifted.</p>
  }
  if (!part) return <LinkPicker concept={object.concept} />

  const here = INVENTORY.find((r) => r.partNumber === part.number && r.roomId === WORLD_ROOM)?.qty ?? 0
  const rows: [string, React.ReactNode][] = [
    ["Stock on hand", `${stockOnHand(part.number)} in plant · ${here} here`],
    ["Location", location],
    ["Supplier", part.supplier],
    ["Unit price", price.format(part.unitPrice)],
  ]
  if (part.idleSince) rows.push(["Idle since", date.format(new Date(part.idleSince))])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="font-mono text-label text-muted-foreground">{part.number}</p>
        <p className="text-row font-semibold">{part.name}</p>
        <p className="text-label text-muted-foreground text-pretty">{part.description}</p>
      </div>
      <Facts rows={rows} />
      <section aria-labelledby="similar-heading" className="flex flex-col gap-1.5 border-t pt-2.5">
        <h3 id="similar-heading" className="text-label font-medium text-muted-foreground">
          Similar parts
        </h3>
        <ul className="flex flex-col gap-1">
          {part.similar.map((s) => (
            <li key={s.number} className="flex items-baseline gap-2 text-label">
              <span className="shrink-0 font-mono">{s.number}</span>
              <span className="min-w-0 text-muted-foreground text-pretty">{s.reason}</span>
            </li>
          ))}
        </ul>
      </section>
      {/* Mocked: there is no parts system to open yet. */}
      <Button size="sm" variant="outline" onClick={() => {}}>
        {COPY.openInPartsSystem}
      </Button>
    </div>
  )
}

/** Floating card for one object: what SAM3 made of it, and which inventory part it is. */
export function ObjectCard() {
  const { state, closeCard, setCardTab } = useWorld()
  const object = state.objects.find((o) => o.id === state.cardId)
  if (!object) return null

  const link = state.partLinks[object.concept]
  const part = getPart(link?.partNumber)
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
          <TabsTrigger value="part">Part</TabsTrigger>
        </TabsList>
        <TabsContent value="object">
          <ObjectTab object={object} />
        </TabsContent>
        <TabsContent value="part">
          <PartTab object={object} part={part} location={link?.location ?? "—"} />
        </TabsContent>
      </Tabs>
    </section>
  )
}
