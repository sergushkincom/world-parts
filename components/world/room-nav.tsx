"use client"

import { ArrowLeftIcon } from "lucide-react"
import { COPY } from "@/lib/data"
import { navigate } from "@/hooks/use-hash-route"
import { Button } from "@/components/ui/button"

export function BackToPlant({ q }: { q: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className="pointer-events-auto shadow-sm"
      aria-keyshortcuts="Escape"
      onClick={() => navigate({ level: "plant", q })}
    >
      <ArrowLeftIcon aria-hidden data-icon="inline-start" />
      {COPY.backToPlant}
    </Button>
  )
}
