/**
 * Single source of mock data for world-parts.
 * The 3D pipeline (SAM3 → lift to splats) is mocked; everything the UI shows comes from here.
 */

export type Point = [x: number, y: number]

export type ObjectStatus = "queued" | "segmenting" | "lifted" | "low_confidence" | "failed"

export type ServerTierId = "mock" | "mobile_sam" | "sam3"

export type GaussianView = "highlight" | "recolor" | "isolate"

export interface WorldObject {
  id: string
  name: string
  concept: string
  colorIndex: number
  splats: number | null
  views: number
  votes: number
  status: ObjectStatus
  failReason?: string
  firstSegmentedAt: string | null
  polygon: Point[] | null
  startedAt?: number
}

export interface ServerTier {
  id: ServerTierId
  label: string
  secondsPerCall: number
  latencyHint: string
  description: string
}

/** Scene coordinate space. Polygons are authored in this box and scaled like object-fit: cover. */
export const SCENE = {
  imageSrc: "/scene.jpg",
  width: 2048,
  height: 1152,
  alt: "Still frame of a factory workshop interior",
} as const

export const TIMING = {
  /** UI mock: how long one view takes to segment. */
  segmentMsPerView: 2500,
  /** Batch sweep covers this many views. */
  sweepViews: 16,
  /** Simulated server health check on load. */
  serverCheckMs: 700,
} as const

/** Below this many agreeing views (votes), a lifted object is marked low confidence. */
export const VOTE_THRESHOLD = 4

export const SERVER_TIERS: ServerTier[] = [
  { id: "mock", label: "mock", secondsPerCall: 0.2, latencyHint: "instant", description: "Fake masks, no model" },
  {
    id: "mobile_sam",
    label: "mobile_sam",
    secondsPerCall: 1.5,
    latencyHint: "~1.5 s per call",
    description: "Fast, coarse masks",
  },
  {
    id: "sam3",
    label: "sam3",
    secondsPerCall: 13,
    latencyHint: "~13 s per call",
    description: "Concept prompts, best masks",
  },
]

export const DEFAULT_SERVER_TIER: ServerTierId = "sam3"

/** One palette for every object colour. Index into it with WorldObject.colorIndex. */
export const OBJECT_PALETTE = [
  "#ff6b4a",
  "#ffc53d",
  "#3fd6c3",
  "#a594ff",
  "#ff7ac6",
  "#8fdc5c",
  "#4aa8ff",
  "#ffa04a",
] as const

export const SUGGESTED_CONCEPTS = ["pump", "valve", "motor", "pallet", "cabinet", "hose"] as const

/** Inputs that ask for "everything" instead of a concept. SAM3 needs a concept. */
export const UNSUPPORTED_CONCEPTS = [
  "everything",
  "all",
  "*",
  "anything",
  "objects",
  "all objects",
  "segment everything",
  "stuff",
  "things",
]

export const COPY = {
  panelTitle: "SAM3 · lift to 3D",
  conceptLabel: "Concept",
  conceptPlaceholder: "Segment a concept (e.g. pump, valve, pallet)",
  conceptLimit: "Needs a concept — 'segment everything' isn't supported.",
  segmentButton: "Segment view",
  storageNote: "Segmented objects are saved in this browser",
  storageBlocked: "Storage is blocked — objects will be lost on reload",
  scenePlaceholder: "Scene still not found — drop scene.jpg into /public",
  emptyTitle: "No objects in this world yet",
  emptyBody: "Type a concept above and press G to segment the current view.",
  gaussianDisabled: "Select an object to apply a Gaussian view.",
} as const

export const GAUSSIAN_VIEWS: { id: GaussianView; label: string; key: string; description: string }[] = [
  { id: "highlight", label: "Highlight", key: "1", description: "Outline the selection, keep the rest." },
  { id: "recolor", label: "Recolor + dim rest", key: "2", description: "Fill the selection, dim everything else." },
  { id: "isolate", label: "Isolate", key: "3", description: "Show only the selected splats." },
]

export const LAYOUT = {
  /** Bottom-sheet snap heights under 900 px, as a fraction of viewport height. */
  sheetSnaps: [0.3, 0.56, 0.86],
  sheetSnapLabels: ["peek", "half", "full"],
  sheetDefaultSnap: 1,
  /** Zoom range used when framing an object in the still. */
  frameMinScale: 1.25,
  frameMaxScale: 2.4,
} as const

