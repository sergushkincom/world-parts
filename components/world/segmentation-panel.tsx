"use client"

import * as React from "react"
import { LAYOUT } from "@/lib/data"
import { cn } from "@/lib/utils"
import { ConceptInput } from "@/components/world/concept-input"
import { GaussianViewControl } from "@/components/world/gaussian-view-control"
import { ObjectList } from "@/components/world/object-list"
import { PanelFooter } from "@/components/world/panel-footer"
import { PanelHeader } from "@/components/world/panel-header"
import { PanelRail } from "@/components/world/panel-rail"
import { ScanRoomBlock } from "@/components/world/scan-room-block"
import { SheetHandle } from "@/components/world/sheet-handle"
import { Separator } from "@/components/ui/separator"

export function SegmentationPanel() {
  const [collapsed, setCollapsed] = React.useState(false)
  const [snap, setSnap] = React.useState<number>(LAYOUT.sheetDefaultSnap)
  const [dragFraction, setDragFraction] = React.useState<number | null>(null)
  const expandRef = React.useRef<HTMLButtonElement>(null)
  const collapseRef = React.useRef<HTMLButtonElement>(null)

  const sheetHeight = `${(dragFraction ?? LAYOUT.sheetSnaps[snap]) * 100}dvh`

  return (
    <aside
      id="segmentation-panel"
      aria-label="Segmentation panel"
      style={{ "--sheet-h": sheetHeight } as React.CSSProperties}
      className={cn(
        "relative flex shrink-0 flex-col bg-card text-card-foreground",
        "max-panel:h-(--sheet-h) max-panel:rounded-t-xl max-panel:border-t max-panel:shadow-[0_-8px_24px_rgb(0_0_0/0.25)]",
        dragFraction === null && "motion-transition max-panel:transition-[height] max-panel:duration-300",
        "panel:h-dvh panel:border-l motion-transition panel:transition-[width] panel:duration-200",
        collapsed ? "panel:w-rail" : "panel:w-panel",
      )}
    >
      <SheetHandle snap={snap} onSnap={setSnap} onDrag={setDragFraction} />

      {collapsed && (
        <PanelRail
          expandRef={expandRef}
          onExpand={() => {
            setCollapsed(false)
            requestAnimationFrame(() => collapseRef.current?.focus())
          }}
        />
      )}

      <div className={cn("flex min-h-0 flex-1 flex-col", collapsed && "panel:hidden")}>
        <PanelHeader
          collapseRef={collapseRef}
          onCollapse={() => {
            setCollapsed(true)
            requestAnimationFrame(() => expandRef.current?.focus())
          }}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <ConceptInput />
          <Separator />
          <ObjectList />
          <ScanRoomBlock />
          <div className="mt-auto bg-card panel:sticky panel:bottom-0">
            <GaussianViewControl />
            <PanelFooter />
          </div>
        </div>
      </div>
    </aside>
  )
}
