# Agent log — world-parts

One entry per round. What I asked, what the agent did, what it got wrong, what I changed by hand. Commits: `agent:` = the agent's version, `fix:` = my correction.

Format:

```
## Round N — <theme>  (<date>)
Prompt: <one line>
Agent did: <what shipped>
Wrong: <what it got wrong, or "nothing found">
Fixed: <what I changed and why>  → commit <hash>
Not checked by the agent: <what it said it did not verify>
```

---

## Round 1 — layout, panel, mocked object list  (2026-11-06)
Prompt: full brief (scene + panel + object list; stop before sweep and card). Branch `v0/layout-panel-object-list`, +6,038 lines, 16 min.
Agent did: SVG overlay on `/public/scene.jpg` with a grid fallback; panel with server pill (mock / mobile_sam / sam3 + "simulate unreachable"), concept input with the "needs a concept" line and 6 chips, object list (7 objects: 2 low confidence with votes tooltip, 1 failed with reason + Retry), multi-select (checkbox, Shift range, ⌘-toggle, select all), row actions frame / rename (F2) / remove, Gaussian view as a 3-way segmented control, footer with storage note + Clear all (confirm step). Collapses to a 48 px rail; bottom sheet under 900 px with three snap heights. Keyboard G / Esc / ↑↓ / Space / 1-2-3. localStorage with empty and "storage blocked" states.
Wrong (found and fixed by the agent itself):
- Custom text sizes in `globals.css` pointed at themselves, so they did nothing.
- `cn()` treated those sizes as text colours and dropped them → hint and meta text too large.
- On mobile the Gaussian view + footer were pinned to the bottom of the sheet and hid the list; now pinned on desktop only.
Wrong (left for me):
- Low-confidence rows cut off "· N votes" at 360 px.
- "Recolor + dim rest" wraps onto two lines in the segmented control.
- At the default sheet height on 375 px the list is below the fold — you scroll the sheet to reach it.
Fixed: — (carried into round 2 as the first three items)
Not checked by the agent: light mode · sheet drag on a real touch device · screen reader · reduced motion with the OS setting on · the full segment run (queued → segmenting → lifted, and the failure path) · outlines against the real `scene.jpg` (polygons are hand-placed in `lib/data.ts`) · rename, remove and Clear all in the browser.
My check: desktop ok · 375 px ok · what I saw: all three "left for me" items confirmed; hover/select/Frame work; scene grid shown because scene.jpg is not in /public yet.

## Round 2 — plant overview, search, room transition  (2026-11-06)
Prompt: "Find a part" flow — plant floor plan with room zones and statuses, search by name or part number, results grouped by room (`in world` / `inventory only`), transition into the room with the object framed and the Part tab open, minimap, hash routing. Plus the three round-1 fixes. Same branch `v0/layout-panel-object-list`.
Agent did: floor plan inverted for dark theme with five room zones and status pins; search with grouped results; room entry framing the searched object; object card with Object / Part tabs; minimap; URL state; three round-1 fixes (votes cut-off, "Recolor + dim" label, sheet height).
Wrong (found by me in the browser):
- Clicking a room threw `querySelector '#room=workshop' is not a valid selector` — the hash router passed the hash to a selector. Agent moved routing to the query string (`?room=workshop&object=pump&q=pump`), old `#` links rewritten on load.
- Room transition was a hard cut. Agent added a 300 ms zoom-and-fade; the first version zoomed into black because the leaving view vanished at once — fixed by keeping a snapshot of the plan fading over the first 150 ms.
- Office and Loading bay pins showed only "not scanned" without the room name (desktop too) — names were hidden until hover. Fixed: always visible.
- Real brand in the data (pump supplier "Grundfos via Hahn Industrie"). Fixed: Supplier A/B/C everywhere, repo grepped for brand names.
- Plan on 375 px scrolled sideways with no affordance and sat small in the middle. Fixed: fills the width, pinch-to-zoom, drag, double-tap reset, one-time hint, pins kept inside the viewport.
- Suggestion chips overflowed at 375 px ("cal…"). Fixed: scrollable row with an edge fade.
Fixed by hand: — (all fixes went through the agent; I reviewed each in the preview)
Not checked by the agent: real multi-touch on a phone (gestures simulated) · iOS Safari gesture handling · the plan → room transition after the pan/zoom layer (I checked it: works) · TypeScript typecheck (not installed in the sandbox).
My check: desktop ok · 375 px ok · what I saw: search "pump" → 4 results in 3 rooms → Workshop opens with the pump framed and the Part tab open; back to plan works; all room names visible.
Published: v0 Publish merged the branch into `main` and deployed world-parts.vercel.app.
Open: `scene.jpg` is 3.3 MB and `floor-plan.png` 1.1 MB — compress in round 3. README `docs/preview.png` missing — add a screenshot.

## Round 3 — parts list, two-level data, bins  (2026-11-06)
Prompt: parts table as the start screen; `lib/data.ts` rewritten into equipment (asset ids, cabinet with bins) and 12 parts with `installedIn` / `storedIn`; search results typed `stored` / `installed` / `inventory only`; room card tabs "Parts in this unit" and "Bins"; image compression first. Branch `v0/round-3-parts-list`, 5 commits, 20 min, +1,589 / −495.
Agent did: scene 3.3 MB → 231 KB, plan 1.1 MB → 222 KB (16-colour palette, checked); data model; parts list with sort, filters (All / Low stock / Idle / In world), status chips, detail drawer with stock by location, installed-in chips, similar parts; plan results grouped by room and kind; cabinet Bins tab with the searched bin highlighted; "Find spare" on equipment; Esc closes drawer → card → room. Found and fixed on its own: every location showed its quantity twice ("cabinet A1 (2) ×2").
Wrong (found by me in the browser):
- Leaving a room threw `Cannot read properties of undefined (reading 'name')` in RoomMinimap during the exit transition. Fixed with a guard; agent could not reproduce it from a real link (likely a mid-edit reload).
- Cabinet polygon sat on the left-edge door, got cropped on desktop, and Frame on it zoomed into black. Fixed: polygon moved to the grey cabinet at the back wall; Frame clamped to the image.
- Desktop scene was cropped by the panel (pallet, hose, valve hidden at 1280–1500 px). Fixed: scene fits the area left of the panel.
- Object card covered the framed object. Fixed: frame centre offset into the free area.
- Mobile labels collided (valve/hose, motor/pallet). Fixed: dots, name only for selected/hovered.
- Mobile top bar: search field shrank to ~130 px next to List · Plan; plan small again. Fixed: switch on its own row, plan fills the height.
- Counts disagreed ("69 parts in inventory" vs "12 of 12 parts"). Fixed: "12 parts · 69 units" everywhere.
- Filter "In this room" shown at plant level; impeller Location "—". Fixed: "In world" outside a room; "installed in pump P-104" for installed-only parts.
Fixed by hand: — (all through the agent; each checked in the preview)
Not checked by the agent: real touch device · a saved world's cabinet outline is overwritten by the built-in one on load (a hand-drawn cabinet outline would be replaced).
My check: desktop ok · 375 px ok · what I saw: list → drawer → "Workshop · cabinet B3" → room with Bins tab and B3 highlighted; Frame on cabinet no longer black. Open: the card still overlaps the back-wall cabinet at 1491 px; carry into round 4.
Published: v0 Publish merged PR #2 into `main`, deployed world-parts.vercel.app.
