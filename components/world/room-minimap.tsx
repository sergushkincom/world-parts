"use client"

import * as React from "react"
import { ArrowLeftIcon, GripVerticalIcon, MapIcon, Minimize2Icon, MinusIcon, PlusIcon } from "lucide-react"
import { COPY, PLAN, ROOMS, STORAGE_KEYS, VIEWPOINTS, type Point, type RoomId } from "@/lib/data"
import { conePath, planMapper, roomViewBox, STILL_VIEW, zoomedPlanViewBox, type CameraView } from "@/lib/minimap"
import { readJSON, writeJSON } from "@/lib/storage"
import { navigate } from "@/hooks/use-hash-route"
import { cn } from "@/lib/utils"
import { BLUEPRINT, planPoints } from "@/components/plant/floor-plan"

export type MinimapHandle = { setCamera: (view: CameraView) => void }

type Props = {
  roomId: RoomId
  q: string
  /** Live 3D with the world loaded: the cone follows the camera and viewpoints can be walked to. */
  live: boolean
  /** Viewpoint index the camera last walked to, if any. */
  viewpoint: number | null
  visited: number[]
  onViewpoint: (index: number) => void
  /** The found object on the plan, for the amber pin. */
  find: { name: string; at: Point } | null
}

/** A blueprint is always dark, so the dark theme's active blue in both themes (`--color-blueprint-active`). */
const ACTIVE = "#5aa2ff"
const CARD_BG = "rgba(12, 38, 66, 0.92)"

/** Same breakpoint as `max-panel:` / the side panel. */
const WIDE_QUERY = "(min-width: 900px)"

/**
 * Plan drawing width in CSS px. M is the original wide card (260px with padding); S and L are the other presets.
 * The phone card stays `NARROW_PLAN` (112px with padding) — drag and collapse only, no presets or zoom.
 */
const PLAN_WIDTH = { S: 160, M: 240, L: 320 } as const
const NARROW_PLAN = 96
const WIDE_CHROME = 20

const SIZES = ["S", "M", "L"] as const
type SizeId = (typeof SIZES)[number]
const SIZE_NAME: Record<SizeId, string> = { S: "Small", M: "Medium", L: "Large" }

/** Zoom 1 is the whole plan. Each step crops closer around the current room. */
const ZOOMS = [1, 1.5, 2, 2.5] as const
type Zoom = (typeof ZOOMS)[number]

/** Default corner: the old `top-14 left-3`. */
const DEFAULT_LAYOUT = { x: 12, y: 56, size: "M" as SizeId, zoom: 1 as Zoom, collapsed: false }

type MinimapLayout = { x: number; y: number; size: SizeId; zoom: Zoom; collapsed: boolean }

type StoredMinimap = { x: number; y: number; size: SizeId; zoom: number; collapsed: boolean }

