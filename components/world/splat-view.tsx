"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"
import { LIVE_WORLD } from "@/lib/data"
import type { SplatCanvasHandle, SplatStatus } from "@/components/world/splat-canvas"
import { Button } from "@/components/ui/button"

// WebGL can't run on the server: load the engine only in the browser, and only when Live 3D is on.
const SplatCanvas = dynamic(() => import("@/components/world/splat-canvas").then((m) => m.SplatCanvas), {
  ssr: false,
})

function useHint() {
  const [touch, setTouch] = React.useState(false)
  React.useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), [])
  return touch ? "Drag to look · Pinch to zoom" : "Drag to look · Scroll to zoom · Right-drag to move"
}

export function SplatView({ topLeft, onFallback }: { topLeft?: React.ReactNode; onFallback: () => void }) {
  const ref = React.useRef<SplatCanvasHandle>(null)
  const [status, setStatus] = React.useState<SplatStatus>({ kind: "loading", progress: null })
  const [touched, setTouched] = React.useState(false)
  const hint = useHint()

  return (
    <div className="absolute inset-0 overflow-hidden bg-scene">
      <SplatCanvas
        ref={ref}
        src={LIVE_WORLD.src}
        home={LIVE_WORLD.home}
        rotation={LIVE_WORLD.rotation}
        onStatus={setStatus}
        onFirstInteraction={() => setTouched(true)}
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">{topLeft}</div>
        {status.kind === "ready" && (
          <Button size="sm" variant="secondary" className="pointer-events-auto" onClick={() => ref.current?.reset()}>
            <RotateCcwIcon aria-hidden data-icon="inline-start" />
            Reset view
          </Button>
        )}
      </div>

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

      {status.kind === "ready" && (
        <p
          aria-hidden={touched}
          className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-3 py-1.5 text-label whitespace-nowrap text-scene-ink backdrop-blur-sm transition-opacity duration-500 data-[gone=true]:opacity-0"
          data-gone={touched}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
