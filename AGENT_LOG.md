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
