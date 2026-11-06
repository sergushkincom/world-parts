"use client"

import * as React from "react"
import { ChevronDownIcon, PanelRightCloseIcon } from "lucide-react"
import { COPY, SERVER_TIERS, type ServerTierId } from "@/lib/data"
import { cn } from "@/lib/utils"
import { useWorld, type ServerStatus } from "@/components/world/world-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const STATUS_DOT: Record<ServerStatus, string> = {
  checking: "bg-status-queued",
  online: "bg-status-lifted",
  unreachable: "bg-status-failed",
}

export function ServerPill() {
  const { state, setServerTier, setServerStatus } = useWorld()
  const tier = SERVER_TIERS.find((t) => t.id === state.serverTier) ?? SERVER_TIERS[0]
  const hint =
    state.serverStatus === "checking"
      ? "checking…"
      : state.serverStatus === "unreachable"
        ? "unreachable"
        : tier.latencyHint

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          className="rounded-full font-normal"
          aria-label={`Segmentation server: ${tier.label}, ${hint}. Change server`}
        >
          {state.serverStatus === "checking" ? (
            <Spinner aria-hidden />
          ) : (
            <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_DOT[state.serverStatus])} />
          )}
          <span className="font-medium">{tier.label}</span>
          <span
            className={cn(
              "text-muted-foreground",
              state.serverStatus === "unreachable" && "text-status-failed",
            )}
          >
            {hint}
          </span>
          <ChevronDownIcon aria-hidden data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Segmentation server</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={state.serverTier} onValueChange={(v) => setServerTier(v as ServerTierId)}>
          {SERVER_TIERS.map((t) => (
            <DropdownMenuRadioItem key={t.id} value={t.id} className="items-start">
              <span className="flex flex-col">
                <span className="flex gap-2">
                  <span className="font-medium">{t.label}</span>
                  <span className="text-muted-foreground">{t.latencyHint}</span>
                </span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={state.serverStatus === "unreachable"}
            onCheckedChange={(on) => setServerStatus(on ? "unreachable" : "online")}
          >
            Simulate unreachable server
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface PanelHeaderProps {
  onCollapse: () => void
  collapseRef: React.Ref<HTMLButtonElement>
}

export function PanelHeader({ onCollapse, collapseRef }: PanelHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b px-panel-x py-2.5 max-panel:pt-0">
      <h2 className="min-w-0 flex-1 truncate text-title font-semibold tracking-tight">{COPY.panelTitle}</h2>
      <ServerPill />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={collapseRef}
            variant="ghost"
            size="icon-sm"
            className="max-panel:hidden"
            aria-label="Collapse panel"
            aria-expanded
            aria-controls="segmentation-panel"
            onClick={onCollapse}
          >
            <PanelRightCloseIcon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Collapse panel</TooltipContent>
      </Tooltip>
    </header>
  )
}
