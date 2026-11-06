# world-parts

**What does a 3D world become when you attach your own data to its objects?**

A design pass on the control panel of [risenW/segment-3gs](https://github.com/risenW/segment-3gs) — a Gaussian-splat segmentation playground built on [SpAItial](https://spaitial.ai) worlds, where you segment an object once and it lives in 3D from then on. The pipeline there is real. This repo is the surface around it, with the pipeline mocked.

Live: _(link)_ · Built in a day, prototype only. Not affiliated with SpAItial.

![preview](docs/preview.png)

## The question

`segment-3gs` says in its own README that it is "a starting point to fork, not a product". Two things keep it a demo:

1. **Segmentation is slow by design.** A batch sweep is 16 views × N concepts at ~13 s per call — a leave-it-running job. The UI needs to make that wait honest: cost before you start, progress you can read, results you can use before it's done, a cancel that keeps what it found.
2. **A segmented object knows its own geometry and nothing else.** For a real-estate visitor that's fine. For the other persona — a team that integrates worlds into their own product through the API — the object is only useful once their data hangs on it.

So the prototype does two things: makes segment-once-reuse-forever feel like a tool, and shows what one object looks like when a parts data source is attached to it (part number, stock, supplier, interchangeable parts). The scene is a factory interior because that's where the second question is sharpest.

## What's here

- **Scene** — a still frame of a workshop with segmented objects drawn as overlays with tracking labels. No camera, no 3D library; the frame stands in for the viewer.
- **Segmentation panel** — concept input (and what it can't do), batch sweep with live cost, progress, cancel and partial results, object list with explicit states (`queued · segmenting · lifted · low confidence · failed`), multi-select, Gaussian view as a three-way switch.
- **Object card** — "In this world" (geometry, votes, views) and "Part" (the attached record, with two similar parts and why).
- Desktop and 375 px, keyboard for everything that isn't the camera, reduced motion respected, light and dark.

Vocabulary is kept from the original project — concept, segment view, batch sweep, lift, views, votes, Gaussian view, isolate — so this can be read next to its code.

## Design decisions

1. **The wait is a first-class screen, not a spinner.** Cost line before start, "view 7 of 16 · pump" during, partial objects usable immediately, cancel keeps results.
2. **Low confidence is a state, not a hidden number.** An object with too few votes says so and says why, instead of silently looking wrong.
3. **Gaussian view is one switch.** Highlight / Recolor + dim / Isolate are modes of the selection, so they sit together and are disabled together.
4. **The part layer is additive.** Everything works without a part attached; the empty state invites the link. Nothing in the world layer depends on the parts layer.
5. **All values from `lib/data.ts`.** Objects, parts, server tiers, timings. Change one number, the whole flow follows.

## Deliberately not built

Real segmentation · the 3D viewer and camera · parts search · procurement flow · auth · multi-world · persistence beyond this browser.

## How it was built

v0 for the first version, then one review round per commit. Commits are `agent:` (what the agent produced) and `fix:` (what I changed by hand and why). `AGENT_LOG.md` lists every round, including what the agent got wrong.

## Stack

Next.js · TypeScript · Tailwind · shadcn/ui. No backend. MIT.

## Credits

[risenW/segment-3gs](https://github.com/risenW/segment-3gs) for the pipeline, the vocabulary and the honest README this builds on. [SpAItial](https://spaitial.ai) for the worlds. Scene image: _(source)_.
