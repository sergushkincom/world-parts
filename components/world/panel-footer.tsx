"use client"

import { AlertTriangleIcon, HardDriveIcon } from "lucide-react"
import { COPY } from "@/lib/data"
import { cn } from "@/lib/utils"
import { useWorld } from "@/components/world/world-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function PanelFooter() {
  const { state, clearAll, conceptInputRef } = useWorld()
  const count = state.objects.length

  return (
    <footer className="flex items-center gap-3 border-t px-panel-x py-2">
      <p
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 text-label text-muted-foreground",
          !state.storageOk && "text-status-low",
        )}
      >
        {state.storageOk ? (
          <HardDriveIcon aria-hidden className="size-3.5 shrink-0" />
        ) : (
          <AlertTriangleIcon aria-hidden className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{state.storageOk ? COPY.storageNote : COPY.storageBlocked}</span>
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="xs" disabled={!count}>
            Clear all
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all segmented objects?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This removes ${count} ${count === 1 ? "object" : "objects"} and their lifted splats from this browser. Segmenting them again costs new calls to the server.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep objects</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                clearAll()
                requestAnimationFrame(() => conceptInputRef.current?.focus())
              }}
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </footer>
  )
}
