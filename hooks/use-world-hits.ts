"use client"

import * as React from "react"
import { searchWorld } from "@/lib/search"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"

/** Objects in the 3D world that match a query, by name, concept or linked part. */
export function useWorldHits(q: string) {
  const { state } = useWorld()
  return React.useMemo(
    () =>
      searchWorld(
        q,
        state.objects,
        (o) => state.partLinks[o.concept]?.partNumber,
        (o) => DRAWABLE.includes(o.status),
      ),
    [q, state.objects, state.partLinks],
  )
}
