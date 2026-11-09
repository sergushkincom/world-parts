"use client"

import * as React from "react"
import { BoxIcon, ExternalLinkIcon, MapPinIcon } from "lucide-react"
import { COPY, CURRENCY, type Part } from "@/lib/data"
import { getEquipment, getPart, isInWorld, locationLabel, stockedSubstitute } from "@/lib/parts"
import { cn } from "@/lib/utils"
import type { Route } from "@/hooks/use-hash-route"
import { PartStatusChips } from "@/components/parts/part-status"
import { MatchBadge } from "@/components/parts/match-badge"
import { RouteLink, equipmentRoute, locationRoute } from "@/components/parts/route-link"
import { Button } from "@/components/ui/button"

const price = new Intl.NumberFormat(CURRENCY.locale, { style: "currency", currency: CURRENCY.code })
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const fmtDate = (iso: string) => date.format(new Date(`${iso}T00:00:00Z`))

const chip =
  "inline-flex min-h-7 items-center gap-1.5 rounded-md border bg-secondary px-2 py-1 text-label text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5 border-t pt-3">
      <h3 id={id} className="text-label font-medium text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Everything known about one part. Shared by the list drawer and the room's object card;
 * `partRoute` decides where a similar part opens (the list drawer, or the card in the room).
 */
export function PartDetail({
  part,
  partRoute,
  headingRef,
}: {
  part: Part
  partRoute: (partNo: string) => Route
  headingRef?: React.Ref<HTMLHeadingElement>
}) {
  const facts: [string, string][] = [
    ["Supplier", part.supplier],
    ["Unit price", price.format(part.unitPrice)],
    ["Last counted", fmtDate(part.lastCounted)],
    ["Idle since", part.idleSince ? fmtDate(part.idleSince) : "—"],
  ]
  const installed = part.installedIn.map(getEquipment).filter((e) => !!e)
  const substitute = part.storedIn.length ? undefined : stockedSubstitute(part)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-label text-muted-foreground">{part.partNo}</p>
        <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-balance outline-none">
          {part.name}
        </h2>
        <PartStatusChips part={part} />
        <p className="mt-1 text-row text-muted-foreground text-pretty">{part.description}</p>
      </div>

      <Section title={`Stock by location · ${part.stock} total`}>
        {part.storedIn.length ? (
          <ul className="flex flex-col gap-1">
            {part.storedIn.map((l, i) => {
              const inWorld = isInWorld(l)
              return (
                <li key={i}>
                  <RouteLink
                    to={locationRoute(part, l)}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-row hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {inWorld ? (
                      <BoxIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <MapPinIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">{locationLabel(l)}</span>
                    <span className="shrink-0 text-label text-muted-foreground">
                      {inWorld ? "in world" : "inventory only"}
                    </span>
                  </RouteLink>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-row text-muted-foreground">No spares in stock — installed only.</p>
            {substitute && (
              <RouteLink to={partRoute(substitute.part.partNo)} className={cn(chip, "w-fit")}>
                <MatchBadge match={substitute.match} />
                <span>{`${substitute.part.partNo} in stock · ${substitute.part.stock}`}</span>
              </RouteLink>
            )}
          </div>
        )}
      </Section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-3 text-label">
        {facts.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </React.Fragment>
        ))}
      </dl>

      {part.aliases.length > 0 && (
        <Section title={`Also known as · ${part.aliases.length + 1} records merged into one`}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-label">
            {part.aliases.map((a) => (
              <React.Fragment key={`${a.source}-${a.value}`}>
                <dt className="text-muted-foreground">{a.source}</dt>
                <dd className="min-w-0 font-mono text-pretty">{a.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Section>
      )}

      <Section title="Installed in">
        {installed.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {installed.map((eq) => (
              <li key={eq.assetId}>
                <RouteLink to={equipmentRoute(eq, part)} className={chip} aria-label={`Frame ${eq.name} ${eq.assetId} in the ${eq.room}`}>
                  <span>{eq.name}</span>
                  <span className="font-mono text-muted-foreground">{eq.assetId}</span>
                </RouteLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-row text-muted-foreground">Not fitted in any registered equipment.</p>
        )}
      </Section>

      <Section title="Substitutes and similar parts">
        {part.similar.length ? (
          <ul className="flex flex-col gap-1.5">
            {part.similar.map((s) => {
              const other = getPart(s.partNo)
              return (
                <li key={s.partNo}>
                  <RouteLink to={partRoute(s.partNo)} className={cn(chip, "w-full flex-col items-start gap-1")}>
                    <span className="flex w-full flex-wrap items-center justify-between gap-1.5">
                      <span className="font-mono">{s.partNo}</span>
                      <MatchBadge match={s.match} />
                    </span>
                    <span className="text-muted-foreground text-pretty">{s.reason}</span>
                    {other && s.match !== "related" && (
                      <span className="text-muted-foreground">
                        {other.stock ? `${other.stock} in stock` : "none in stock"}
                      </span>
                    )}
                  </RouteLink>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-row text-muted-foreground">No similar parts on file.</p>
        )}
      </Section>

      {/* Mocked: no parts system is connected, so the action is shown but disabled. */}
      <Button size="sm" variant="outline" disabled title="No parts system connected">
        <ExternalLinkIcon aria-hidden data-icon="inline-start" />
        {COPY.openInPartsSystem.replace(" ↗", "")}
      </Button>
    </div>
  )
}
