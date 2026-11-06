"use client"

import { useWorldShortcuts } from "@/hooks/use-world-shortcuts"
import { Scene } from "@/components/world/scene"
import { SegmentationPanel } from "@/components/world/segmentation-panel"

export function AppShell() {
  useWorldShortcuts()
  return (
    <div className="flex h-dvh flex-col panel:flex-row">
      <main className="relative min-h-0 flex-1">
        <h1 className="sr-only">world-parts — segmented scene</h1>
        <Scene />
      </main>
      <SegmentationPanel />
    </div>
  )
}