export const STORAGE_KEYS = {
  objects: "world-parts.objects.v2",
  selection: "world-parts.selection.v1",
  concepts: "world-parts.concepts.v1",
} as const

/** Seed world: what a returning user would have after an earlier batch sweep. */
export const SEED_OBJECTS: WorldObject[] = [
  {
    id: "obj-pump",
    name: "pump",
    concept: "pump",
    colorIndex: 0,
    splats: 18_420,
    views: 14,
    votes: 12,
    status: "lifted",
    firstSegmentedAt: "2026-11-04T09:12:00.000Z",
    polygon: [
      [790, 660], [830, 632], [880, 640], [925, 655], [960, 672], [968, 710], [945, 748], [870, 752], [800, 745], [785, 705],
    ],
  },
  {
    id: "obj-valve",
    name: "valve",
    concept: "valve",
    colorIndex: 1,
    splats: 3_960,
    views: 11,
    votes: 9,
    status: "lifted",
    firstSegmentedAt: "2026-11-04T09:14:30.000Z",
    polygon: [[1458, 345], [1520, 335], [1590, 325], [1590, 370], [1572, 440], [1500, 445], [1458, 440], [1455, 395]],
  },
  {
    id: "obj-motor",
    name: "motor",
    concept: "motor",
    colorIndex: 2,
    splats: 9_115,
    views: 9,
    votes: 3,
    status: "low_confidence",
    firstSegmentedAt: "2026-11-04T09:18:10.000Z",
    polygon: [[1330, 600], [1360, 578], [1395, 600], [1440, 640], [1462, 690], [1468, 770], [1380, 787], [1278, 745], [1285, 680]],
  },
  {
    id: "obj-pallet",
    name: "pallet",
    concept: "pallet",
    colorIndex: 3,
    splats: 22_780,
    views: 6,
    votes: 2,
    status: "low_confidence",
    firstSegmentedAt: "2026-11-04T09:21:45.000Z",
    polygon: [
      [1488, 660], [1625, 648], [1698, 668], [1695, 700], [1600, 750], [1610, 880], [1890, 925], [1885, 990], [1745, 1045], [1462, 872],
    ],
  },
  {
    id: "obj-cabinet",
    name: "cabinet",
    concept: "cabinet",
    colorIndex: 4,
    splats: null,
    views: 0,
    votes: 0,
    status: "failed",
    failReason: "sam3 timed out on view 4 (30 s limit) — no mask returned",
    firstSegmentedAt: null,
    polygon: null,
  },
  {
    id: "obj-extinguisher",
    name: "extinguisher",
    concept: "extinguisher",
    colorIndex: 5,
    splats: 2_310,
    views: 8,
    votes: 7,
    status: "lifted",
    firstSegmentedAt: "2026-11-04T09:25:05.000Z",
    polygon: [[480, 428], [487, 418], [494, 428], [497, 445], [496, 490], [478, 491], [476, 445]],
  },
]

/**
 * What the mocked SAM3 "finds" for a concept in the current view.
 * Any concept not listed here fails with a "no mask" reason.
 */
export const MOCK_DETECTIONS: Record<string, { splats: number; views: number; votes: number; polygon: Point[] }> = {
  cabinet: {
    splats: 31_400,
    views: 10,
    votes: 8,
    polygon: [[92, 240], [205, 240], [290, 285], [360, 310], [470, 312], [485, 740], [385, 835], [322, 870], [245, 950], [135, 925]],
  },
  hose: {
    splats: 4_870,
    views: 7,
    votes: 5,
    polygon: [[1580, 330], [1640, 285], [1705, 290], [1760, 252], [1880, 245], [1925, 300], [1915, 430], [1840, 475], [1700, 465], [1580, 450]],
  },
  drum: { splats: 7_230, views: 5, votes: 3, polygon: [[1510, 672], [1651, 666], [1664, 896], [1517, 902]] },
  ladder: { splats: 5_120, views: 9, votes: 8, polygon: [[1331, 230], [1395, 224], [1453, 666], [1389, 672]] },
  workbench: { splats: 26_900, views: 12, votes: 11, polygon: [[717, 666], [1024, 646], [1043, 717], [736, 740]] },
}

export const MOCK_NO_MASK_REASON = (concept: string) => `No mask above threshold for "${concept}" in this view`
