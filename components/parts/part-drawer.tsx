"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { getPart } from "@/lib/parts"
import type { Route } from "@/hooks/use-hash-route"
import { PartDetail } from "@/components/parts/part-detail"
import { Button } from "@/components/ui/button"

/** Right-side drawer on desktop, full-screen sheet on phones. Esc is handled by the owning view. */
export function PartDrawer({
  partNo,
  onClose,
  partRoute,
}: {
  partNo: string
  onClose: () => void
  partRoute: (partNo: string) => Route
}) {
  const part = getPart(partNo)
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [partNo])

  return (
    <aside
      aria-label={part ? `${part.name} details` : "Part details"}
      className="fixed inset-0 z-40 flex flex-col bg-popover text-popover-foreground md:inset-y-0 md:right-0 md:left-auto md:w-96 md:border-l md:shadow-2xl"
    >
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-label font-medium text-muted-foreground">Part</p>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" aria-keyshortcuts="Escape" onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {part ? (
          <PartDetail part={part} partRoute={partRoute} headingRef={headingRef} />
        ) : (
          <div role="alert" className="flex flex-col gap-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">
              Part not found
            </h2>
            <p className="text-row text-muted-foreground">
              <span className="font-mono">{partNo}</span>
              {" isn't in the inventory. The link may be out of date."}
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
