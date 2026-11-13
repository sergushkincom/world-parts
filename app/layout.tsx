import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

const title = "world-parts · find a part in a segmented world"
const description =
  "A design pass on segment-3gs: find a spare part across a plant, in world or inventory only. Segmentation is mocked; the room is a still frame of a SpAItial world."

// Link previews (LinkedIn, X, Slack). The image comes from app/opengraph-image.png and
// app/twitter-image.png; metadataBase turns it into the absolute URL crawlers need.
export const metadata: Metadata = {
  metadataBase: new URL("https://world-parts.vercel.app"),
  title,
  description,
  openGraph: { type: "website", url: "/", siteName: "world-parts", title, description },
  twitter: { card: "summary_large_image", title, description },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
