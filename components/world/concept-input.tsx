"use client"

import { CheckIcon } from "lucide-react"
import { COPY, SUGGESTED_CONCEPTS } from "@/lib/data"
import { cn } from "@/lib/utils"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"

export function ConceptInput() {
  const { state, conceptInputRef, setDraft, segmentDraft, submitConcept } = useWorld()
  const offline = state.serverStatus !== "online"
  const hintId = "concept-hint"

  const hint =
    state.notice?.text ??
    (state.serverStatus === "checking"
      ? "Connecting to the segmentation server…"
      : state.serverStatus === "unreachable"
        ? "Server unreachable — segment view is paused."
        : COPY.conceptLimit)
  const isError = state.notice?.tone === "error" || state.serverStatus === "unreachable"

  return (
    <section aria-label="Segment a concept" className="flex flex-col gap-2.5 px-panel-x py-section-y">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          segmentDraft()
        }}
      >
        <label htmlFor="concept-input" className="text-label font-medium uppercase tracking-wider text-muted-foreground">
          {COPY.conceptLabel}
        </label>
        <Input
          id="concept-input"
          ref={conceptInputRef}
          value={state.draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
            if (e.key === "Escape") e.currentTarget.blur()
          }}
          placeholder={COPY.conceptPlaceholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          aria-invalid={state.notice?.tone === "error" || undefined}
          aria-describedby={hintId}
        />
        <div className="flex items-start gap-3">
          <p
            id={hintId}
            aria-live="polite"
            className={cn("min-w-0 flex-1 pt-1 text-label leading-snug text-muted-foreground", isError && "text-destructive")}
          >
            {hint}
          </p>
          <Button type="submit" size="sm" disabled={offline || !state.draft.trim()} aria-keyshortcuts="g">
            {COPY.segmentButton}
            <Kbd aria-hidden className="bg-primary-foreground/15 text-primary-foreground">
              G
            </Kbd>
          </Button>
        </div>
      </form>

      <ul aria-label="Suggested concepts" className="flex flex-wrap gap-1.5">
        {SUGGESTED_CONCEPTS.map((concept) => {
          const existing = state.objects.find((o) => o.concept === concept)
          const done = existing && DRAWABLE.includes(existing.status)
          const pending = existing && (existing.status === "queued" || existing.status === "segmenting")
          return (
            <li key={concept}>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="rounded-full font-normal"
                disabled={offline || pending}
                aria-label={done ? `${concept}, already lifted — frame it` : `Segment ${concept}`}
                onClick={() => submitConcept(concept)}
              >
                {pending ? <Spinner aria-hidden /> : done ? <CheckIcon aria-hidden data-icon="inline-start" /> : null}
                {concept}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
