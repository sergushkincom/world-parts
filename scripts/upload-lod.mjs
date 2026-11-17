// Uploads public/splats/<room>-lod/ to Vercel Blob, keeping the same paths, so lod-meta.json's
// relative file links still resolve. Needs BLOB_READ_WRITE_TOKEN (vercel env pull .env.local).
//
//   node --env-file=.env.local scripts/upload-lod.mjs            # all rooms
//   node --env-file=.env.local scripts/upload-lod.mjs workshop   # one room
//
// Prints the store's base URL for NEXT_PUBLIC_SPLAT_LOD_BASE.
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { put } from "@vercel/blob"

const ROOT = "public"
const rooms = process.argv.slice(2).length ? process.argv.slice(2) : ["workshop", "storeroom", "production", "corridor"]
const TYPES = { ".json": "application/json", ".webp": "image/webp" }

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* files(p)
    else yield p
  }
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is missing: run `vercel env pull .env.local` first.")
  process.exit(1)
}

let base = null
for (const room of rooms) {
  const list = []
  for await (const f of files(join(ROOT, "splats", `${room}-lod`))) list.push(f)
  let bytes = 0
  // A few uploads at a time.
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(
      list.slice(i, i + 6).map(async (f) => {
        const pathname = relative(ROOT, f)
        const body = await readFile(f)
        const ext = f.slice(f.lastIndexOf("."))
        const blob = await put(pathname, body, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: TYPES[ext],
          cacheControlMaxAge: 60 * 60 * 24 * 30,
        })
        base ??= blob.url.slice(0, blob.url.length - pathname.length - 1)
        bytes += body.length
      }),
    )
  }
  console.log(`${room}: ${list.length} files, ${(bytes / 1e6).toFixed(1)} MB`)
}
console.log(`\nNEXT_PUBLIC_SPLAT_LOD_BASE=${base}`)
