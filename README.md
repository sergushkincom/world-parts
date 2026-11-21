# world-parts

**Find a spare part in a 3D scan of the plant, not in a spreadsheet.**

A design prototype: parts data attached to objects in a segmented 3D world. Built in a day; the segmentation is mocked.

**Design case study:** [World Parts on Dribbble](https://dribbble.com/shots/27887061-Design-Case-Study-13-World-Parts-Find-Spare-Parts-in-3D)

![Demo, 12 s loop: search for a mechanical seal, open its location, and land in the scanned workshop with the cabinet highlighted and its bins open](docs/demo.webp)

## Try it in 30 seconds

1. Open **[world-parts.vercel.app](https://world-parts.vercel.app)**.
2. Press `/` and search for `spindle`.
3. Pick a result marked `in world`: you walk into the scanned room with the machine in frame and its parts card open.
4. Rooms marked `not scanned` answer from the inventory list only, and say so.

## Background

A design pass built on top of [risenW/segment-3gs](https://github.com/risenW/segment-3gs) — a Gaussian-splat segmentation playground on [SpAItial](https://spaitial.ai) worlds, where you segment an object once and it lives in 3D from then on. The pipeline there is real. This repo is the surface around it: the segmentation is mocked, the question is what a maintenance engineer does with a segmented world once their parts data hangs on it.

Prototype only. Not affiliated with SpAItial.

![Plant overview with a part search, and the workshop with the found pump framed](docs/preview.webp)

## The question

`segment-3gs` says in its own README that it is "a starting point to fork, not a product". Two things keep it a demo:

1. **A segmented object knows its own geometry and nothing else.** For a real-estate visitor that's fine. For the other persona — a team that integrates worlds into their own product through the API — the object is only useful once their data hangs on it: what it is, what's in stock, what replaces it.
2. **One world is one room.** A plant has many; only some are scanned. The interface has to be honest about which rooms can answer "where is it" in 3D and which can only answer from the inventory list.

So the prototype starts from the plant, not from the viewer: search for a part, see which rooms have it and how precisely, walk into the scanned one, and find it framed with its parts record open. The scene is a factory workshop because that's where the question is sharpest.

## What's here

- **Parts list** — the start screen: part number, name, stock, location and status (`low · idle · installed only`), filters, sorting, and a detail drawer with stock by location, which equipment the part is installed in, substitutes and similar parts with the reason, and *Also known as*: the names the same part carries in the ERP, a datasheet or an invoice, merged into one record. Every location is a link: into the room if it's scanned, onto the plan if it's inventory only.
- **Plant overview** — a floor plan with five rooms (one `scanned`, four `not scanned`), a search field that takes a name or a part number, and results grouped by room: `in world` (exact object, click to enter) or `inventory only` (location as text, "scan this room to locate parts in 3D"). Pinch-to-zoom and drag on mobile. The plan is a blueprint (navy paper, grid, walls and furniture at two weights), the same drawing as the room minimap, and it fits the building rather than the whole image, so the building fills the screen.
- **Room** — the workshop scene with segmented objects as overlays and tracking labels; entering from a search result frames the object and opens its card. A blueprint minimap top left shows where you stand and where you look: a dot and a view cone, fixed for the still frame and following the camera in Live 3D. In Live 3D, three viewpoints (entrance, centre aisle, by the cabinet) are rings on the plan; click one to walk there. Find puts an amber pin on the found object. The live world is mapped onto the plan with two measured points per room; the world was generated from a photo and the plan drawn separately, so x and z get their own scale and the cone goes through the same mapping. The breadcrumb returns to the plant. The minimap sits under it: drag the header to move the card, S, M and L change its size, and the zoom buttons crop the plan around the room. Collapse it to an icon. Position, size, zoom and collapsed state stay in this browser. Double-click the header, or Enter while it is focused, to put it back under the breadcrumb. On a narrow screen it keeps the small size and offers drag and collapse, and it stays above the object sheet. 300 ms zoom-and-fade between levels, static swap with reduced motion.
- **Segmentation panel** — concept input (and what it can't do), object list with explicit states (`lifted · low confidence · failed` with a reason and Retry), multi-select, Gaussian view as a three-way switch, server status pill with latency.
- **Rooms and doors** — four spaces are scanned: workshop, storeroom, production hall and the corridor that joins them. Each has its own SpAItial world, still frame, objects and minimap calibration. In the corridor the doors are drawn on the still and labelled (`→ Storeroom`); every room has a `→ Corridor` button, since its own door is behind the camera. Office and loading bay have no capture yet, so their doors say "not scanned". Search runs across all rooms: a part on a storeroom shelf opens rack R3 at shelf 2, a belt fitted in the CNC machines opens the production hall.
- **Live 3D** — a `Still · Live 3D` switch in the room. Live loads the SpAItial world as a SOG splat in PlayCanvas. **Orbit:** drag to look, scroll or pinch to zoom, right-drag to move. **Walk:** drag to look, and WASD or the arrow keys move while the view is focused (search keeps the keyboard). Eye height stays put, and the camera cannot leave the room. On a touch screen a stick stands in for the keys. Select a part, or frame an object, and chevrons draw themselves across the floor from where you stand to that cabinet or machine. The path follows as you walk and drops out once you are there; clearing the selection removes it. Reduced motion shows the finished path, still. "Find" and "Find spare" fly there in Orbit, and walk up to the object in Walk. With nothing framed, no card open, and Orbit selected, an idle tour visits each object (in the workshop: hose, pallet, pump, motor, valve, extinguisher, cabinet), holds on it with the tint and that object's callout, pulls back home and repeats. The first drag, scroll, key, or callout click stops the tour and leaves the camera where it is; Find still works after that. Walk stops it too, and it does not start again until the next visit. The tour does not open the parts card. It stays off when the viewer prefers reduced motion; `?present=1` runs it anyway, for a recording, but not during Walk. The Walk control stays greyed on the still frame, and says why. **Measure** (Live 3D only) clicks two points and shows the distance; the reading is approximate. See *Measure* below. **Copy view** (Live 3D only) copies a link to the camera and the selected object. Opening that link switches to Live 3D and eases the camera into place; reduced motion jumps. The button shows Copied, then returns. On the still frame it stays greyed and says why. Controls are a one-line hint that fades after the first drag, plus a non-modal panel on `?`. The still frame stays the default and the fallback (loading, error, no WebGL). See *Running the live world* below.
- **Objects in the 3D world** — labels pinned to each object's splats, so they stay on the object from any angle. In Live 3D the label is a product callout: a dot on the surface, a leader line, and a card off to the side with the unit's name, its number, and stock or availability when the parts data has them (units on a shelf, or whether a machine's spares are in stock, low, or installed only). The card flips to the clearer side of the dot and stays inside the view. A narrow pane keeps the dot, and opens the compact card — name, number, and stock — for the focused object. Framing an object, or the idle tour resting on it, emphasizes its callout and dims the others; the tour also pulses that dot. The cards are buttons, so they take keyboard focus. The found dot pulses, and that pulse is a static ring when reduced motion is on. Callouts are not hidden by depth. The still frame keeps the pill (dot, name, splat count). Hover a label and the object's splats light up in its colour, in the shape of its still-frame mask, while the rest of the world dims; click it and the camera goes there (a flight in Orbit, a walk at eye height in Walk) and the card opens. How: the still's masks are lifted onto the world. Every splat is projected into the still with the still's own camera (calibrated by overlaying the still on the render); a splat is part of an object when it lands in the object's mask at the object's depth, so the wall behind the cabinet stays dark. Limit: sides the still never saw aren't in any mask.
- **Substitute instead of a dead end** — when a part in a unit has no spare (the impeller in pump P-104), the card says so and offers a stocked part that does the same job, with the reason, and **Find substitute** takes you to its bin. Matches are labelled `exact duplicate · functional substitute · related`, and `related` is never offered as a swap. The substitute here has sat idle for 13 months, so using it is also the reuse case.
- **Object card** — *Object* (splats, views, confidence) and *Parts in this unit* on equipment, with a "Find spare" action that frames the cabinet; *Bins* on the cabinet, a 2×3 grid with the searched bin highlighted.
- Desktop and 375 px, keyboard for everything that isn't the camera (`/` search, `L · S · P` views, `G` segment, `Esc` back, `↑/↓`, `1/2/3`), reduced motion respected, state in the URL so a link opens the same view.

Vocabulary is kept from the original project — concept, segment view, lift, views, votes, Gaussian view, isolate — so this can be read next to its code.

## Split view: list and 3D side by side

`List · Split · Plan` (or `S`) puts a compact parts table next to the selected part's room in Live 3D. Selection lives in one place, the URL (`?view=split&part=SEL-25`), so a link opens the same part in the same room.

![Split view: the parts table on the left, the workshop in 3D on the right with pump P-104 framed and tinted](docs/split-view.png)

- **Table → 3D.** Click a row or press `Enter`. The camera flies to the equipment that holds the part (~600 ms, ease-out) and tints it; a part in another scanned room loads that room first. `↑/↓` move through rows and fly along. `Esc` clears the selection. With reduced motion the camera jumps.
- **3D → table.** Click a label in 3D and the row of a part kept or fitted there is selected and scrolled into view. The camera stays on what you clicked, even when that part's spare is elsewhere. Equipment with no parts on record says so.
- **Hover.** Pointing at a row tints its equipment in 3D; the camera doesn't move.
- **No scan yet.** A part in a room without a capture still selects; the right side shows the floor plan with that room marked and "No 3D scan for this room yet".
- **Layout.** Drag the divider (or focus it and use `←/→`, `Home` resets). Under 900 px the two stack, 3D on top.

<img src="docs/split-view-mobile.png" alt="Split view at phone width: 3D on top, part cards below" width="300">

## Measure

In Live 3D, **Measure** (`M`, or the ruler in the view pill) checks whether a spare part would fit on the scan. Click two points. A line, end marks and a label at the midpoint show the distance in metres. Click again to start a new measurement. `Esc`, or Measure again, clears it. On the still frame the control is greyed and says why.

![A 2.20 m measurement across the workshop floor. The line has a mark at each end and the distance at the midpoint](docs/measure-after.png)

The number is approximate. These worlds are generated from a photo, not surveyed. The viewer treats one world unit as one metre — the same assumption Walk uses, where the workshop is about 12 m deep and its back wall sits near z = −12.3. That scale is one constant, `SPLAT_METRES_PER_UNIT` in `lib/measure.ts`.

The point is the splat under the cursor. PlayCanvas depth-picks the gaussian the renderer shows at that pixel, from a buffer capped at 512 pixels on the long edge so the extra draw stays a click. Where that read finds no surface, the click uses the nearest splat centre within a few pixels of the cursor. Neither is a mesh, so an edge or a thin part can sit a few centimetres off. While Measure is on, callouts do not take the click, selection stays as it was, and the idle tour stays off so the camera holds still. A drag still looks around, and Walk still walks.

When the second point lands, the tape extends from the first and the metres label at the midpoint counts up to the distance (~600 ms, ease-out). The status chip counts with it; a screen reader hears the finished distance at once. Reduced motion shows the finished tape at once.

## Design decisions

1. **Start from the plant, not the viewer.** The engineer's question is "where", and the answer has two precisions: in world, or inventory only. Both are shown; neither pretends to be the other.
2. **Not scanned is a state, not an absence.** Four rooms say so, and say what scanning would give them.
3. **Low confidence is a state, not a hidden number.** An object with too few votes says so and why.
4. **The part layer is additive.** Everything works without a part attached; nothing in the world layer depends on it.
5. **Equipment and parts are two levels.** The world segments equipment (pump P-104, cabinet CAB-01); parts are records that are *installed in* equipment or *stored in* a bin, rack or spot. Search answers both.
6. **All values from `lib/data.ts`.** Rooms, equipment, parts, inventory rows, timings. No real brands, no real part numbers.

## How this maps to segment-3gs

Honest split: what here mirrors the real pipeline, what is mocked, and what the parts layer would need from it.

**What is real here and what is mocked**

| world-parts | segment-3gs | Here |
|---|---|---|
| Room scene | PlayCanvas viewer on a `.ply` splat exported from SpAItial | **Still frame** of a SpAItial world (Echo-2, image to world) by default; **Live 3D** renders the same world's SOG export with PlayCanvas |
| Camera to object | — (orbit only) | Hand-placed camera pose per object. Orbit flies to it. Walk stays at eye height, faces it, and cannot leave the room |
| Object highlight in 3D | Per-splat masks from the lifted segmentation | Still-frame masks lifted onto the splats: project each splat with the still's camera, keep the ones in the mask and the object's depth band. Tint in a PlayCanvas `setWorkBufferModifier`, re-run only when the focus changes |
| Concept input, "needs a concept" | `POST /segment` with `prompts.text`, one concept per call | Mocked: no server call, results come from `lib/data.ts` |
| Server pill `mock · mobile_sam · sam3` | `GET /health` and the model tiers | Mocked, including "simulate unreachable" |
| Object states `lifted · low confidence · failed` | `liftMask` plus per-Gaussian voting in `SegmentationRegistry` | Mocked; `VOTE_THRESHOLD = 4` mirrors the idea that one view is not enough |
| `splats`, `views`, `votes` on the object card | `splatIndices`, `sourceViews`, vote counts | Hand-written numbers |
| Gaussian view `Highlight · Recolor · Isolate` | `SelectionViz` and `GsplatRecolor` | 2D overlay on the still frame |
| Object outline and framing | Point-cloud highlight and camera focus | Hand-placed polygons in `lib/data.ts` |
| **Parts layer**: equipment, parts, bins, `in world` vs `inventory only` | Not in segment-3gs | **New here.** This is the design question of the repo |

**The join.** A segmented object can carry an `assetId`. That id links it to an equipment record, and parts are records *installed in* equipment or *stored in* a bin. The world layer never depends on the parts layer.

**What the parts layer would need from the pipeline**

1. **Stable object ids.** Today objects are merged by label and overlap, and they live in one browser's `localStorage` (`segmentation.objects.v2`). Parts data needs an id that survives re-segmentation, a vote merge and a reload on another machine.
2. **A place for metadata on the object.** Either a free `metadata` field on the stored object, or an external key such as `assetId` that the registry carries through merges.
3. **Server-side persistence per world.** The same world should open with the same objects for everyone on the team, not only in one browser.
4. **A focus API.** Given an object id: its bounds and a camera pose to frame it. That is what "find the part" needs in 3D: walk into the room and land on the pump.
5. **Confidence as data.** `votes` and the score next to the object, so the UI can say "low confidence" instead of hiding it.

## Deliberately not built

Real segmentation · true 3D masks: Live 3D lifts the still's 2D masks, so only what the still saw is highlighted · batch sweep · parts search beyond the 13 demo records · real harmonization or similarity: aliases and matches are hand-written demo data · procurement, suppliers, ordering · auth · persistence beyond this browser.

## Next

- The batch sweep as an honest wait: cost before start, progress, cancel that keeps results.

## Running the live world

The world file is `public/splats/workshop.sog` (24 MB), committed so the live site can load it. It was generated on SpAItial's free plan, whose terms allow personal, non-commercial use; it is published here as part of a non-commercial portfolio prototype. To use another world, point `NEXT_PUBLIC_SPLAT_URL` at it.

```bash
pnpm install
pnpm dev
```

Open `/?room=workshop` and switch to **Live 3D**. If the file can't load, Live 3D says so and offers the still frame. Add `?present=1` (for example `/?room=workshop&present=1`) to run the idle tour even when the system prefers reduced motion. The tab remembers it, because later navigation keeps only the route's own parameters.

### Streamed level of detail (spike, `?splat=lod`)

Each room also has a level-of-detail version: four levels (100 / 50 / 20 / 5 %) built with `splat-transform` as SOG v2, plus a `lod-meta.json` and per-object `stats.json`. The coarsest level (1.3 MB) shows first, and the rest streams in as the camera needs it.

The folders are about 42 MB per room, so they are not in Git. They live in a public Vercel Blob store, and `NEXT_PUBLIC_SPLAT_LOD_BASE` points at it. Without that variable, the app reads them from `public/splats/<room>-lod/` on your machine.

```bash
vercel env pull .env.local                                # BLOB_READ_WRITE_TOKEN
node --env-file=.env.local scripts/upload-lod.mjs          # all rooms, or name one
```

## How it was built

v0 for the first version, then one review round per commit. `AGENT_LOG.md` lists every round: what the agent produced, what it got wrong, what I changed by hand.

## Stack

Next.js · TypeScript · Tailwind · shadcn/ui · PlayCanvas (live world, loaded on demand). No backend. Code: MIT. The SpAItial world and its still frame are not covered by the MIT licence.

## Credits

[risenW/segment-3gs](https://github.com/risenW/segment-3gs) for the pipeline, the vocabulary and the honest README this builds on. [SpAItial](https://spaitial.ai) for the worlds — the workshop scene was generated in SpAItial (Echo-2, image to world) from an AI-generated reference photo. Floor plan: AI-generated reference. The Live 3D product callouts take their idea — a dot on the surface, a leader, a label on the open side — from [willeastcott/splat-fashion](https://github.com/willeastcott/splat-fashion) `src/callouts.js` (MIT). The layout and the parts fields here are written for this app. The idle tour takes its idea from the same project's `src/director.js` (MIT): a camera that presents each subject until someone touches the page. The tour in this repo is a separate state machine (`lib/tour.ts`) played with the existing `flyTo` ease; it does not include that project's code. Measure takes the idea of a two-point distance with a midpoint label from [reall3d-com/Reall3dViewer](https://github.com/reall3d-com/Reall3dViewer) (MIT). The tape, the depth pick and the splat-centre fallback in this repo are written here and do not include that project's code.
