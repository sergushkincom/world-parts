"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { TriangleAlertIcon } from "lucide-react"
import { LIVE_WORLD, OBJECT_PALETTE, type CameraPose, type WorldObject } from "@/lib/data"
import { drawIdMask, measureObjects, type MaskObject, type SplatStats } from "@/lib/splat-mask"
import type { CameraView } from "@/lib/minimap"
import type { Focus, SplatCanvasHandle, SplatStatus } from "@/components/world/splat-canvas"
import { Button } from "@/components/ui/button"
import { DRAWABLE, useWorld } from "@/components/world/world-provider"
import { SplatMarkers, type MarkersHandle } from "@/components/world/splat-markers"

// WebGL can't run on the server: load the engine only in the browser, and only when Live 3D is on.
const SplatCanvas = dynamic(() => import("@/components/world/splat-canvas").then((m) => m.SplatCanvas), {
  ssr: false,
})

/**
 * The card sits top-right, so turn the camera a little to the right where it stands:
 * the object lands left of centre, in the free part of the view. Turning (not sliding)
 * keeps the camera inside the room even for far objects.
 */
function besideCard(pose: CameraPose): CameraPose {
  const [px, py, pz] = pose.position
  const [tx, ty, tz] = pose.target
  const fx = tx - px
  const fz = tz - pz
  // Right of forward on the floor plane: (−fz, fx).
  const a = LIVE_WORLD.cardTurn
  const nx = fx * Math.cos(a) - fz * Math.sin(a)
  const nz = fz * Math.cos(a) + fx * Math.sin(a)
  return { position: pose.position, target: [px + nx, py + (ty - py), pz + nz] }
}

function focusFor(o: WorldObject, stats: SplatStats | undefined): Focus | null {
  if (!stats) return null
  const hex = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
  const color = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  return { maskId: stats.maskId, near: stats.near, far: stats.far, color }
}

export type SplatViewHandle = { flyTo: (pose: CameraPose) => void; reset: () => void }

type SplatViewProps = {
  onFallback: () => void
  /** Every frame: where the camera stands and looks on the floor. For the minimap; write to the DOM, not state. */
  onCamera?: (view: CameraView) => void
  onReadyChange?: (ready: boolean) => void
  /** First drag in the live world. Dismisses the one-time orbit hint. */
  onFirstDrag?: () => void
  /** Back-buffer scale. Does not reload the splat. */
  pixelRatio?: number
}

export const SplatView = React.forwardRef<SplatViewHandle, SplatViewProps>(function SplatView(
  { onFallback, onCamera, onReadyChange, onFirstDrag, pixelRatio },
  handle,
) {
  const ref = React.useRef<SplatCanvasHandle>(null)
  React.useImperativeHandle(handle, () => ({
    flyTo: (pose) => ref.current?.flyTo(pose),
    reset: () => ref.current?.reset(),
  }))
  const markersRef = React.useRef<MarkersHandle>(null)
  const [status, setStatus] = React.useState<SplatStatus>({ kind: "loading", progress: null })
  const { state } = useWorld()
  const readyRef = React.useRef(onReadyChange)
  readyRef.current = onReadyChange
  React.useEffect(() => {
    readyRef.current?.(status.kind === "ready")
    return () => readyRef.current?.(false)
  }, [status.kind])

  // Lift the still's masks onto the world once it's loaded: which splats belong to which object.
  const maskObjects: MaskObject[] = React.useMemo(
    () =>
      state.objects
        .filter((o) => DRAWABLE.includes(o.status) && o.polygon)
        .map((o) => {
          const target = LIVE_WORLD.poses[o.id]?.target
          return { id: o.id, polygon: o.polygon!, depth: target ? -target[2] : undefined }
        }),
    [state.objects],
  )
  const maskKey = maskObjects.map((o) => o.id).join(",")
  const [stats, setStats] = React.useState<Map<string, SplatStats>>(new Map())
  React.useEffect(() => {
    if (status.kind !== "ready") return
    const centers = ref.current?.centers()
    if (!centers || !maskObjects.length) return
    const mask = drawIdMask(maskObjects)
    ref.current?.setObjectMask(mask)
    setStats(measureObjects(centers, mask, maskObjects))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure only when the set of objects changes
  }, [status.kind, maskKey])

  // Find → fly: the framed object's hand-measured pose, or home when nothing is framed.
  React.useEffect(() => {
    if (status.kind !== "ready") return
    const pose = state.framedId ? LIVE_WORLD.poses[state.framedId] : undefined
    if (pose) ref.current?.flyTo(state.cardId ? besideCard(pose) : pose)
    else if (!state.framedId) ref.current?.reset()
  }, [state.framedId, state.cardId, status.kind])

  // Highlight: what the pointer is on, else the found object, else a single selection.
  const focusId =
    state.hoveredId ?? state.framedId ?? (state.selection.length === 1 ? state.selection[0] : null)
  const focusObject = state.objects.find((o) => o.id === focusId)
  React.useEffect(() => {
    if (status.kind !== "ready") return
    ref.current?.focus(focusObject ? focusFor(focusObject, stats.get(focusObject.id)) : null)
  }, [focusObject, stats, status.kind])

  // Dev only: measure poses from the console with __splat.getPose().
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development" || status.kind !== "ready") return
    ;(window as unknown as { __splat?: SplatCanvasHandle | null }).__splat = ref.current
  }, [status.kind])

  return (
    <div className="absolute inset-0 overflow-hidden bg-scene">
      <SplatCanvas
        ref={ref}
        src={LIVE_WORLD.src}
        home={LIVE_WORLD.home}
        rotation={LIVE_WORLD.rotation}
        pixelRatio={pixelRatio}
        onStatus={setStatus}
        onFirstInteraction={onFirstDrag}
        onFrame={(project, view) => {
          markersRef.current?.place(project)
          onCamera?.(view)
        }}
      />

      {status.kind === "ready" && <SplatMarkers ref={markersRef} stats={stats} />}

      {status.kind === "loading" && (
        <div role="status" className="absolute inset-0 grid place-items-center">
          <div className="flex w-56 flex-col gap-2 rounded-md bg-black/75 px-3 py-2.5 text-label text-scene-ink backdrop-blur-sm">
            <span>{`Loading 3D world · ${LIVE_WORLD.sizeLabel}`}</span>
            <span className="h-1 overflow-hidden rounded-full bg-white/15">
              <span
                className="block h-full rounded-full bg-status-active transition-[width] duration-200"
                style={{ width: `${Math.round((status.progress ?? 0.05) * 100)}%` }}
              />
            </span>
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <div role="alert" className="absolute inset-0 grid place-items-center p-6">
          <div className="flex max-w-sm flex-col items-start gap-3 rounded-md bg-black/80 p-4 text-scene-ink">
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlertIcon aria-hidden className="size-4 text-status-low" />
              Live 3D didn&apos;t load
            </p>
            <p className="text-label text-scene-ink/70">{status.message} The still frame has the same objects.</p>
            <Button size="sm" variant="secondary" onClick={onFallback}>
              Show still frame
            </Button>
          </div>
        </div>
      )}

    </div>
  )
})
