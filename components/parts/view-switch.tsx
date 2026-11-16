"use client"

import * as React from "react"
import { Columns2Icon, ListIcon, MapIcon } from "lucide-react"
import { navigate } from "@/hooks/use-hash-route"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type View = "parts" | "split" | "plant"

const SKIP_INSIDE = "input, textarea, select, [contenteditable='true']"

const KEYS: Record<string, View> = { l: "parts", s: "split", p: "plant" }

/** List and Split keep the selected part; the plan has no part selection. */
function go(view: View, q: string, part: string | null) {
  navigate(view === "plant" ? { level: "plant", q } : { level: view, q, part })
}

/** List · Split · Plan. All views share the query; L, S and P switch from anywhere outside a field. */
export function ViewSwitch({ view, q, part = null }: { view: View; q: string; part?: string | null }) {
  const qRef = React.useRef(q)
  qRef.current = q
  const partRef = React.useRef(part)
  partRef.current = part

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).closest?.(SKIP_INSIDE)) return
      const key = e.key.toLowerCase()
      const next: View | undefined = KEYS[key]
      if (!next || next === view) return
      e.preventDefault()
      go(next, qRef.current, partRef.current)
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
      onValueChange={(v) => v && v !== view && go(v as View, q, part)}
      className="shrink-0 bg-background"
    >
      <ToggleGroupItem value="parts" aria-keyshortcuts="L" className="gap-1.5 px-2.5">
        <ListIcon aria-hidden />
        List
      </ToggleGroupItem>
      <ToggleGroupItem value="split" aria-keyshortcuts="S" className="gap-1.5 px-2.5">
        <Columns2Icon aria-hidden />
        Split
      </ToggleGroupItem>
      <ToggleGroupItem value="plant" aria-keyshortcuts="P" className="gap-1.5 px-2.5">
        <MapIcon aria-hidden />
        Plan
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
