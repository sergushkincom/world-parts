"use client"

import * as React from "react"
import { ListIcon, MapIcon } from "lucide-react"
import { navigate } from "@/hooks/use-hash-route"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type View = "parts" | "plant"

const SKIP_INSIDE = "input, textarea, select, [contenteditable='true']"

function go(view: View, q: string) {
  navigate(view === "parts" ? { level: "parts", q } : { level: "plant", q })
}

/** List · Plan. Both views share the query; L and P switch from anywhere outside a field. */
export function ViewSwitch({ view, q }: { view: View; q: string }) {
  const qRef = React.useRef(q)
  qRef.current = q

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).closest?.(SKIP_INSIDE)) return
      const key = e.key.toLowerCase()
      const next: View | null = key === "l" ? "parts" : key === "p" ? "plant" : null
      if (!next || next === view) return
      e.preventDefault()
      go(next, qRef.current)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [view])

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={view}
      aria-label="View"
      onValueChange={(v) => v && v !== view && go(v as View, q)}
      className="shrink-0 bg-background"
    >
      <ToggleGroupItem value="parts" aria-keyshortcuts="L" className="gap-1.5 px-2.5">
        <ListIcon aria-hidden />
        List
      </ToggleGroupItem>
      <ToggleGroupItem value="plant" aria-keyshortcuts="P" className="gap-1.5 px-2.5">
        <MapIcon aria-hidden />
        Plan
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
