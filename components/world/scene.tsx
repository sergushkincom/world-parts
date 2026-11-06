"use client"

import * as React from "react"
import { ImageOffIcon, ScanSearchIcon } from "lucide-react"
import { COPY, LAYOUT, OBJECT_PALETTE, SCENE, type WorldObject } from "@/lib/data"
import { bounds, centroid, coverMapping, formatCount, toPointsAttr } from "@/lib/geometry"
import { cn } from "@/lib/utils"
import { useElementSize } from "@/hooks/use-element-size"
import { DRAWABLE, useWorld, type SelectMode } from "@/components/world/world-provider"
import { Button } from "@/components/ui/button"

type ImageState = "loading" | "ready" | "missing"

function modeFromEvent(e: React.MouseEvent): SelectMode {
  if (e.shiftKey) return "range"
  if (e.metaKey || e.ctrlKey) return "toggle"
  return "only"
}

export function Scene() {
  const { state, select, hover, clearSelection, frame } = useWorld()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const { width, height } = useElementSize(containerRef)
  const [imageState, setImageState] = React.useState<ImageState>("loading")

  React.useEffect(() => {
    const img = imgRef.current
    if (img?.complete) setImageState(img.naturalWidth > 0 ? "ready" : "missing")
  }, [])

  const map = coverMapping(width || 1, height || 1, SCENE.width, SCENE.height)
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
    const s = Math.min(
      LAYOUT.frameMaxScale,
      Math.max(LAYOUT.frameMinScale, Math.min((0.45 * width) / (b.width * map.k), (0.45 * height) / (b.height * map.k))),
    )
    const px = cx * map.k + map.offsetX
    const py = cy * map.k + map.offsetY
    transform = { s, tx: width / 2 - px * s, ty: height / 2 - py * s }
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
        if (e.target === e.currentTarget || (e.target as HTMLElement | SVGElement).dataset?.sceneBackdrop !== undefined) clearSelection()
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
          src={SCENE.imageSrc}
          alt={SCENE.alt}
          onLoad={() => setImageState("ready")}
          onError={() => setImageState("missing")}
          className={cn(
            "motion-transition absolute inset-0 size-full object-cover transition-[filter,opacity] duration-300",
            imageState !== "ready" && "opacity-0",
            view === "recolor" && "brightness-50 saturate-50",
            view === "isolate" && "brightness-[0.18] saturate-0",
          )}
        />
        <svg
          data-scene-backdrop
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
          preserveAspectRatio="xMidYMid slice"
          role="group"
          aria-label="Segmented objects"
        >
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
                  select(o.id, modeFromEvent(e))
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

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {width > 0 &&
          drawable.map((o) => {
            if (isHidden(o)) return null
            const { x, y } = toScreen(o)
            if (x < -40 || y < -20 || x > width + 40 || y > height + 20) return null
            const color = OBJECT_PALETTE[o.colorIndex % OBJECT_PALETTE.length]
            const isSel = selected.has(o.id)
            const dimmed = view && !isSel
            return (
              <button
                key={o.id}
                type="button"
                tabIndex={-1}
                onPointerEnter={() => hover(o.id)}
                onPointerLeave={() => hover(null)}
                onClick={(e) => select(o.id, modeFromEvent(e))}
                className={cn(
                  "pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border bg-black/75 px-2 py-0.5 text-label font-medium text-scene-ink shadow-sm backdrop-blur-sm",
                  "motion-transition transition-[left,top,opacity] duration-500 ease-out",
                  dimmed && "opacity-50",
                )}
                style={{ left: x, top: y, borderColor: isSel || state.hoveredId === o.id ? color : "transparent" }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                {o.name}
                <span className="tabular-nums text-scene-ink/60">{formatCount(o.splats ?? 0)}</span>
              </button>
            )
          })}
      </div>

      {segmenting && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="scan-sweep absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-status-active/15 to-transparent" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          {segmenting && (
            <p className="flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-label font-medium text-scene-ink backdrop-blur-sm">
              <ScanSearchIcon aria-hidden className="size-3.5 text-status-active" />
              {`Segment view · "${segmenting.concept}"`}
            </p>
          )}
        </div>
        {framed && (
          <Button
            size="sm"
            variant="secondary"
            className="pointer-events-auto"
            onClick={() => frame(null)}
          >
            Reset frame
          </Button>
        )}
      </div>

      {imageState === "missing" && (
        <p className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-label text-scene-ink/80">
          <ImageOffIcon aria-hidden className="size-3.5" />
          {COPY.scenePlaceholder}
        </p>
      )}
    </div>
  )
}
