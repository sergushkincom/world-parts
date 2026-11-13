"use client"

import * as React from "react"

export function useMediaQuery(query: string, fallback = false) {
  const [matches, setMatches] = React.useState(fallback)
  React.useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [query])
  return matches
}
