"use client"

import * as React from "react"
import { PLAN, ROOMS, VIEWPOINTS, type Point, type RoomId } from "@/lib/data"
import { conePath, planMapper, roomViewBox, STILL_VIEW, type CameraView } from "@/lib/minimap"
import { navigate } from "@/hooks/use-hash-route"
import { planPoints } from "@/components/plant/floor-plan"

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

/** A blueprint is always dark, so the dark theme's active blue in both themes. */
const ACTIVE = "#5aa2ff"
/** The plan split into walls and furniture (white on transparent, same size as the plan), stacked at two weights. */
const MINIMAP_LAYERS = { walls: "/minimap/plan-walls.webp", furniture: "/minimap/plan-furniture.webp" }

/** Card widths: plan area in CSS px, used to keep dots and rings the same size on screen at any crop. */
const WIDE = { min: "(min-width: 900px)", plan: 240 }
const NARROW_PLAN = 96

function useWide() {
  const [wide, setWide] = React.useState(true)
  React.useEffect(() => {
    const m = window.matchMedia(WIDE.min)
    const on = () => setWide(m.matches)
    on()
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return wide
}

/**
 * The floor plan as a blueprint card, top left in the room. Desktop shows the whole building (where the room
 * sits in the plant), the phone only the room. A dot is where the camera stands, a cone where it looks: fixed
 * for the still frame, live in 3D. Viewpoints are rings; click one to walk there.
 */
export const RoomMinimap = React.forwardRef<MinimapHandle, Props>(function RoomMinimap(
  { roomId, q, live, viewpoint, visited, onViewpoint, find },
  ref,
) {
  const room = ROOMS.find((r) => r.id === roomId)
  const map = React.useMemo(() => planMapper(roomId), [roomId])
  const wide = useWide()
  const id = React.useId().replace(/:/g, "")

  const vb = wide ? [0, 0, PLAN.width, PLAN.height] : roomViewBox(roomId, 16)
  // Plan units per CSS pixel, so marks keep their on-screen size at both crops.
  const k = vb[2] / (wide ? WIDE.plan : NARROW_PLAN)

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

  return (
    <div
      className="pointer-events-auto absolute top-14 left-3 z-10 flex w-[260px] flex-col gap-1.5 rounded-xl border border-white/16 p-2.5 text-white shadow-lg max-panel:w-[112px] max-panel:gap-1 max-panel:rounded-lg max-panel:p-2"
      style={{ background: "rgba(12, 38, 66, 0.92)" }}
    >
      <button
        type="button"
        onClick={back}
        aria-label={`${room.name} on the plant floor plan — back to plant overview`}
        className="flex items-baseline justify-between gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span className="truncate text-[13px] font-semibold text-white/95 max-panel:sr-only">{room.name}</span>
        <span className="shrink-0 truncate font-mono text-[10px] tracking-wide text-white/60 uppercase max-panel:max-w-full">
          {mode}
        </span>
      </button>

      <svg
        viewBox={vb.join(" ")}
        className="block w-full cursor-pointer rounded-md"
        style={{ aspectRatio: `${vb[2]} / ${vb[3]}` }}
        onClick={back}
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
        <image href={MINIMAP_LAYERS.furniture} width={PLAN.width} height={PLAN.height} opacity={0.43} />
        <image href={MINIMAP_LAYERS.walls} width={PLAN.width} height={PLAN.height} opacity={0.92} />
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
        <p className="text-[11px] text-white/60">
          {others} more rooms · inventory only
        </p>
      )}
    </div>
  )
})
