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
  /** Plant ↔ room zoom-and-fade. */
  roomTransitionMs: 300,
  roomCrossfadeMs: 150,
  roomTransitionEasing: "cubic-bezier(0.2, 0, 0, 1)",
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
  conceptLabel: "Find a part or object",
  conceptPlaceholder: "Find a part or object — name or part number",
  searchHintRoom: "Enter opens a match · no match segments the term in this view.",
  noResults: (q: string) => `No part called '${q}' — try a name or a part number`,
  notScannedNote: "Not scanned yet — scan this room to locate parts in 3D",
  scanRoomTooltip: "needs a capture",
  backToPlant: "Plant",
  scanForMore: "Scan room for more objects…",
  noPartLinked: "No part linked yet — link one",
  openInPartsSystem: "Open in parts system ↗",
  conceptLimit: "Needs a concept — 'segment everything' isn't supported.",
  segmentButton: "Segment view",
  storageNote: "Segmented objects are saved in this browser",
  storageBlocked: "Storage is blocked — objects will be lost on reload",
  scenePlaceholder: "Scene still not found — drop scene.jpg into /public",
  emptyTitle: "No objects in this world yet",
  emptyBody: "Type a concept above and press G to segment the current view.",
  gaussianDisabled: "Select an object to apply a Gaussian view.",
} as const

export const GAUSSIAN_VIEWS: { id: GaussianView; label: string; fullLabel: string; key: string; description: string }[] = [
  { id: "highlight", label: "Highlight", fullLabel: "Highlight", key: "1", description: "Outline the selection, keep the rest." },
  {
    id: "recolor",
    label: "Recolor + dim",
    fullLabel: "Recolor + dim rest",
    key: "2",
    description: "Fill the selection, dim everything else.",
  },
  { id: "isolate", label: "Isolate", fullLabel: "Isolate", key: "3", description: "Show only the selected splats." },
]

export const LAYOUT = {
  /** Bottom-sheet snap heights under 900 px, as a fraction of viewport height. */
  /** "half" is sized so a 375 × 667 phone shows the first 3 object rows without scrolling the sheet. */
  sheetSnaps: [0.3, 0.62, 0.86],
  sheetSnapLabels: ["peek", "half", "full"],
  sheetDefaultSnap: 1,
  /** Zoom range used when framing an object in the still. */
  frameMinScale: 1.25,
  frameMaxScale: 2.4,
} as const

