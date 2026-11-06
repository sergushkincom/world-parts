"use client"

import { COPY, GAUSSIAN_VIEWS, type GaussianView } from "@/lib/data"
import { useWorld } from "@/components/world/world-provider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function GaussianViewControl() {
  const { state } = useWorld()
  const { setView } = useWorld()
  const count = state.selection.length
  const disabled = count === 0
  const current = GAUSSIAN_VIEWS.find((v) => v.id === state.gaussianView)
  const hintId = "gaussian-view-hint"

  return (
    <section aria-labelledby="gaussian-heading" className="flex flex-col gap-2 border-t px-panel-x py-section-y">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="gaussian-heading" className="text-label font-medium uppercase tracking-wider text-muted-foreground">
          Gaussian view
        </h3>
        {!disabled && (
          <span className="text-label tabular-nums text-muted-foreground">
            {`Applied to ${count} selected`}
          </span>
        )}
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={state.gaussianView}
        onValueChange={(v) => v && setView(v as GaussianView)}
        disabled={disabled}
        aria-label="Gaussian view"
        aria-describedby={hintId}
        className="w-full"
      >
        {GAUSSIAN_VIEWS.map((v) => (
          <Tooltip key={v.id}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={v.id}
                aria-label={v.fullLabel}
                aria-keyshortcuts={v.key}
                className="h-8 min-w-0 flex-1 gap-1.5 px-1.5 text-xs whitespace-nowrap"
              >
                {v.label}
                <span aria-hidden className="text-[0.625rem] text-muted-foreground tabular-nums">
                  {v.key}
                </span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="top">{`${v.fullLabel} · ${v.key}`}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
      <p id={hintId} className="text-label text-muted-foreground">
        {disabled ? COPY.gaussianDisabled : current?.description}
      </p>
    </section>
  )
}
