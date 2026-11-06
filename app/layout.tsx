import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "world-parts · SAM3 lift to 3D",
  description: "Design pass on the segment-3gs control panel: segment a concept, lift it to splats, reuse it forever.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e10" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  )
}
