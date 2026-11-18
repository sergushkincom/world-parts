"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { TriangleAlertIcon } from "lucide-react"
import { OBJECT_PALETTE, worldOf, type CameraPose, type WorldObject } from "@/lib/data"
import { tourStops } from "@/lib/tour"
import { drawIdMask, measureObjects, type MaskObject, type SplatStats } from "@/lib/splat-mask"
import type { CameraView } from "@/lib/minimap"
import type { Focus, SplatCanvasHandle, SplatStatus } from "@/components/world/splat-canvas"
import { Button } from "@/components/ui/button"
import { useAttractTour } from "@/hooks/use-attract-tour"
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
function besideCard(pose: CameraPose, a: number): CameraPose {
  const [px, py, pz] = pose.position
  const [tx, ty, tz] = pose.target
  const fx = tx - px
  const fz = tz - pz
  // Right of forward on the floor plane: (−fz, fx).
  const nx = fx * Math.cos(a) - fz * Math.sin(a)
  const nz = fz * Math.cos(a) + fx * Math.sin(a)
  return { position: pose.position, target: [px + nx, py + (ty - py), pz + nz] }
}

/**
 * Rooms without hand-measured poses: stand between the door and the object, 55% of the way, and look at the
 * centre of its lifted splats. The still's camera is at the origin, so the line from it to the object is clear.
 */
function poseFromAnchor(anchor: [number, number, number]): CameraPose {
  const [x, y, z] = anchor
  return { target: anchor, position: [x * 0.55, y * 0.3, z * 0.55] }
}

function focusFor(o: WorldObject, stats: SplatStats | undefined): Focus | null {
  if (!stats) return null
  const hex = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
  const color = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  return { maskId: stats.maskId, near: stats.near, far: stats.far, color }
}

const subscribeNoop = () => () => {}

/**
 * `?splat=lod` / `?splat=sog`, remembered for the tab: the app's own routing rewrites the query on every
 * navigation and drops parameters it doesn't know.
 */
function readLodFlag() {
  const fromUrl = new URLSearchParams(window.location.search).get("splat")
  try {
    if (fromUrl === "lod" || fromUrl === "sog") window.sessionStorage.setItem("world-parts:splat", fromUrl)
    return (fromUrl ?? window.sessionStorage.getItem("world-parts:splat")) === "lod"
  } catch {
    return fromUrl === "lod"
  }
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
  /** Camera ease-out for flights; see SplatCanvas. */
  focusDamping?: number
  /** Replaces the marker's own click (select, frame, open the card). */
  onPick?: (id: string) => void
  /**
   * Idle object tour. On in the room's Live 3D, off in the split view, where a row already owns the camera.
   * The tour never opens the parts card.
   */
  attract?: boolean
  /** True while the tour is visiting. The room uses it for the "watch, or drag" hint. */
  onAttractChange?: (active: boolean) => void
}

