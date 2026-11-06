import { AppShell } from "@/components/world/app-shell"
import { WorldProvider } from "@/components/world/world-provider"

export default function Page() {
  return (
    <WorldProvider>
      <AppShell />
    </WorldProvider>
  )
}
