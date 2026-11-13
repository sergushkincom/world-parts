"use client"

import * as React from "react"
import { EllipsisIcon, InfoIcon, KeyboardIcon, LinkIcon, RotateCcwIcon } from "lucide-react"
import { copyText } from "@/lib/clipboard"
import { activatedByPointer, useShortcutLearning } from "@/hooks/use-shortcut-learning"
import { SPLAT_QUALITIES, type SplatQuality } from "@/lib/splat-quality"
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
  DropdownMenuShortcut,
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
 * View controls only, in one pill. Walk stays off: the camera is orbit (`enableFly` is false).
 * On a narrow screen Orbit / Walk move into More, and the mode labels shorten.
 */
export function ViewPill({
  mode,
  onMode,
  onReset,
  quality,
  onQuality,
  onNotify,
  onOpenShortcuts,
}: {
  mode: ViewMode
  onMode: (mode: ViewMode) => void
  onReset: () => void
  quality: SplatQuality
  onQuality: (quality: SplatQuality) => void
  onNotify: (message: string) => void
  onOpenShortcuts: () => void
}) {
  const [about, setAbout] = React.useState(false)
  const { notePointer } = useShortcutLearning()

  const shareRoom = async () => {
    const ok = await copyText(window.location.href)
    onNotify(ok ? "Link copied" : "Couldn't copy link")
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="View controls"
        data-view-pill
        className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full bg-black/75 p-1 text-scene-ink shadow-lg backdrop-blur-sm"
      >
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
          <Tip label="Orbit">
            <button type="button" className={seg} aria-pressed="true">
              Orbit
            </button>
          </Tip>
          <Tip label="Coming soon">
            <span
              tabIndex={0}
              role="group"
              aria-label="Walk, coming soon"
              className="inline-flex rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span aria-disabled="true" className={cn(seg, "pointer-events-none opacity-40")}>
                Walk
              </span>
            </span>
          </Tip>
        </div>

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
              <DropdownMenuRadioGroup value="orbit">
                <DropdownMenuRadioItem value="orbit" className={item}>
                  Orbit
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="walk" disabled className={item}>
                  Walk
                  <DropdownMenuShortcut>Coming soon</DropdownMenuShortcut>
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