export const STORAGE_KEYS = {
  objects: "world-parts.objects.v3",
  partLinks: "world-parts.part-links.v1",
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
  {
    id: "obj-hose",
    name: "hose",
    concept: "hose",
    colorIndex: 6,
    splats: 4_870,
    views: 7,
    votes: 5,
    status: "lifted",
    firstSegmentedAt: "2026-11-04T09:27:40.000Z",
    polygon: [[1600, 330], [1640, 285], [1705, 290], [1760, 252], [1880, 245], [1925, 300], [1915, 430], [1840, 475], [1700, 465], [1600, 452]],
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

/* ------------------------------------------------------------------ */
/* Plant overview (Level 1): floor plan, rooms, parts, inventory.     */
/* ------------------------------------------------------------------ */

export type RoomId = "production" | "workshop" | "storeroom" | "office" | "loading"

export interface Room {
  id: RoomId
  name: string
  scanned: boolean
  /** Zone outline in floor-plan pixel space (PLAN.width × PLAN.height). */
  polygon: Point[]
  /** Where the label and search pin sit, in plan space. */
  anchor: Point
}

export const PLAN = {
  imageSrc: "/floor-plan.png",
  width: 1672,
  height: 941,
  maxWidth: 1280,
  /** Below this the plan keeps its width and scrolls horizontally inside its container. */
  minWidth: 720,
  minimapWidth: 180,
  alt: "Floor plan of the plant: production hall, workshop, storeroom, office and loading bay",
  /** Where the capture camera stood in the scanned room — the dot on the minimap. */
  camera: [1120, 392] as Point,
} as const

export const ROOMS: Room[] = [
  {
    id: "production",
    name: "Production hall",
    scanned: false,
    polygon: [[40, 135], [845, 135], [845, 760], [40, 760]],
    anchor: [442, 447],
  },
  {
    id: "workshop",
    name: "Workshop",
    scanned: true,
    polygon: [[860, 135], [1210, 135], [1210, 425], [860, 425]],
    anchor: [1035, 330],
  },
  {
    id: "storeroom",
    name: "Storeroom",
    scanned: false,
    polygon: [[1225, 135], [1635, 135], [1635, 425], [1225, 425]],
    anchor: [1430, 345],
  },
  {
    id: "office",
    name: "Office",
    scanned: false,
    polygon: [[860, 545], [1175, 545], [1175, 760], [860, 760]],
    anchor: [1017, 590],
  },
  {
    id: "loading",
    name: "Loading bay",
    scanned: false,
    polygon: [[1190, 545], [1635, 545], [1635, 760], [1535, 760], [1535, 815], [1380, 815], [1380, 760], [1190, 760]],
    anchor: [1300, 600],
  },
]

/** The room that holds the 3D world from round 1. */
export const WORLD_ROOM: RoomId = "workshop"

export interface SimilarPart {
  number: string
  reason: string
}

export interface Part {
  number: string
  name: string
  description: string
  /** Extra words that should find this part. */
  keywords: string[]
  supplier: string
  unitPrice: number
  /** ISO date; only set when the part hasn't been used recently. */
  idleSince: string | null
  similar: [SimilarPart, SimilarPart]
}

export const CURRENCY = { code: "EUR", locale: "en-GB" } as const

export const PARTS: Part[] = [
  {
    number: "PMP-2041",
    name: "Centrifugal pump 2.2 kW",
    description: "End-suction coolant pump, cast iron, DN40 flange",
    keywords: ["pump", "coolant"],
    supplier: "Grundfos via Hahn Industrie",
    unitPrice: 1240,
    idleSince: null,
    similar: [
      { number: "PMP-2045", reason: "same flange, stainless housing" },
      { number: "PMP-1980", reason: "older model, 0.4 kW less" },
    ],
  },
  {
    number: "PMP-2045",
    name: "Centrifugal pump 2.2 kW, stainless",
    description: "Stainless variant of PMP-2041 for aggressive coolants",
    keywords: ["pump", "coolant", "stainless"],
    supplier: "Grundfos via Hahn Industrie",
    unitPrice: 1690,
    idleSince: "2026-06-02",
    similar: [
      { number: "PMP-2041", reason: "same flange, cast iron housing" },
      { number: "PMP-1980", reason: "older model, lower flow" },
    ],
  },
  {
    number: "PMP-1980",
    name: "Centrifugal pump 1.8 kW",
    description: "Previous coolant pump generation, kept as a fallback",
    keywords: ["pump"],
    supplier: "Hahn Industrie",
    unitPrice: 880,
    idleSince: "2025-12-15",
    similar: [
      { number: "PMP-2041", reason: "current model, same footprint" },
      { number: "PMP-2045", reason: "current stainless model" },
    ],
  },
  {
    number: "VLV-1180",
    name: "Ball valve DN25",
    description: "Brass ball valve, lever handle, PN40",
    keywords: ["valve", "ball valve"],
    supplier: "Würth",
    unitPrice: 46,
    idleSince: null,
    similar: [
      { number: "VLV-1182", reason: "same thread, different seal" },
      { number: "VLV-1150", reason: "same body, DN20" },
    ],
  },
  {
    number: "VLV-1182",
    name: "Ball valve DN25, FKM seal",
    description: "VLV-1180 with FKM seals for oil lines",
    keywords: ["valve", "ball valve"],
    supplier: "Würth",
    unitPrice: 58,
    idleSince: "2026-08-20",
    similar: [
      { number: "VLV-1180", reason: "same thread, PTFE seal" },
      { number: "VLV-1150", reason: "same seal family, DN20" },
    ],
  },
  {
    number: "VLV-1150",
    name: "Ball valve DN20",
    description: "Brass ball valve, lever handle, PN40",
    keywords: ["valve"],
    supplier: "Würth",
    unitPrice: 38,
    idleSince: null,
    similar: [
      { number: "VLV-1180", reason: "one size up, DN25" },
      { number: "VLV-1182", reason: "DN25 with FKM seal" },
    ],
  },
  {
    number: "MTR-3300",
    name: "Induction motor 4 kW",
    description: "IE3 three-phase motor, B3 foot mount, 1450 rpm",
    keywords: ["motor", "drive"],
    supplier: "Siemens via Rexel",
    unitPrice: 610,
    idleSince: null,
    similar: [
      { number: "MTR-3310", reason: "same frame, flange mount" },
      { number: "MTR-3290", reason: "3 kW, same shaft" },
    ],
  },
  {
    number: "MTR-3310",
    name: "Induction motor 4 kW, flange",
    description: "MTR-3300 with B5 flange mount",
    keywords: ["motor", "drive"],
    supplier: "Siemens via Rexel",
    unitPrice: 655,
    idleSince: null,
    similar: [
      { number: "MTR-3300", reason: "same frame, foot mount" },
      { number: "MTR-3290", reason: "3 kW, same shaft" },
    ],
  },
  {
    number: "EXT-0600",
    name: "CO₂ extinguisher 5 kg",
    description: "Class B fire extinguisher, wall bracket included",
    keywords: ["extinguisher", "fire"],
    supplier: "Gloria",
    unitPrice: 129,
    idleSince: null,
    similar: [
      { number: "EXT-0610", reason: "6 kg foam, covers class A too" },
      { number: "EXT-0590", reason: "2 kg CO₂ for small rooms" },
    ],
  },
  {
    number: "HSE-0450",
    name: "Hydraulic hose 1/2″, 2 m",
    description: "2SN hose assembly, JIC fittings both ends",
    keywords: ["hose", "hydraulic"],
    supplier: "Parker via Hansa-Flex",
    unitPrice: 74,
    idleSince: null,
    similar: [
      { number: "HSE-0455", reason: "same fittings, 3 m" },
      { number: "HSE-0440", reason: "3/8″ hose, same length" },
    ],
  },
  {
    number: "CAB-0920",
    name: "Tool cabinet, 6 drawers",
    description: "Steel workshop cabinet, lockable, 120 kg drawer load",
    keywords: ["cabinet", "drawer"],
    supplier: "Bott",
    unitPrice: 890,
    idleSince: "2026-03-11",
    similar: [
      { number: "CAB-0925", reason: "same body, 8 drawers" },
      { number: "CAB-0900", reason: "half height, 4 drawers" },
    ],
  },
  {
    number: "PLT-1200",
    name: "Euro pallet 1200 × 800",
    description: "EPAL wooden pallet, 1500 kg load",
    keywords: ["pallet"],
    supplier: "Palettenwerk",
    unitPrice: 14,
    idleSince: null,
    similar: [
      { number: "PLT-1210", reason: "plastic, same footprint" },
      { number: "PLT-1000", reason: "industrial 1200 × 1000" },
    ],
  },
]

/** Which part a segmented object is, keyed by object concept. Missing = no part linked yet. */
export const OBJECT_PART_LINKS: Record<string, { partNumber: string; location: string }> = {
  pump: { partNumber: "PMP-2041", location: "Workbench, front left" },
  valve: { partNumber: "VLV-1180", location: "Wall manifold, right of the door" },
  motor: { partNumber: "MTR-3300", location: "Floor, next to the pallet stack" },
  extinguisher: { partNumber: "EXT-0600", location: "Left wall bracket" },
  hose: { partNumber: "HSE-0450", location: "Hose reel, back right wall" },
  cabinet: { partNumber: "CAB-0920", location: "Left wall" },
}

/** The tiny mocked part picker offers these five. */
export const LINK_PICKER_PARTS = ["PLT-1200", "CAB-0920", "PMP-2045", "VLV-1182", "MTR-3310"] as const

export const DEFAULT_LINK_LOCATION = "Location not set"

export interface InventoryRow {
  partNumber: string
  roomId: RoomId
  qty: number
  note: string
}

/** Stock by room. Sum of qty is the "parts in inventory" count on the plan. */
export const INVENTORY: InventoryRow[] = [
  { partNumber: "PMP-2041", roomId: "workshop", qty: 1, note: "workbench" },
  { partNumber: "PMP-2041", roomId: "storeroom", qty: 3, note: "rack B3, last counted 14 Oct" },
  { partNumber: "PMP-2041", roomId: "production", qty: 1, note: "line 2, machine 4" },
  { partNumber: "PMP-2045", roomId: "storeroom", qty: 2, note: "rack B3, last counted 14 Oct" },
  { partNumber: "VLV-1180", roomId: "workshop", qty: 4, note: "wall manifold" },
  { partNumber: "VLV-1180", roomId: "storeroom", qty: 6, note: "rack A1, last counted 14 Oct" },
  { partNumber: "VLV-1182", roomId: "storeroom", qty: 3, note: "rack A1, last counted 14 Oct" },
  { partNumber: "MTR-3300", roomId: "workshop", qty: 2, note: "floor" },
  { partNumber: "MTR-3300", roomId: "loading", qty: 1, note: "door 2, inbound 3 Nov" },
  { partNumber: "MTR-3310", roomId: "production", qty: 1, note: "line 1, machine 2" },
  { partNumber: "EXT-0600", roomId: "workshop", qty: 1, note: "left wall" },
  { partNumber: "EXT-0600", roomId: "production", qty: 4, note: "east wall, next to line 1" },
  { partNumber: "EXT-0600", roomId: "office", qty: 1, note: "by the door" },
  { partNumber: "HSE-0450", roomId: "workshop", qty: 2, note: "hose reel" },
  { partNumber: "HSE-0450", roomId: "storeroom", qty: 5, note: "rack C2, last counted 14 Oct" },
  { partNumber: "CAB-0920", roomId: "workshop", qty: 2, note: "left wall" },
  { partNumber: "PLT-1200", roomId: "loading", qty: 3, note: "staging lane A" },
]

export const PLANT_STATS = {
  roomsScanned: ROOMS.filter((r) => r.scanned).length,
  roomsTotal: ROOMS.length,
  partsInInventory: INVENTORY.reduce((sum, row) => sum + row.qty, 0),
} as const

/** Minimum characters before the search runs. */
export const SEARCH_MIN_CHARS = 2
