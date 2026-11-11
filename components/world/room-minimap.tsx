"use client"

import * as React from "react"
import { PLAN, ROOMS, VIEWPOINTS, type Point, type Room, type RoomId } from "@/lib/data"
import { buildingViewBox, conePath, planMapper, roomViewBox, STILL_VIEW, type CameraView } from "@/lib/minimap"
import { navigate } from "@/hooks/use-hash-route"
import { cn } from "@/lib/utils"
import { LABEL_CLASS, layoutPins, type Rect, PinContent, planPoints, usePinWidths } from "@/components/plant/floor-plan"

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

/** The plan is black in both themes (inverted drawing), so the dark theme's active blue in both. */
const ACTIVE = "#5aa2ff"
const PIN_H = 26

function useWide() {
  const [wide, setWide] = React.useState(true)
  React.useEffect(() => {
    const m = window.matchMedia("(min-width: 900px)")
    const on = () => setWide(m.matches)
    on()
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return wide
}

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/**
 * The floor plan from the plant overview, as a card top left in the room: same drawing, same room pills.
 * Desktop shows the whole building (where the room sits in the plant), the phone only the room. A dot is
 * where the camera stands, a cone where it looks: fixed for the still frame, live in 3D. Viewpoints are
 * rings; click one to walk there.
 */
export const RoomMinimap = React.forwardRef<MinimapHandle, Props>(function RoomMinimap(
  { roomId, q, live, viewpoint, visited, onViewpoint, find },
  ref,
) {
  const room = ROOMS.find((r) => r.id === roomId)
  const map = React.useMemo(() => planMapper(roomId), [roomId])
  const wide = useWide()
  const id = React.useId().replace(/:/g, "")
  const planRef = React.useRef<HTMLDivElement>(null)
  const size = useSize(planRef)
  const [widths, measurer] = usePinWidths(null)

  const vb = wide ? buildingViewBox(28) : roomViewBox(roomId, 16)
  // Plan units per CSS pixel, so marks keep their on-screen size at both crops.
  const s = size.w ? size.w / vb[2] : wide ? 476 / vb[2] : 168 / vb[2]
  const k = 1 / s

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
    if (!live) place(STILL_VIEW)
  }, [live, place, wide])

  // This room's pill sits on its back wall (kept inside the card), out of the way of the camera, cone and viewpoints.
  const wallY = room ? Math.max(Math.min(...room.polygon.map((p) => (p[1] - vb[1]) * s)), 6 + PIN_H / 2) : 0
  const anchorOf = (r: Room): Point => (r.id === roomId ? [r.anchor[0], wallY / s + vb[1]] : r.anchor)

  if (!room || !map) return null
  const points = (VIEWPOINTS[roomId] ?? []).map((v) => ({ ...v, at: map.toPlan(v.pose.position[0], v.pose.position[2]) }))
  const mode = find
    ? `FIND · ${find.name}`
    : !live
      ? "STILL"
      : viewpoint !== null
        ? `LIVE 3D · ${viewpoint + 1}/${points.length}`
        : "LIVE 3D"
  const back = () => navigate({ level: "plant", q })
  // Other rooms' labels never cover this room: they move aside or collapse to a dot.
  const xs = room.polygon.map((p) => (p[0] - vb[0]) * s)
  const here: Rect = { left: Math.min(...xs), top: wallY + PIN_H / 2 + 6, right: Math.max(...xs), bottom: Math.max(...room.polygon.map((p) => (p[1] - vb[1]) * s)) }
  const pins = size.w
    ? layoutPins({ x: -vb[0] * s, y: -vb[1] * s, s }, size, widths, null, roomId, anchorOf, [here])
    : []

  return (
    <div className="pointer-events-auto absolute top-14 left-3 z-10 flex w-[500px] flex-col gap-2 rounded-xl border border-white/16 bg-black p-2.5 text-white shadow-lg max-panel:w-[184px] max-panel:gap-1.5 max-panel:rounded-lg max-panel:p-2">
      <button
        type="button"
        onClick={back}
        aria-label={`${room.name} on the plant floor plan — back to plant overview`}
        className="flex items-baseline justify-between gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span className="truncate text-[13px] font-semibold text-white/95 max-panel:sr-only">Plant floor plan</span>
        <span className="shrink-0 truncate font-mono text-[10px] tracking-wide text-white/60 uppercase max-panel:max-w-full">
          {mode}
        </span>
      </button>

      <div
        ref={planRef}
        onClick={back}
        className="relative cursor-pointer overflow-hidden rounded-md"
        style={{ aspectRatio: `${vb[2]} / ${vb[3]}` }}
      >
        {/* The overview's own drawing and filter; positioned so the box shows the same crop as the viewBox. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static plan, needs a CSS filter and exact pixel mapping */}
        <img
          src={PLAN.imageSrc}
          alt=""
          aria-hidden
          draggable={false}
          className="plan-invert absolute max-w-none select-none"
          style={{
            width: `${(PLAN.width / vb[2]) * 100}%`,
            left: `${(-vb[0] / vb[2]) * 100}%`,
            top: `${(-vb[1] / vb[3]) * 100}%`,
          }}
        />

        {/* Under the pills: this room and where the camera looks. */}
        <svg viewBox={vb.join(" ")} aria-hidden className="absolute inset-0 size-full">
          <defs>
            <clipPath id={`${id}-room`}>
              <polygon points={planPoints(room.polygon)} />
            </clipPath>
            <radialGradient ref={gradRef} id={`${id}-cone`} gradientUnits="userSpaceOnUse" r={300}>
              <stop offset="0" stopColor={ACTIVE} stopOpacity={0.7} />
              <stop offset="1" stopColor={ACTIVE} stopOpacity={0.1} />
            </radialGradient>
          </defs>
          <polygon
            points={planPoints(room.polygon)}
            fill={ACTIVE}
            fillOpacity={0.1}
            stroke={ACTIVE}
            strokeOpacity={0.8}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <g clipPath={`url(#${id}-room)`}>
            <path
              ref={coneRef}
              fill={`url(#${id}-cone)`}
              stroke={ACTIVE}
              strokeOpacity={0.8}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1}
            />
          </g>
        </svg>

        {/* The overview's room pills, laid out the same way: this room first, the rest collapse to dots when crowded. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {pins.map(({ room: r, mode: pinMode, left, top }) =>
            pinMode === "label" ? (
              <span
                key={r.id}
                className={cn("absolute text-foreground", LABEL_CLASS, r.id === roomId && "border-status-active")}
                style={{ left, top }}
              >
                <PinContent room={r} lit={false} />
              </span>
            ) : (
              <span key={r.id} className="absolute flex size-6 items-center justify-center" style={{ left, top }}>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    r.scanned ? "bg-status-lifted" : "bg-status-queued",
                  )}
                />
              </span>
            ),
          )}
        </div>

        {/* Over the pills: everything you can click or need to see. */}
        <svg
          viewBox={vb.join(" ")}
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden={points.length === 0 || !live}
          role={live && points.length ? "group" : undefined}
          aria-label={live && points.length ? "Viewpoints" : undefined}
        >
          {live && points.length > 1 && (
            <polyline
              points={points.map((p) => p.at.join(",")).join(" ")}
              fill="none"
              stroke="white"
              strokeOpacity={0.5}
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
                  className="pointer-events-auto cursor-pointer outline-none [&:focus-visible>circle:last-child]:stroke-[3]"
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
                    r={5 * k}
                    fill={visited.includes(i) ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.5)"}
                    stroke="white"
                    strokeOpacity={0.85}
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ),
            )}

          {find && (
            <g transform={`translate(${find.at[0]} ${find.at[1]})`}>
              <circle r={8 * k} fill="none" stroke="#FFC850" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <circle r={4.5 * k} fill="#FFC850" />
            </g>
          )}

          <g ref={dotRef}>
            <circle r={12 * k} fill={ACTIVE} fillOpacity={0.3} />
            <circle r={5 * k} fill={ACTIVE} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      </div>
      {measurer}
    </div>
  )
})
