# world-parts — project passport

world-parts is a design prototype: find a spare part in a 3D scan of a plant, not in a spreadsheet. Live at [world-parts.vercel.app](https://world-parts.vercel.app).

Prototype only. The segmentation is mocked. Not affiliated with SpAItial. The long description, the screens, and the design decisions are in the [README](../README.md). This file is the short map, and the part that has to stay true when behaviour changes.

## Who it is for

A maintenance engineer who has a part number, or a name from an invoice, and needs to know which room has it and whether the scan can show the exact machine or bin. Some rooms are scanned. Some are inventory only. The interface says which is which.

## Status

Shipped on `main` and on the live site:

- Parts list, plant plan, and four scanned rooms (workshop, storeroom, production hall, corridor) plus two rooms that are not scanned yet.
- Search by name or part number. A hit in a scanned room opens that object with its card. A hit elsewhere stays on the plan.
- Split view: the parts table and the live room side by side, selection in the URL (`?view=split&part=`).
- Live 3D on PlayCanvas (SOG). Still frame is the default and the fallback. Orbit and Walk. An idle tour when nothing is framed. Measure draws a tape between two points. In Walk, a floor path runs to the selected part.
- Object callouts in Live 3D. The still frame keeps the pill labels.
- State in the URL (`room`, `object`, `part`, `q`, `view`, `pin`) so a link opens the same place.
- **Copy view.** In Live 3D, the view pill has a link button. It copies a URL with the current camera and the selected object. Opening that link switches to Live 3D and eases the camera into that view. The button shows **Copied** for a moment. On the still frame the button is greyed and says why. Reduced motion jumps instead of easing.

## Copy view link

The button reads the live camera and writes it into the query as `cam`.

`cam` is six numbers, position then target, two decimals: `px,py,pz,tx,ty,tz`. Position is where the camera stands. Target is where it looks. In Orbit that target is the focus point, so the zoom survives. In Walk the focus is stale, so the target is a point along the view.

The selected object is the open card, or the framed object, or the only selected row. It is the existing `object` parameter (the concept when that name is unique in the room, otherwise the id). A part and a search string stay on the link when they still belong to that object.

Example shape: `/?room=workshop&object=pump&cam=0.00,1.60,-2.00,0.00,1.20,-6.00`

A `cam` that is not six finite numbers, that sits farther than 80 units from the origin, or that looks nowhere, is ignored. The room still opens.

The camera eases with the same flight Find uses. The idle tour stays off while `cam` is set, so it does not pull the view away. Choosing a different object drops `cam`, and the camera flies to that object as usual. Share room link, in the More menu, still copies whatever is in the address bar.

Code: `lib/view-link.ts` parses and formats `cam`. The room route in `hooks/use-hash-route.ts` carries it. `components/world/view-pill.tsx` is the button. `components/world/splat-view.tsx` flies there once the world is ready.

## Known gaps

- [Section cut](https://github.com/sergushkincom/world-parts/issues/34) — a plane that hides everything in front of a chosen depth. Not built.
- The batch sweep, as the README describes it: cost before start, progress, cancel that keeps results.
- Copy view does not remember Walk versus Orbit. The link restores the position and the look direction in Orbit, which is enough for the picture. It does not restore a measurement or the idle tour.
- The find-a-part Playwright spec does not open Live 3D. Headless Chromium has no WebGL, so the camera flight is covered by the `cam` unit tests, not by that spec.

Deliberately absent, as the README records: real segmentation, true 3D masks, search beyond the demo records, procurement, auth, and persistence beyond this browser.

## How to run

```bash
pnpm install
pnpm dev
```

Open `/?room=workshop`, switch to Live 3D, move the camera, and use **Copy view link**. Paste the link in a new tab. The world loads at the door, then the camera eases to the saved view.

Node 22. pnpm. Checks:

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run test:e2e
```

CI is `.github/workflows/ci.yml`.

## Rules

- MIT for the code (`LICENSE`). The world files and stills are not under that licence.
- No real brands, no real part numbers. Data in `lib/data.ts`.
- One change per pull request. The owner merges.
