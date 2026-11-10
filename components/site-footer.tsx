import { ArrowUpRightIcon } from "lucide-react"

const REPO = "https://github.com/sergushkincom/world-parts"

const LINKS = [
  { label: "GitHub", href: REPO },
  { label: "README", href: `${REPO}#readme` },
]

const link =
  "rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

/** Who made this and where the code is. One thin row under the app, never over it. */
export function SiteFooter() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t bg-background px-panel-x text-label text-muted-foreground">
      <p className="truncate max-sm:hidden">MIT licensed · Design prototype</p>
      <nav aria-label="About this project" className="flex items-center gap-3 max-sm:w-full max-sm:justify-between">
        {LINKS.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={link}>
            {l.label}
          </a>
        ))}
        <a
          href="https://sergushkin.com"
          target="_blank"
          rel="noreferrer"
          className={`${link} flex items-center gap-0.5`}
        >
          Built by <span className="text-foreground">Denys Sergushkin</span>
          <ArrowUpRightIcon aria-hidden className="size-3" />
        </a>
      </nav>
    </footer>
  )
}
