"use client"

import * as React from "react"
import { searchWorld } from "@/lib/search"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"

/** Equipment in the 3D world that matches a query, by name, asset ID or a part it holds. */
export function useWorldHits(q: string) {
  const { state } = useWorld()
  return React.useMemo(
    () => searchWorld(q, state.objects, (o) => DRAWABLE.includes(o.status)),
    [q, state.objects],
  )
}
