"use client"

import { BoxesIcon } from "lucide-react"
import { COPY } from "@/lib/data"
import { activatedByPointer, useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { useWorld } from "@/components/world/world-provider"
import { ObjectRow } from "@/components/world/object-row"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

export function ObjectList() {
  const { state, setSelection, clearSelection, loadSeed } = useWorld()
  const { notePointer } = useShortcutLearning()
  const total = state.objects.length
  const selectedCount = state.selection.length
  const allChecked = total > 0 && selectedCount === total
  const segmenting = state.objects.find((o) => o.status === "segmenting")

  return (
    <section aria-labelledby="objects-heading" className="flex flex-col py-2">
      <div className="flex h-8 items-center gap-2.5 px-panel-x">
        <Checkbox
          aria-label="Select all objects"
          disabled={!total}
          checked={allChecked ? true : selectedCount > 0 ? "indeterminate" : false}
          onCheckedChange={() => (allChecked ? clearSelection() : setSelection(state.objects.map((o) => o.id)))}
        />
        <h3 id="objects-heading" className="text-label font-medium uppercase tracking-wider text-muted-foreground">
          Objects <span className="tabular-nums">{state.hydrated ? total : ""}</span>
        </h3>
        {selectedCount > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <span className="text-label tabular-nums text-muted-foreground">{selectedCount} selected</span>
            <Button
              variant="ghost"
              size="xs"
              aria-keyshortcuts="Escape"
              onClick={(event) => {
                if (activatedByPointer(event)) notePointer("escape")
                clearSelection()
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {segmenting ? `Segmenting ${segmenting.concept}` : ""}
      </p>

      {!state.hydrated ? (
        <ul aria-busy="true" aria-label="Loading objects" className="flex flex-col gap-1 px-panel-x pt-1">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex h-12 items-center gap-2.5">
              <Skeleton className="size-4" />
              <Skeleton className="size-2.5" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-32" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </li>
          ))}
        </ul>
      ) : total === 0 ? (
        <Empty className="border-0 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BoxesIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{COPY.emptyTitle}</EmptyTitle>
            <EmptyDescription>{COPY.emptyBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={loadSeed}>
              Load sample objects
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul aria-label="Segmented objects" className="flex flex-col">
          {state.objects.map((o) => (
            <ObjectRow key={o.id} object={o} />
          ))}
        </ul>
      )}
    </section>
  )
}
