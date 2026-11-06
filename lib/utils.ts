import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Custom font-size tokens from globals.css; without this, twMerge reads them as text colours and drops them.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["label", "row", "body", "title"] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
