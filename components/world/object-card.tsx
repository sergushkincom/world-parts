"use client"

import * as React from "react"
import { CrosshairIcon, SearchIcon, XIcon } from "lucide-react"
import { COPY, OBJECT_PALETTE, type Equipment, type WorldObject } from "@/lib/data"
import { formatCount } from "@/lib/geometry"
import {
  binContents,
  binOf,
  equipmentFor,
  getEquipment,
  getPart,
  isBin,
  isInWorld,
  partsInstalledIn,
  placeLabel,
} from "@/lib/parts"
import { cn } from "@/lib/utils"
import { navigate, type Route } from "@/hooks/use-hash-route"
import { PartDrawer } from "@/components/parts/part-drawer"
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

type PartTabProps = {
  object: WorldObject
  equipment: Equipment | undefined
  highlight: string | null
  q: string
  onOpenPart: (partNo: string) => void
}

function PartsPending({ object }: { object: WorldObject }) {
  if (object.status === "queued" || object.status === "segmenting") {
    return <p className="text-row text-muted-foreground">Part lookup runs once the object is lifted.</p>
  }
  if (object.status === "failed") {
    return <p className="text-row text-muted-foreground">Segmentation failed — parts can&apos;t be matched to this object.</p>
  }
  return null
}

function UnitPartsTab({ object, equipment, highlight, q, onOpenPart }: PartTabProps) {
  const pending = PartsPending({ object })
  if (pending) return pending
  if (!equipment) return <p className="text-row text-muted-foreground">{COPY.notEquipment}</p>
  const parts = partsInstalledIn(equipment.assetId)
  if (!parts.length) return <p className="text-row text-muted-foreground">{COPY.noPartsInUnit}</p>
  return (
    <ul className="flex flex-col gap-1">
      {parts.map((part) => {
        const spare = part.storedIn.find((l) => isBin(l) && isInWorld(l))
        const store = spare && isBin(spare) ? getEquipment(spare.assetId) : undefined
        const active = part.partNo === highlight
        return (
          <li
            key={part.partNo}
            aria-current={active || undefined}
            className={cn("flex flex-col gap-1 rounded-md p-2", active && "bg-accent ring-1 ring-primary")}
          >
            <button
              type="button"
              onClick={() => onOpenPart(part.partNo)}
              className="flex flex-col items-start rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-mono text-label text-muted-foreground">{part.partNo}</span>
              <span className="text-row">{part.name}</span>
            </button>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-label text-muted-foreground text-pretty">
                {part.storedIn.length
                  ? `spare: ${part.storedIn.map((l) => `${placeLabel(l, { shelf: false })} · ${l.qty}`).join(", ")}`
                  : "no spare in stock"}
              </span>
              <Button
                size="xs"
                variant="secondary"
                disabled={!store}
                title={store ? undefined : "No spare in a scanned room"}
                onClick={() =>
                  store &&
                  navigate({ level: "room", room: store.room, object: store.concept, part: part.partNo, q })
                }
              >
                <SearchIcon aria-hidden data-icon="inline-start" />
                Find spare
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function BinsTab({ object, equipment, highlight, onOpenPart }: PartTabProps) {
  const pending = PartsPending({ object })
  if (pending) return pending
  const bins = equipment?.bins ?? []
  const highlightPart = getPart(highlight)
  const highlightBin = equipment && highlightPart ? binOf(highlightPart, equipment.assetId) : null
  return (
    <div className="flex flex-col gap-2">
      {highlightPart && !highlightBin && (
        <p className="text-label text-muted-foreground">{`${highlightPart.name} isn't stored in this cabinet.`}</p>
      )}
      <ul aria-label="Bins" className="grid grid-cols-2 gap-1.5">
        {bins.map((bin) => {
          const contents = binContents(equipment!.assetId, bin)
          const active = bin === highlightBin
          return (
            <li
              key={bin}
              aria-current={active || undefined}
              className={cn(
                "flex min-h-20 flex-col gap-1 rounded-md border p-2",
                active ? "border-primary bg-accent ring-1 ring-primary" : "bg-muted/30",
              )}
            >
              <span className="font-mono text-label font-medium">
                {bin}
                {active && <span className="sr-only"> — contains the searched part</span>}
              </span>
              {contents.length ? (
                <ul className="flex flex-col gap-0.5">
                  {contents.map(({ part, qty }) => (
                    <li key={part.partNo}>
                      <button
                        type="button"
                        onClick={() => onOpenPart(part.partNo)}
                        className={cn(
                          "flex w-full items-baseline justify-between gap-1 rounded-sm text-left text-label outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                          part.partNo === highlight && "font-semibold",
                        )}
                      >
                        <span className="min-w-0 truncate">{part.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{`×${qty}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-label text-muted-foreground">empty</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const partsListRoute = (partNo: string): Route => ({ level: "parts", q: "", part: partNo })

/** Esc closes the drawer before the room's own Esc handling (card, then back to plan). */
function useDrawerEscape(open: boolean, close: () => void) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopImmediatePropagation()
      e.preventDefault()
      close()
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [open, close])
}

/** Floating card for one object: what SAM3 made of it, and the parts in or stored in it. */
export function ObjectCard({ part = null, q = "" }: { part?: string | null; q?: string }) {
  const { state } = useWorld()
  const object = state.objects.find((o) => o.id === state.cardId)
  if (!object) return null
  return <ObjectCardBody key={object.id} object={object} part={part} q={q} />
}

function ObjectCardBody({ object, part, q }: { object: WorldObject; part: string | null; q: string }) {
  const { state, closeCard, setCardTab } = useWorld()
  const [drawerPart, setDrawerPart] = React.useState<string | null>(null)
  const closeDrawer = React.useCallback(() => setDrawerPart(null), [])
  useDrawerEscape(drawerPart !== null, closeDrawer)

  const equipment = equipmentFor(object)
  const isStore = Boolean(equipment?.bins?.length)
  const color = OBJECT_PALETTE[object.colorIndex % OBJECT_PALETTE.length]
  const tabProps: PartTabProps = { object, equipment, highlight: part, q, onOpenPart: setDrawerPart }

  return (
    <>
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
          <TabsTrigger value="part">{isStore ? "Bins" : "Parts in this unit"}</TabsTrigger>
        </TabsList>
        <TabsContent value="object">
          <ObjectTab object={object} />
        </TabsContent>
        <TabsContent value="part">{isStore ? <BinsTab {...tabProps} /> : <UnitPartsTab {...tabProps} />}</TabsContent>
      </Tabs>
    </section>
    {drawerPart && <PartDrawer partNo={drawerPart} onClose={closeDrawer} partRoute={partsListRoute} />}
    </>
  )
}
