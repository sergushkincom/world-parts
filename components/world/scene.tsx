"use client"

import * as React from "react"
import { ImageOffIcon, ScanSearchIcon } from "lucide-react"
import { COPY, DOORS, LAYOUT, OBJECT_PALETTE, SCENE, isScanned, worldOf, type WorldObject } from "@/lib/data"
import { bounds, centroid, containMapping, formatCount, toPointsAttr } from "@/lib/geometry"
import { cn } from "@/lib/utils"
import { useElementSize } from "@/hooks/use-element-size"
import { useCardRect, type Rect } from "@/hooks/use-card-inset"
import { activatedByPointer, useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { DRAWABLE, useWorld, type SelectMode } from "@/components/world/world-provider"
import { navigate } from "@/hooks/use-hash-route"

type ImageState = "loading" | "ready" | "missing"

function modeFromEvent(e: React.MouseEvent): SelectMode {
  if (e.shiftKey) return "range"
  if (e.metaKey || e.ctrlKey) return "toggle"
  return "only"
}

/**
 * Keeps a scaled image edge from pulling inside the viewport, so framing never reveals the backdrop.
 * When the scaled image is narrower than the viewport it stays centred instead.
 */
function clampPan(t: number, s: number, imgStart: number, imgEnd: number, view: number) {
  const a = imgStart * s
  const b = imgEnd * s
  if (b - a <= view) return (view - a - b) / 2
  return Math.min(-a, Math.max(view - b, t))
}

export function Scene() {
  const { state, select, hover, clearSelection, openCard } = useWorld()
  const { notePointer } = useShortcutLearning()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const { width, height } = useElementSize(containerRef)
  const [imageState, setImageState] = React.useState<ImageState>("loading")
  const card = useCardRect(containerRef, state.cardId !== null)

  const still = worldOf(state.roomId).still
  const doors = (DOORS[state.roomId] ?? []).filter((d) => d.polygon)

  // A new room means a new image: start from "loading" again, then read the cached state.
  React.useEffect(() => {
    setImageState("loading")
    const img = imgRef.current
    if (img?.complete) setImageState(img.naturalWidth > 0 ? "ready" : "missing")
  }, [still.src])

  const map = containMapping(width || 1, height || 1, SCENE.width, SCENE.height)
  const drawable = state.objects.filter((o) => DRAWABLE.includes(o.status) && o.polygon)
  const selected = new Set(state.selection)
  const hasSelection = drawable.some((o) => selected.has(o.id))
  const view = hasSelection ? state.gaussianView : null
  const segmenting = state.objects.find((o) => o.status === "segmenting")

  const framed = drawable.find((o) => o.id === state.framedId)
  let transform = { s: 1, tx: 0, ty: 0 }
  if (framed?.polygon && width && height) {
    const [cx, cy] = centroid(framed.polygon)
    const b = bounds(framed.polygon)
    const px = cx * map.k + map.offsetX
    const py = cy * map.k + map.offsetY
    const imgW = SCENE.width * map.k
    const imgH = SCENE.height * map.k
    const full: Rect = { left: 0, top: 0, right: width, bottom: height }
    const areas: Rect[] = card
      ? [
          { ...full, right: card.left },
          { ...full, top: card.bottom },
          { ...full, bottom: card.top },
        ].filter((a) => a.right - a.left > width * 0.3 && a.bottom - a.top > height * 0.3)
      : []
    if (!areas.length) areas.push(full)

    const fit = (a: Rect) => {
      const aw = a.right - a.left
      const ah = a.bottom - a.top
      const s = Math.min(
        LAYOUT.frameMaxScale,
        Math.max(LAYOUT.frameMinScale, Math.min((0.45 * aw) / (b.width * map.k), (0.45 * ah) / (b.height * map.k))),
      )
      // Clamp against the whole viewport, so the image never reveals the backdrop anywhere.
      const t = {
        s,
        tx: clampPan((a.left + a.right) / 2 - px * s, s, map.offsetX, map.offsetX + imgW, width),
        ty: clampPan((a.top + a.bottom) / 2 - py * s, s, map.offsetY, map.offsetY + imgH, height),
      }
      const box = {
        left: (b.x * map.k + map.offsetX) * s + t.tx,
        top: (b.y * map.k + map.offsetY) * s + t.ty,
        right: ((b.x + b.width) * map.k + map.offsetX) * s + t.tx,
        bottom: ((b.y + b.height) * map.k + map.offsetY) * s + t.ty,
      }
      const overlap = card
        ? Math.max(0, Math.min(box.right, card.right) - Math.max(box.left, card.left)) *
          Math.max(0, Math.min(box.bottom, card.bottom) - Math.max(box.top, card.top))
        : 0
      return { t, overlap }
    }

    transform = areas.map(fit).reduce((best, c) => (c.overlap < best.overlap ? c : best)).t
  }

  const toScreen = (o: WorldObject) => {
    const [cx, cy] = centroid(o.polygon!)
    return {
      x: (cx * map.k + map.offsetX) * transform.s + transform.tx,
      y: (cy * map.k + map.offsetY) * transform.s + transform.ty,
    }
  }

  const isHidden = (o: WorldObject) => view === "isolate" && !selected.has(o.id)

  return (
    <div
      ref={containerRef}
      className="relative size-full overflow-hidden bg-scene"
      onClick={(e) => {
        const backdrop = e.target === e.currentTarget || (e.target as HTMLElement | SVGElement).dataset?.sceneBackdrop !== undefined
        if (!backdrop) return
        const hadTarget = state.selection.length > 0 || state.framedId != null
        clearSelection()
        if (hadTarget && !state.cardId && activatedByPointer(e)) notePointer("escape")
      }}
    >
      <div
        data-scene-backdrop
        className="motion-transition absolute inset-0 origin-top-left transition-transform duration-500 ease-out"
        style={{ transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.s})` }}
      >
        {imageState !== "ready" && (
          <div
            data-scene-backdrop
            aria-hidden
            className="absolute inset-0 [background-image:linear-gradient(var(--scene-grid)_1px,transparent_1px),linear-gradient(90deg,var(--scene-grid)_1px,transparent_1px)] [background-size:48px_48px]"
          />
        )}
        {/* Plain img: the still may be missing until the user drops it in, and we need its load/error state. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          data-scene-backdrop
          src={still.src}
          alt={still.alt}
          onLoad={() => setImageState("ready")}
          onError={() => setImageState("missing")}
          className={cn(
            "motion-transition absolute inset-0 size-full object-contain transition-[filter,opacity] duration-300",
            imageState !== "ready" && "opacity-0",
            view === "recolor" && "brightness-50 saturate-50",
            view === "isolate" && "brightness-[0.18] saturate-0",
          )}
        />
        <svg
          data-scene-backdrop
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Segmented objects"
        >
          {doors.map((d) => {
            const open = isScanned(d.to)
            return (
              <g
                key={d.to}
                className={cn("door-hotspot", open ? "cursor-pointer" : "cursor-not-allowed")}
                onClick={(e) => {
                  e.stopPropagation()
                  if (open) navigate({ level: "room", room: d.to, object: null, q: "" })
                }}
              >
                <title>{open ? `Go to ${d.label}` : `${d.label} · not scanned yet`}</title>
                <polygon
                  points={toPointsAttr(d.polygon!)}
                  fill="white"
                  fillOpacity={0.06}
                  stroke="white"
                  strokeOpacity={open ? 0.7 : 0.35}
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
          {drawable.map((o) => {
            const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
            const isSel = selected.has(o.id)
            const isHover = state.hoveredId === o.id
            const dimmed = view && !isSel
            const fill = isSel ? (view === "recolor" ? 0.55 : view === "isolate" ? 0.35 : 0.28) : isHover ? 0.3 : 0.14
            if (isHidden(o)) return null
            return (
              <g
                key={o.id}
                className="motion-transition cursor-pointer transition-opacity duration-200"
                opacity={dimmed ? (view === "highlight" ? 0.5 : 0.22) : 1}
                onPointerEnter={() => hover(o.id)}
                onPointerLeave={() => hover(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  const mode = modeFromEvent(e)
                  select(o.id, mode)
                  if (mode === "only") openCard(o.id, "part")
                  if (mode === "range" && activatedByPointer(e)) notePointer("extend")
                }}
              >
                <title>{o.name}</title>
                <polygon
                  points={toPointsAttr(o.polygon!)}
                  fill={color}
                  fillOpacity={fill}
                  stroke={color}
                  strokeWidth={isSel || isHover ? 3 : 1.75}
                  strokeDasharray={o.status === "low_confidence" ? "7 5" : undefined}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {isSel && (
                  <polygon
                    className="overlay-pulse pointer-events-none"
                    points={toPointsAttr(o.polygon!)}
                    fill="none"
                    stroke={color}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {width > 0 &&
          drawable.map((o) => {
            if (isHidden(o)) return null
            const { x, y } = toScreen(o)
            if (x < -40 || y < -20 || x > width + 40 || y > height + 20) return null
            const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
            const isSel = selected.has(o.id)
            const isHover = state.hoveredId === o.id
            const dimmed = view && !isSel
            // Under the panel breakpoint only the selected and hovered objects keep a text label.
            const compact = !isSel && !isHover
            return (
              <button
                key={o.id}
                type="button"
                tabIndex={-1}
                onPointerEnter={() => hover(o.id)}
                onPointerLeave={() => hover(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  const mode = modeFromEvent(e)
                  select(o.id, mode)
                  if (mode === "only") openCard(o.id, "part")
                  if (mode === "range" && activatedByPointer(e)) notePointer("extend")
                }}
                className={cn(
                  "pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border bg-black/75 px-2 py-0.5 text-label font-medium text-scene-ink shadow-sm backdrop-blur-sm",
                  "motion-transition transition-[left,top,opacity] duration-500 ease-out",
                  compact && "max-panel:p-1.5",
                  isSel && "z-10",
                  dimmed && "opacity-50",
                )}
                style={{ left: x, top: y, borderColor: isSel || isHover ? color : "transparent" }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                <span className={cn(compact && "max-panel:hidden")}>{o.name}</span>
                <span className={cn("tabular-nums text-scene-ink/60", compact && "max-panel:hidden")}>
                  {formatCount(o.splats ?? 0)}
                </span>
              </button>
            )
          })}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {width > 0 &&
          doors.map((d) => {
            const [cx] = centroid(d.polygon!)
            const x = (cx * map.k + map.offsetX) * transform.s + transform.tx
            const y = (bounds(d.polygon!).y * map.k + map.offsetY) * transform.s + transform.ty
            const open = isScanned(d.to)
            return (
              <button
                key={d.to}
                type="button"
                disabled={!open}
                onClick={() => navigate({ level: "room", room: d.to, object: null, q: "" })}
                className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full items-center gap-1 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-label font-medium text-black shadow-sm disabled:bg-black/60 disabled:text-scene-ink/70"
                style={{ left: x, top: y - 6 }}
              >
                {open ? `→ ${d.label}` : `${d.label} · not scanned`}
              </button>
            )
          })}
      </div>

      {segmenting && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="scan-sweep absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-status-active/15 to-transparent" />
        </div>
      )}

      {segmenting && (
        <p className="pointer-events-none absolute bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.75rem))] left-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-label font-medium text-scene-ink backdrop-blur-sm">
          <ScanSearchIcon aria-hidden className="size-3.5 text-status-active" />
          {`Segment view · "${segmenting.concept}"`}
        </p>
      )}

      {imageState === "missing" && (
        <p className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-label text-scene-ink/80">
          <ImageOffIcon aria-hidden className="size-3.5" />
          {COPY.scenePlaceholder}
        </p>
      )}
    </div>
  )
}