function useWide() {
  const [wide, setWide] = React.useState(true)
  React.useLayoutEffect(() => {
    const m = window.matchMedia(WIDE_QUERY)
    const on = () => setWide(m.matches)
    on()
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return wide
}

function isStoredMinimap(value: unknown): value is StoredMinimap {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.x === "number" &&
    Number.isFinite(v.x) &&
    typeof v.y === "number" &&
    Number.isFinite(v.y) &&
    (v.size === "S" || v.size === "M" || v.size === "L") &&
    typeof v.zoom === "number" &&
    Number.isFinite(v.zoom) &&
    typeof v.collapsed === "boolean"
  )
}

function snapZoom(zoom: number): Zoom {
  return ZOOMS.reduce((best, n) => (Math.abs(n - zoom) < Math.abs(best - zoom) ? n : best))
}

/** Keep the card inside the room view. `left`/`top` are relative to that view, not the window. */
function clampToParent(el: HTMLElement | null, x: number, y: number) {
  const parent = el?.offsetParent as HTMLElement | null
  const rx = Math.round(x)
  const ry = Math.round(y)
  if (!el || !parent) return { x: rx, y: ry }
  const maxX = Math.max(0, parent.clientWidth - el.offsetWidth)
  const maxY = Math.max(0, parent.clientHeight - el.offsetHeight)
  return { x: Math.min(maxX, Math.max(0, rx)), y: Math.min(maxY, Math.max(0, ry)) }
}

function layoutsEqual(a: MinimapLayout, b: MinimapLayout) {
  return a.x === b.x && a.y === b.y && a.size === b.size && a.zoom === b.zoom && a.collapsed === b.collapsed
}

/** Pointer events stay on the card. The live camera listens on the canvas underneath. */
function blockScenePointer(e: React.SyntheticEvent) {
  e.stopPropagation()
}

const iconBtn =
  "grid size-6 shrink-0 place-items-center rounded-md border-0 bg-transparent p-0 text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40 max-panel:size-5 [&_svg]:pointer-events-none [&_svg]:size-3.5"

/**
 * The floor plan as a blueprint card in the room. Desktop shows the whole building (where the room sits in
 * the plant) and can be dragged, resized and zoomed; the phone keeps the small room crop and can be dragged
 * or collapsed. A dot is where the camera stands, a cone where it looks. Viewpoints are rings; click one to walk there.
 */
export const RoomMinimap = React.forwardRef<MinimapHandle, Props>(function RoomMinimap(
  { roomId, q, live, viewpoint, visited, onViewpoint, find },
  ref,
) {
  const room = ROOMS.find((r) => r.id === roomId)
  const map = React.useMemo(() => planMapper(roomId), [roomId])
  const wide = useWide()
  const id = React.useId().replace(/:/g, "")

  const [layout, setLayout] = React.useState<MinimapLayout>(DEFAULT_LAYOUT)
  const layoutRef = React.useRef(layout)
  layoutRef.current = layout
  const [ready, setReady] = React.useState(false)
  const cardRef = React.useRef<HTMLElement | null>(null)
  const setCard = React.useCallback((node: HTMLElement | null) => {
    cardRef.current = node
  }, [])
  const drag = React.useRef<{ id: number; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null)
  /** A drag that ends over the collapsed button must not count as the click that expands it. */
  const suppressClick = React.useRef(false)

  const commit = React.useCallback((next: MinimapLayout) => {
    if (layoutsEqual(layoutRef.current, next)) return
    layoutRef.current = next
    setLayout(next)
  }, [])

  const moveTo = React.useCallback(
    (x: number, y: number) => {
      const pos = clampToParent(cardRef.current, x, y)
      commit({ ...layoutRef.current, ...pos })
    },
    [commit],
  )

  React.useLayoutEffect(() => {
    const read = readJSON(STORAGE_KEYS.minimap, isStoredMinimap)
    if (read.value) {
      commit({ ...read.value, zoom: snapZoom(read.value.zoom) })
    }
    setReady(true)
  }, [commit])

  React.useLayoutEffect(() => {
    if (!ready) return
    const el = cardRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    const clampNow = () => {
      const node = cardRef.current
      if (!node) return
      const cur = layoutRef.current
      const pos = clampToParent(node, cur.x, cur.y)
      if (pos.x === cur.x && pos.y === cur.y) return
      commit({ ...cur, ...pos })
    }
    clampNow()
    const observer = new ResizeObserver(clampNow)
    observer.observe(parent)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ready, layout.collapsed, layout.size, wide, commit])

  React.useEffect(() => {
    if (!ready || drag.current) return
    writeJSON(STORAGE_KEYS.minimap, layoutRef.current)
  }, [ready, layout])

  const planPx = wide ? PLAN_WIDTH[layout.size] : NARROW_PLAN
  const vb = wide ? zoomedPlanViewBox(roomId, layout.zoom) : roomViewBox(roomId, 16)
  // Plan units per CSS pixel, so marks keep their on-screen size when the card or the crop changes.
  const k = vb[2] / planPx

  const coneRef = React.useRef<SVGPathElement>(null)
  const gradRef = React.useRef<SVGRadialGradientElement>(null)
  const dotRef = React.useRef<SVGGElement>(null)

  const place = React.useCallback(
    (view: CameraView) => {
      if (!map) return
      const [x, y] = map.toPlan(view.x, view.z)
      coneRef.current?.setAttribute("d", conePath(map, view))
      gradRef.current?.setAttribute("cx", x.toFixed(1))
      gradRef.current?.setAttribute("cy", y.toFixed(1))
      dotRef.current?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
    },
    [map],
  )
  React.useImperativeHandle(ref, () => ({ setCamera: place }), [place])
  // The still frame never moves: draw it once. Live 3D takes over through setCamera every frame.
  React.useLayoutEffect(() => {
    if (!live && !layout.collapsed) place(STILL_VIEW)
  }, [live, place, wide, layout.collapsed])

  const resetPosition = React.useCallback(() => {
    moveTo(DEFAULT_LAYOUT.x, DEFAULT_LAYOUT.y)
  }, [moveTo])

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || drag.current) return
    suppressClick.current = false
    const parent = cardRef.current?.offsetParent as HTMLElement | null
    const origin = parent?.getBoundingClientRect()
    drag.current = {
      id: e.pointerId,
      ox: e.clientX - (origin?.left ?? 0) - layoutRef.current.x,
      oy: e.clientY - (origin?.top ?? 0) - layoutRef.current.y,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true
    const parent = cardRef.current?.offsetParent as HTMLElement | null
    const origin = parent?.getBoundingClientRect()
    moveTo(e.clientX - (origin?.left ?? 0) - d.ox, e.clientY - (origin?.top ?? 0) - d.oy)
  }

  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    suppressClick.current = d.moved
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    writeJSON(STORAGE_KEYS.minimap, layoutRef.current)
  }

  const onNudgeKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 24 : 8
    const delta =
      e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : null
    if (!delta) return false
    e.preventDefault()
    e.stopPropagation()
    moveTo(layoutRef.current.x + delta[0], layoutRef.current.y + delta[1])
    return true
  }

  const onSizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!dir) return
    e.preventDefault()
    e.stopPropagation()
    const i = SIZES.indexOf(layoutRef.current.size)
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, i + dir))]
    commit({ ...layoutRef.current, size: next })
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-size="${next}"]`)?.focus()
  }

  if (!room || !map) return null

  const points = (VIEWPOINTS[roomId] ?? []).map((v) => ({ ...v, at: map.toPlan(v.pose.position[0], v.pose.position[2]) }))
  const others = ROOMS.filter((r) => r.id !== roomId && !r.scanned).length
  const mode = find
    ? `FIND · ${find.name}`
    : !live
      ? "STILL"
      : viewpoint !== null
        ? `LIVE 3D · ${viewpoint + 1}/${points.length}`
        : "LIVE 3D"
  const back = () => navigate({ level: "plant", q })
  const zoomIndex = Math.max(0, ZOOMS.indexOf(layout.zoom))
  const positionStyle = { background: CARD_BG, left: layout.x, top: layout.y }
  const cardStyle = {
    ...positionStyle,
    ...(wide && layout.size !== "M" ? { width: PLAN_WIDTH[layout.size] + WIDE_CHROME } : {}),
  }

  if (layout.collapsed) {
    return (
      <button
        ref={setCard}
        type="button"
        aria-label={`Show the ${room.name} minimap. Arrow keys move it.`}
        aria-expanded={false}
        className="pointer-events-auto absolute z-10 grid size-10 cursor-grab touch-none place-items-center rounded-lg border border-white/16 text-white shadow-lg outline-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:cursor-grabbing"
        style={{ ...positionStyle, touchAction: "none" }}
        onPointerDown={(e) => {
          blockScenePointer(e)
          startDrag(e)
        }}
        onPointerMove={(e) => {
          blockScenePointer(e)
          moveDrag(e)
        }}
        onPointerUp={(e) => {
          blockScenePointer(e)
          endDrag(e)
        }}
        onPointerCancel={(e) => {
          blockScenePointer(e)
          endDrag(e)
        }}
        onLostPointerCapture={endDrag}
        onClick={(e) => {
          if (!suppressClick.current) {
            commit({ ...layoutRef.current, collapsed: false })
            return
          }
          suppressClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }}
        onKeyDown={onNudgeKey}
        onWheel={blockScenePointer}
      >
        <MapIcon aria-hidden className="size-4" />
      </button>
    )
  }

  return (
    <div
      ref={setCard}
      className="pointer-events-auto absolute z-10 flex w-[260px] touch-none flex-col gap-1.5 rounded-xl border border-white/16 p-2.5 text-white shadow-lg select-none max-panel:w-[112px] max-panel:gap-1 max-panel:rounded-lg max-panel:p-2"
      style={cardStyle}
      onPointerDown={blockScenePointer}
      onPointerMove={blockScenePointer}
      onPointerUp={blockScenePointer}
      onPointerCancel={blockScenePointer}
      onWheel={blockScenePointer}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-roledescription="drag handle"
          aria-label={`Move the ${room.name} minimap. Arrow keys nudge it, Shift moves further. Double-click or Enter returns it to the corner.`}
          draggable={false}
          // touch-action: none — a drag here must not become a look/orbit gesture on the canvas.
          className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-left text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.stopPropagation()
            startDrag(e)
          }}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            resetPosition()
          }}
          onKeyDown={(e) => {
            if (onNudgeKey(e)) return
            if (e.key !== "Enter" && e.key !== " ") return
            e.preventDefault()
            e.stopPropagation()
            resetPosition()
          }}
        >
          <GripVerticalIcon aria-hidden className="size-3.5 shrink-0 text-white/60 max-panel:hidden" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/95 max-panel:sr-only">{room.name}</span>
          <span
            className={cn(
              "truncate font-mono text-[10px] tracking-wide text-white/60 uppercase",
              wide ? "shrink-0" : "min-w-0 flex-1",
            )}
          >
            {mode}
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md border-0 bg-transparent px-1 text-[11px] font-medium text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-panel:grid max-panel:size-5 max-panel:place-items-center max-panel:px-0"
          aria-label="Back to plant overview"
          onClick={back}
        >
          <ArrowLeftIcon aria-hidden className="size-3.5" />
          <span className="max-panel:sr-only">{COPY.backToPlant}</span>
        </button>
        <button
          type="button"
          className={iconBtn}
          aria-label="Collapse minimap"
          aria-expanded
          onClick={() => commit({ ...layoutRef.current, collapsed: true })}
        >
          <Minimize2Icon aria-hidden />
        </button>
      </div>

      {wide && (
        <div className="flex items-center justify-between gap-2 max-panel:hidden">
          <div
            role="radiogroup"
            aria-label="Minimap size"
            className="flex items-center gap-0.5 rounded-md bg-black/25 p-0.5"
            onKeyDown={onSizeKeyDown}
          >
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                data-size={size}
                aria-checked={layout.size === size}
                aria-label={`${SIZE_NAME[size]} minimap`}
                tabIndex={layout.size === size ? 0 : -1}
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-[5px] border-0 bg-transparent px-1.5 font-mono text-[10px] tracking-wide outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  layout.size === size ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => commit({ ...layoutRef.current, size })}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-md bg-black/25 p-0.5">
            <button
              type="button"
              className={iconBtn}
              aria-label={`Zoom out, currently ${layout.zoom}×`}
              disabled={zoomIndex <= 0}
              onClick={() => commit({ ...layoutRef.current, zoom: ZOOMS[zoomIndex - 1] })}
            >
              <MinusIcon aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label={`Zoom in, currently ${layout.zoom}×`}
              disabled={zoomIndex >= ZOOMS.length - 1}
              onClick={() => commit({ ...layoutRef.current, zoom: ZOOMS[zoomIndex + 1] })}
            >
              <PlusIcon aria-hidden />
            </button>
          </div>
        </div>
      )}

      <svg
        viewBox={vb.join(" ")}
        className="block w-full rounded-md"
        style={{ aspectRatio: `${vb[2]} / ${vb[3]}` }}
        aria-hidden={points.length === 0 || !live}
        role={live && points.length ? "group" : undefined}
        aria-label={live && points.length ? "Viewpoints" : undefined}
      >
        <defs>
          <pattern id={`${id}-grid`} width={50} height={50} patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="white" strokeOpacity={0.05} strokeWidth={2} />
          </pattern>
          <clipPath id={`${id}-room`}>
            <polygon points={planPoints(room.polygon)} />
          </clipPath>
          <radialGradient ref={gradRef} id={`${id}-cone`} gradientUnits="userSpaceOnUse" r={300}>
            <stop offset="0" stopColor={ACTIVE} stopOpacity={0.7} />
            <stop offset="1" stopColor={ACTIVE} stopOpacity={0.1} />
          </radialGradient>
        </defs>

        <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={`url(#${id}-grid)`} />
        {/* An SVG image, not <img>: the viewBox crops the plan together with the marks. */}
        <image href={BLUEPRINT.furniture} width={PLAN.width} height={PLAN.height} opacity={0.43} />
        <image href={BLUEPRINT.walls} width={PLAN.width} height={PLAN.height} opacity={0.92} />
        <polygon
          points={planPoints(room.polygon)}
          fill={ACTIVE}
          fillOpacity={0.08}
          stroke={ACTIVE}
          strokeOpacity={0.6}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${id}-room)`}>
          <path ref={coneRef} fill={`url(#${id}-cone)`} stroke={ACTIVE} strokeOpacity={0.8} vectorEffect="non-scaling-stroke" strokeWidth={1} />
        </g>

        {live && points.length > 1 && (
          <polyline
            points={points.map((p) => p.at.join(",")).join(" ")}
            fill="none"
            stroke="white"
            strokeOpacity={0.43}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {live &&
          points.map((p, i) =>
            i === viewpoint ? null : (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`Walk to viewpoint ${i + 1} of ${points.length}: ${p.label}`}
                className="cursor-pointer outline-none [&:focus-visible>circle:last-child]:stroke-[3]"
                onClick={(e) => {
                  e.stopPropagation()
                  onViewpoint(i)
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return
                  e.preventDefault()
                  onViewpoint(i)
                }}
              >
                <title>{p.label}</title>
                {/* Bigger invisible target than the ring itself. */}
                <circle cx={p.at[0]} cy={p.at[1]} r={12 * k} fill="transparent" />
                <circle
                  cx={p.at[0]}
                  cy={p.at[1]}
                  r={4 * k}
                  fill={visited.includes(i) ? "rgba(255,255,255,0.25)" : "transparent"}
                  stroke="white"
                  strokeOpacity={0.75}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ),
          )}

        {find && (
          <g transform={`translate(${find.at[0]} ${find.at[1]})`}>
            <circle r={7 * k} fill="none" stroke="#FFC850" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <circle r={4 * k} fill="#FFC850" />
          </g>
        )}

        <g ref={dotRef}>
          <circle r={11 * k} fill={ACTIVE} fillOpacity={0.27} />
          <circle r={4.5 * k} fill={ACTIVE} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>

      {wide && others > 0 && (
        <p className="text-[11px] text-white/60 max-panel:hidden">{others} more rooms · inventory only</p>
      )}
    </div>
  )
})