export const SplatView = React.forwardRef<SplatViewHandle, SplatViewProps>(function SplatView(
  { onFallback, onCamera, onReadyChange, onFirstDrag, pixelRatio, focusDamping, onPick, attract = false, onAttractChange },
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
  const world = worldOf(state.roomId)
  // Spike: `?splat=lod` streams the level-of-detail version where a room has one; everything else is unchanged.
  const wantLod = React.useSyncExternalStore(subscribeNoop, readLodFlag, () => false)
  const lodWorld = wantLod ? world.splat.lod : undefined
  // Phones get a splat budget; desktops stream the full detail.
  const coarsePointer = React.useSyncExternalStore(
    subscribeNoop,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  )
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
          const target = world.poses[o.id]?.target
          return { id: o.id, polygon: o.polygon!, depth: target ? -target[2] : undefined }
        }),
    [state.objects, world],
  )
  const maskKey = maskObjects.map((o) => o.id).join(",")
  const [stats, setStats] = React.useState<Map<string, SplatStats>>(new Map())
  React.useEffect(() => {
    if (status.kind !== "ready" || !maskObjects.length) return
    const mask = drawIdMask(maskObjects)
    ref.current?.setObjectMask(mask)
    const centers = ref.current?.centers()
    if (centers) {
      setStats(measureObjects(centers, mask, maskObjects))
      return
    }
    // Streamed world: no centres in the browser, so read the stats lifted once from the full .sog.
    if (!lodWorld?.stats) return
    let cancelled = false
    fetch(lodWorld.stats)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, SplatStats>>) : null))
      .then((json) => {
        if (cancelled || !json) return
        const ids = new Set(maskObjects.map((o) => o.id))
        setStats(new Map(Object.entries(json).filter(([id]) => ids.has(id))))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure only when the set of objects changes
  }, [status.kind, maskKey])

  // Dev only: export the lifted stats, to precompute them for the streamed version (stats.json).
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    ;(window as unknown as { __splatStats?: object }).__splatStats = Object.fromEntries(stats)
  }, [stats])

  // Find → fly: the framed object's hand-measured pose, or home when nothing is framed.
  // While the tour is running this stays out of the way, or a mask arriving would pull the camera home.
  // After the viewer stops the tour, `homeLock` does the same job: the camera stays where they left it.
  const attractRef = React.useRef(false)
  const homeLock = React.useRef(false)
  const stops = tourStops(
    state.roomId,
    state.objects
      .filter((o) => DRAWABLE.includes(o.status) && (stats.get(o.id)?.anchor ?? world.poses[o.id]?.target))
      .map((o) => o.id),
  )
  const tour = useAttractTour({
    enabled: attract,
    ready: status.kind === "ready",
    framedId: state.framedId,
    cardId: state.cardId,
    stops,
    flyTo: (id) => {
      const anchor = stats.get(id)?.anchor
      const pose = world.poses[id] ?? (anchor ? poseFromAnchor(anchor) : undefined)
      if (pose) ref.current?.flyTo(pose)
    },
    goHome: () => ref.current?.reset(),
    hold: () => ref.current?.hold(),
    onUserStop: () => {
      homeLock.current = true
    },
  })
  attractRef.current = tour.phase !== "off"
  const attractChangeRef = React.useRef(onAttractChange)
  attractChangeRef.current = onAttractChange
  React.useEffect(() => {
    attractChangeRef.current?.(tour.phase !== "off")
  }, [tour.phase])
  React.useEffect(() => () => attractChangeRef.current?.(false), [])

  React.useEffect(() => {
    if (status.kind !== "ready") return
    if (attractRef.current && !state.framedId) return
    const anchor = state.framedId ? stats.get(state.framedId)?.anchor : undefined
    const pose = state.framedId ? (world.poses[state.framedId] ?? (anchor ? poseFromAnchor(anchor) : undefined)) : undefined
    if (pose) {
      homeLock.current = false
      ref.current?.flyTo(state.cardId ? besideCard(pose, world.cardTurn) : pose)
    } else if (!state.framedId && !homeLock.current) ref.current?.reset()
  }, [state.framedId, state.cardId, status.kind, stats, world])

  // Highlight: the tour's hold, else what the pointer is on, else the found object, else a single selection.
  // The tour does not select, frame or open the card — the tint is only the hold.
  const tourId = tour.highlight ? tour.objectId : null
  const focusId =
    tourId ?? state.hoveredId ?? state.framedId ?? (state.selection.length === 1 ? state.selection[0] : null)
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
    <div className="absolute inset-0 overflow-hidden bg-scene" data-tour={tour.phase}>
      <SplatCanvas
        ref={ref}
        key={lodWorld ? "lod" : "sog"}
        src={lodWorld ? lodWorld.src : world.splat.src}
        lod={lodWorld ? { splatBudget: coarsePointer ? 1_000_000 : 0 } : undefined}
        home={world.home}
        rotation={world.rotation}
        pixelRatio={pixelRatio}
        focusDamping={focusDamping}
        onStatus={setStatus}
        onFirstInteraction={onFirstDrag}
        onFrame={(project, view) => {
          markersRef.current?.place(project)
          onCamera?.(view)
        }}
      />

      {status.kind === "ready" && <SplatMarkers ref={markersRef} stats={stats} onPick={onPick} pulseId={tourId} />}

      {status.kind === "loading" && (
        <div role="status" className="absolute inset-0 grid place-items-center">
          <div className="flex w-56 flex-col gap-2 rounded-md bg-black/75 px-3 py-2.5 text-label text-scene-ink backdrop-blur-sm">
            <span>{`Loading 3D world · ${(lodWorld ?? world.splat).sizeLabel}`}</span>
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
