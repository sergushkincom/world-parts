"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon, CrosshairIcon, SearchIcon, Share2Icon, XIcon } from "lucide-react"
import { COPY, OBJECT_PALETTE, ROOMS, type Equipment, type RoomId, type WorldObject } from "@/lib/data"
import { formatCount } from "@/lib/geometry"
import { copyText } from "@/lib/clipboard"
import {
  binContents,
  binOf,
  equipmentFor,
  getEquipment,
  getPart,
  partsInstalledIn,
  placeLabel,
  spareInWorld,
  stockedSubstitute,
} from "@/lib/parts"
import { cn } from "@/lib/utils"
import { navigate, type Route } from "@/hooks/use-hash-route"
import { activatedByPointer, useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { PartDrawer } from "@/components/parts/part-drawer"
import { DRAWABLE, useWorld, type CardTab } from "@/components/world/world-provider"
import { StatusBadge } from "@/components/world/status-badge"
import { MatchBadge } from "@/components/parts/match-badge"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

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
    </div>
  )
}

function locationLine(object: WorldObject) {
  const equipment = equipmentFor(object)
  const roomId = equipment?.room ?? object.room
  const room = roomId ? ROOMS.find((r) => r.id === roomId)?.name : null
  const place = equipment?.assetId ? `${equipment.name} ${equipment.assetId}` : object.name
  return room ? `${room} · ${place}` : place
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
        const active = part.partNo === highlight
        // No spare of its own: offer a stocked substitute, and send the camera to that one instead.
        const sub = part.storedIn.length ? undefined : stockedSubstitute(part)
        const target = sub ? sub.part : part
        const bin = spareInWorld(target)
        const store = bin ? getEquipment(bin.assetId) : undefined
        const stockText = (p: typeof part) =>
          p.storedIn.map((l) => `${placeLabel(l, { shelf: false })} · ${l.qty}`).join(", ")
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
            {sub && (
              <div className="flex flex-col gap-1 rounded-md border border-dashed p-2">
                <span className="text-label text-muted-foreground">No spare of this part.</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <MatchBadge match={sub.match} />
                  <button
                    type="button"
                    onClick={() => onOpenPart(sub.part.partNo)}
                    className="rounded-sm font-mono text-label outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {sub.part.partNo}
                  </button>
                </span>
                <span className="text-label text-muted-foreground text-pretty">{sub.reason}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-label text-muted-foreground text-pretty">
                {target.storedIn.length ? `${sub ? "substitute" : "spare"}: ${stockText(target)}` : "no spare in stock"}
              </span>
              <Button
                size="xs"
                variant="secondary"
                disabled={!store}
                title={store ? undefined : "No spare in a scanned room"}
                onClick={() =>
                  store &&
                  navigate({ level: "room", room: store.room, object: store.concept, part: target.partNo, q })
                }
              >
                <SearchIcon aria-hidden data-icon="inline-start" />
                {sub ? "Find substitute" : "Find spare"}
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
export function ObjectCard({
  part = null,
  q = "",
  room,
  onNotify,
}: {
  part?: string | null
  q?: string
  room: RoomId
  onNotify: (message: string) => void
}) {
  const { state } = useWorld()
  const object = state.objects.find((o) => o.id === state.cardId)
  if (!object) return null
  return <ObjectCardBody key={object.id} object={object} part={part} q={q} room={room} onNotify={onNotify} />
}

function ObjectCardBody({
  object,
  part,
  q,
  room,
  onNotify,
}: {
  object: WorldObject
  part: string | null
  q: string
  room: RoomId
  onNotify: (message: string) => void
}) {
  const { state, closeCard, setCardTab, select, frame, openCard } = useWorld()
  const { notePointer } = useShortcutLearning()
  const [expanded, setExpanded] = React.useState(false)
  const [drawerPart, setDrawerPart] = React.useState<string | null>(null)
  const closeDrawer = React.useCallback(() => setDrawerPart(null), [])
  useDrawerEscape(drawerPart !== null, closeDrawer)

  React.useEffect(() => {
    if (!expanded || drawerPart) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (document.querySelector("[role='menu'], [role='alertdialog'], [role='dialog']")) return
      e.preventDefault()
      e.stopPropagation()
      setExpanded(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [expanded, drawerPart])

  const equipment = equipmentFor(object)
  const isStore = Boolean(equipment?.bins?.length)
  const color = OBJECT_PALETTE[object.colorIndex % OBJECT_PALETTE.length]
  const tabProps: PartTabProps = { object, equipment, highlight: part, q, onOpenPart: setDrawerPart }
  const drawable = DRAWABLE.includes(object.status)
  const index = state.objects.findIndex((o) => o.id === object.id)
  const location = locationLine(object)

  const stepTo = (delta: number) => {
    const next = state.objects[index + delta]
    if (!next) return
    select(next.id, "only")
    openCard(next.id, state.cardTab)
    if (DRAWABLE.includes(next.status)) frame(next.id)
  }

  const goTo = () => {
    select(object.id, "only")
    if (drawable) frame(object.id)
  }

  const share = async () => {
    const params = new URLSearchParams()
    params.set("room", room)
    params.set("object", object.concept)
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    onNotify((await copyText(url)) ? "Link copied" : "Couldn't copy link")
  }

  return (
    <>
    <section
      aria-label={`${object.name} card`}
      data-object-card
      className={cn(
        "z-30 flex flex-col overflow-hidden border bg-popover text-popover-foreground shadow-2xl",
        "panel:absolute panel:top-3 panel:right-3 panel:bottom-auto panel:max-h-[calc(100%-5.5rem)] panel:w-80 panel:rounded-lg",
        "max-panel:absolute max-panel:inset-x-2 max-panel:z-30 max-panel:rounded-xl",
        "max-panel:bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.75rem))]",
        expanded ? "max-panel:max-h-[calc(100%-6rem)]" : "",
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-row font-semibold">{object.name}</h2>
          <p className="truncate text-label text-muted-foreground max-panel:hidden">{location}</p>
        </div>
        <span className="max-panel:hidden">
          <StatusBadge object={object} tabIndex={-1} />
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse details" : "Expand details"}
          className="size-11 panel:hidden"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDownIcon aria-hidden /> : <ChevronUpIcon aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close card"
          aria-keyshortcuts="Escape"
          className="max-panel:size-11 panel:size-8"
          onClick={(event) => {
            if (activatedByPointer(event)) notePointer("escape")
            closeCard()
          }}
        >
          <XIcon aria-hidden />
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <p className={cn("w-full truncate text-label text-muted-foreground panel:hidden", !expanded && "max-panel:hidden")}>
          {location}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              disabled={!drawable}
              aria-keyshortcuts="g"
              className="max-panel:h-11"
              onClick={(event) => {
                if (activatedByPointer(event)) notePointer("go")
                goTo()
              }}
            >
              <CrosshairIcon aria-hidden data-icon="inline-start" />
              Go to
              <Kbd className="max-panel:hidden">G</Kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Go to · G</TooltipContent>
        </Tooltip>
        <div className={cn("flex items-center gap-1.5", !expanded && "max-panel:hidden")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous object"
              aria-keyshortcuts="ArrowUp"
              disabled={index <= 0}
              className="max-panel:size-11"
              onClick={(event) => {
                if (activatedByPointer(event)) notePointer("prev-next")
                stepTo(-1)
              }}
            >
              <ChevronUpIcon aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous · ↑</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next object"
              aria-keyshortcuts="ArrowDown"
              disabled={index < 0 || index >= state.objects.length - 1}
              className="max-panel:size-11"
              onClick={(event) => {
                if (activatedByPointer(event)) notePointer("prev-next")
                stepTo(1)
              }}
            >
              <ChevronDownIcon aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next · ↓</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="max-panel:h-11" onClick={() => void share()}>
              <Share2Icon aria-hidden data-icon="inline-start" />
              Share
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>
        </div>
      </div>
      <Tabs
        value={state.cardTab}
        onValueChange={(v) => setCardTab(v as CardTab)}
        className={cn("min-h-0 gap-0 overflow-y-auto overscroll-contain p-3", !expanded && "max-panel:hidden")}
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
