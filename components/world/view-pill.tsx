"use client"

import * as React from "react"
import { CheckIcon, EllipsisIcon, InfoIcon, KeyboardIcon, LinkIcon, RotateCcwIcon, RulerIcon } from "lucide-react"
import { copyText } from "@/lib/clipboard"
import { activatedByPointer, useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SPLAT_QUALITIES, type SplatQuality } from "@/lib/splat-quality"
import type { LocomotionMode } from "@/lib/walk"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const REPO = "https://github.com/sergushkincom/world-parts"

type ViewMode = "still" | "live"

const item = "max-panel:min-h-11"

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

const seg =
  "inline-flex h-8 items-center justify-center rounded-full px-2.5 text-xs font-medium text-scene-ink/75 outline-none hover:bg-white/10 hover:text-scene-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:bg-white/15 aria-pressed:text-scene-ink max-panel:h-11 max-panel:min-w-11 max-panel:px-3 max-panel:text-sm"

/**
 * View controls only, in one pill. Orbit and Walk share the Move group.
 * On a narrow screen that group moves into More, and the mode labels shorten.
 * Walk stays greyed, with the reason in the name, until Live 3D has loaded.
 */
export function ViewPill({
  mode,
  onMode,
  locomotion,
  onLocomotion,
  walkDisabledReason,
  measuring,
  onMeasuring,
  measureDisabledReason,
  onReset,
  copyDisabledReason,
  onCopyView,
  quality,
  onQuality,
  onNotify,
  onOpenShortcuts,
}: {
  mode: ViewMode
  onMode: (mode: ViewMode) => void
  locomotion: LocomotionMode
  onLocomotion: (locomotion: LocomotionMode) => void
  /** Set when Walk cannot run. The text is the accessible explanation. */
  walkDisabledReason: string | null
  measuring: boolean
  onMeasuring: (measuring: boolean) => void
  /** Set when Measure cannot run. The text is the accessible explanation. */
  measureDisabledReason: string | null
  onReset: () => void
  /** Why Copy view is greyed out, or null when the live camera can be shared. */
  copyDisabledReason: string | null
  /** Copies the view link. Resolves false when the clipboard refuses. */
  onCopyView: () => Promise<boolean>
  quality: SplatQuality
  onQuality: (quality: SplatQuality) => void
  onNotify: (message: string) => void
  onOpenShortcuts: () => void
}) {
  const [about, setAbout] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const copiedTimer = React.useRef(0)
  const { notePointer } = useShortcutLearning()
  const touchMove = useMediaQuery("(pointer: coarse)")
  const orbitHint = "Drag to look · scroll to zoom"
  const walkHint = touchMove
    ? "Drag to look · drag the stick to move"
    : "Drag to look · WASD or arrows, view focused"
  const orbitHintId = React.useId()
  const walkHintId = React.useId()

  const shareRoom = async () => {
    const ok = await copyText(window.location.href)
    onNotify(ok ? "Link copied" : "Couldn't copy link")
  }

  React.useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  const copyView = async () => {
    // Show the confirmation as the click lands. The clipboard can take a moment.
    setCopied(true)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2200)
    const ok = await onCopyView()
    if (ok) return
    window.clearTimeout(copiedTimer.current)
    setCopied(false)
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="View controls"
        data-view-pill
        className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full bg-black/75 p-1 text-scene-ink shadow-lg backdrop-blur-sm"
      >
        <p id={orbitHintId} className="sr-only">
          {orbitHint}
        </p>
        <p id={walkHintId} className="sr-only">
          {walkHint}
        </p>
        <div role="group" aria-label="Room view" className="flex items-center">
          <Tip label="Still frame">
            <button type="button" className={seg} aria-pressed={mode === "still"} onClick={() => onMode("still")}>
              Still
            </button>
          </Tip>
          <Tip label="Live 3D">
            <button type="button" className={seg} aria-pressed={mode === "live"} onClick={() => onMode("live")}>
              <span className="panel:hidden">3D</span>
              <span className="hidden panel:inline">Live 3D</span>
            </button>
          </Tip>
        </div>

        <span aria-hidden className="mx-0.5 hidden h-5 w-px shrink-0 bg-white/20 panel:block" />

        <div role="group" aria-label="Move" className="hidden items-center panel:flex">
          <Tip label={orbitHint}>
            <button
              type="button"
              className={seg}
              aria-pressed={locomotion === "orbit"}
              aria-describedby={orbitHintId}
              onClick={() => onLocomotion("orbit")}
            >
              Orbit
            </button>
          </Tip>
          {walkDisabledReason ? (
            <Tip label={walkDisabledReason}>
              <span
                tabIndex={0}
                role="button"
                aria-disabled="true"
                aria-pressed={locomotion === "walk"}
                aria-label={`Walk. ${walkDisabledReason}`}
                className={cn(seg, "cursor-not-allowed opacity-40")}
                onClick={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") event.preventDefault()
                }}
              >
                Walk
              </span>
            </Tip>
          ) : (
            <Tip label={walkHint}>
              <button
                type="button"
                className={seg}
                aria-pressed={locomotion === "walk"}
                aria-describedby={walkHintId}
                onClick={() => onLocomotion("walk")}
              >
                Walk
              </button>
            </Tip>
          )}
        </div>

        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-white/20" />

        {measureDisabledReason ? (
          <Tip label={measureDisabledReason}>
            <span
              tabIndex={0}
              role="button"
              aria-disabled="true"
              aria-pressed={false}
              aria-label={`Measure. ${measureDisabledReason}`}
              className={cn(seg, "cursor-not-allowed gap-1 opacity-40")}
              onClick={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") event.preventDefault()
              }}
            >
              <RulerIcon aria-hidden className="size-4" />
              <span className="max-panel:sr-only">Measure</span>
            </span>
          </Tip>
        ) : (
          <Tip label={measuring ? "Clear · Esc" : "Distance on the scan · M"}>
            <button
              type="button"
              className={cn(seg, "gap-1")}
              aria-pressed={measuring}
              aria-keyshortcuts="M"
              onClick={(event) => {
                if (activatedByPointer(event)) notePointer("measure")
                onMeasuring(!measuring)
              }}
            >
              <RulerIcon aria-hidden className="size-4" />
              <span className="max-panel:sr-only">Measure</span>
            </button>
          </Tip>
        )}

        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-white/20" />

        {copyDisabledReason ? (
          <Tip label={copyDisabledReason}>
            <span
              tabIndex={0}
              role="button"
              aria-disabled="true"
              aria-label={`Copy view link. ${copyDisabledReason}`}
              className={cn(seg, "cursor-not-allowed gap-1 opacity-40")}
              onClick={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") event.preventDefault()
              }}
            >
              <LinkIcon aria-hidden className="size-4" />
              <span className="sr-only">Copy view</span>
            </span>
          </Tip>
        ) : (
          <Tip label="Copy view link">
            <button
              type="button"
              className={cn(seg, "gap-1", copied && "bg-white/15 text-scene-ink")}
              data-copy-view
              data-copied={copied ? "true" : "false"}
              aria-label={copied ? "View link copied" : "Copy view link"}
              onClick={() => void copyView()}
            >
              {copied ? (
                <CheckIcon aria-hidden className="copy-pop size-4" />
              ) : (
                <LinkIcon aria-hidden className="size-4" />
              )}
              <span className={copied ? "copy-pop" : "sr-only"}>{copied ? "Copied" : "Copy view"}</span>
            </button>
          </Tip>
        )}
        <span className="sr-only" aria-live="polite">
          {copied ? "Copied" : ""}
        </span>

        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-white/20" />

        <Tip label="Reset · R">
          <button
            type="button"
            className={seg}
            aria-label="Reset view"
            aria-keyshortcuts="R"
            onClick={(event) => {
              if (activatedByPointer(event)) notePointer("reset")
              onReset()
            }}
          >
            <RotateCcwIcon aria-hidden className="size-4" />
            <span className="sr-only">Reset</span>
          </button>
        </Tip>

        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-white/20" />

        <DropdownMenu>
          <Tip label="More">
            <DropdownMenuTrigger asChild>
              <button type="button" className={seg} aria-label="More view options">
                <EllipsisIcon aria-hidden className="size-4" />
              </button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent side="top" align="center" sideOffset={10} className="w-56">
            <div className="panel:hidden">
              <DropdownMenuLabel>Move</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={locomotion}
                onValueChange={(value) => onLocomotion(value as LocomotionMode)}
              >
                <DropdownMenuRadioItem value="orbit" className={item}>
                  Orbit
                  <span className="sr-only">{`. ${orbitHint}`}</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="walk" disabled={walkDisabledReason !== null} className={item}>
                  Walk
                  <span className="sr-only">{`. ${walkDisabledReason ?? walkHint}`}</span>
                  {walkDisabledReason ? (
                    <span className="ml-auto text-xs font-normal tracking-normal text-muted-foreground">Live 3D</span>
                  ) : null}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </div>
            <DropdownMenuGroup>
              <DropdownMenuItem className={item} onSelect={() => void shareRoom()}>
                <LinkIcon aria-hidden />
                Share room link
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={item}>Quality</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={quality} onValueChange={(v) => onQuality(v as SplatQuality)}>
                    {SPLAT_QUALITIES.map((q) => (
                      <DropdownMenuRadioItem key={q.id} value={q.id} className={item}>
                        {q.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem className={item} onSelect={onOpenShortcuts}>
                <KeyboardIcon aria-hidden />
                Keyboard shortcuts
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => setAbout(true)}>
                <InfoIcon aria-hidden />
                About world & license
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={about} onOpenChange={setAbout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>About this world</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty sm:text-left">
              The workshop is a still of a SpAItial world (Echo-2, image to world). Live 3D plays the same world as a
              Gaussian splat, from a file on this machine. The code is MIT. The world and its still frame are not
              covered by that licence; the world file is for personal, non-commercial use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <a
              href={`${REPO}#readme`}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:mr-auto"
            >
              README
            </a>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
