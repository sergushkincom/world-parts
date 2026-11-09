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
  /** Set on registered equipment. */
  assetId?: string
  kind?: "equipment"
  room?: RoomId
  /** Only the parts cabinet has bins. */
  bins?: string[]
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

/**
 * Live 3D: the same SpAItial world as the still frame, exported as SOG.
 * Hosted outside git; NEXT_PUBLIC_SPLAT_URL points at it. Camera poses are measured by hand in the viewer.
 */
export const LIVE_WORLD = {
  src: process.env.NEXT_PUBLIC_SPLAT_URL ?? "/splats/workshop.sog",
  sizeLabel: "24 MB",
  /** SpAItial exports are already y-up; kept as a knob for other sources. */
  rotation: [0, 0, 0] as [number, number, number],
  home: { position: [0, 0, 0], target: [0, 0, -1] } as CameraPose,
  /** With the card open, turn the camera right by this many radians (~17°) so the object clears the card. */
  cardTurn: 0.3,
  /**
   * Where "Find" flies the camera, per object id. Objects without a pose keep the current view.
   * Targets: splat centers inside each object's still-frame polygon (nearest quarter by depth),
   * projected with the still's camera (origin, looking −Z, 60° vertical FOV). Pump and cabinet framed by hand.
   */
  poses: {
    "obj-pump": { target: [-0.66, -0.55, -4.56], position: [0.31, -0.37, -2.69] },
    "obj-cabinet": { target: [-0.11, 0.6, -12.71], position: [0.55, 0.37, -5.72] },
    "obj-valve": { target: [2.41, 0.79, -4.58], position: [0.83, 0.53, -2.52] },
    "obj-motor": { target: [1.84, -0.76, -5.3], position: [0.51, -0.32, -2.91] },
    "obj-pallet": { target: [1.91, -1.03, -3.18], position: [0.55, -0.47, -1.75] },
    "obj-extinguisher": { target: [-2.94, 0.73, -5.45], position: [-1.12, 0.5, -3] },
    "obj-hose": { target: [1.53, 0.41, -1.88], position: [0.28, 0.31, -0.96] },
  } as Record<string, CameraPose>,
} as const

export type CameraPose = { position: [number, number, number]; target: [number, number, number] }

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
  conceptLabel: "Find a part or equipment",
  conceptPlaceholder: "Find a part or equipment — name or part number",
  searchHintRoom: "Enter opens a match · no match segments the term in this view.",
  noResults: (q: string) => `No part called '${q}' — try a name or a part number`,
  notScannedNote: "Not scanned yet — scan this room to locate parts in 3D",
  scanRoomTooltip: "needs a capture",
  backToPlant: "Plant",
  scanForMore: "Scan room for more objects…",
  notEquipment: "Not registered equipment — no parts on file",
  noPartsInUnit: "No parts on file for this unit",
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
  objects: "world-parts.objects.v4",
  selection: "world-parts.selection.v1",
  planHintSeen: "world-parts.plan-hint-seen.v1",
  concepts: "world-parts.concepts.v1",
} as const

/** Grey steel cabinet on the back wall, right of the pegboard; the bench covers its lower right. */
const CABINET_POLYGON: Point[] = [[971, 420], [1072, 418], [1078, 500], [1037, 503], [1040, 598], [974, 598]]

/** Seed world: what a returning user would have after an earlier batch sweep. */
export const SEED_OBJECTS: WorldObject[] = [
  {
    id: "obj-pump",
    name: "pump",
    concept: "pump",
    assetId: "P-104",
    kind: "equipment",
    room: "workshop",
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
    assetId: "V-08",
    kind: "equipment",
    room: "workshop",
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
    assetId: "M-21",
    kind: "equipment",
    room: "workshop",
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
    assetId: "PAL-07",
    kind: "equipment",
    room: "workshop",
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
    assetId: "CAB-01",
    kind: "equipment",
    room: "workshop",
    bins: ["A1", "A2", "B1", "B2", "B3", "C1"],
    colorIndex: 4,
    splats: 31_400,
    views: 10,
    votes: 8,
    status: "lifted",
    firstSegmentedAt: "2026-11-04T09:23:20.000Z",
    polygon: CABINET_POLYGON,
  },
  {
    id: "obj-extinguisher",
    name: "extinguisher",
    concept: "extinguisher",
    assetId: "FE-03",
    kind: "equipment",
    room: "workshop",
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
    assetId: "H-12",
    kind: "equipment",
    room: "workshop",
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
    polygon: CABINET_POLYGON,
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
  /** Furthest zoom-in, relative to the fit-the-whole-plan scale. */
  maxZoom: 5,
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

/* ------------------------------------------------------------------ */
/* Equipment (level 1) and parts (level 2).                            */
/* ------------------------------------------------------------------ */

/** A segmented object that is registered equipment. Looked up by concept so saved worlds still resolve. */
export interface Equipment {
  assetId: string
  kind: "equipment"
  concept: string
  name: string
  room: RoomId
  /** Only the parts store inside a room has bins. */
  bins?: string[]
}

/**
 * How two parts relate, in Resourcly's terms: the same item under another number,
 * a different item that does the same job, or only related (don't swap blindly).
 */
export type MatchType = "exact_duplicate" | "functional_substitute" | "related"

export const MATCH_LABEL: Record<MatchType, string> = {
  exact_duplicate: "exact duplicate",
  functional_substitute: "functional substitute",
  related: "related",
}

export interface SimilarPart {
  partNo: string
  match: MatchType
  reason: string
}

/** One name the same part carries in another system. Several of these make one harmonized record. */
export interface PartAlias {
  source: "ERP" | "Datasheet" | "Invoice" | "Supplier catalogue"
  value: string
}

/** Where spares sit. A bin lives in equipment, so its room comes from that equipment. */
export type BinLocation = { assetId: string; bin: string; qty: number }
export type RackLocation = { room: RoomId; rack: string; shelf: number; qty: number }
export type SpotLocation = { room: RoomId; location: string; qty: number }
export type StoredLocation = BinLocation | RackLocation | SpotLocation

export interface Part {
  partNo: string
  name: string
  description: string
  /** Units on hand: always the sum of storedIn qty. */
  stock: number
  unitPrice: number
  supplier: string
  /** ISO date of the last stock count. */
  lastCounted: string
  /** ISO date; set when the part hasn't moved in a long time. */
  idleSince: string | null
  similar: SimilarPart[]
  /** Names the part has in other systems (mock), merged into this record. */
  aliases: PartAlias[]
  /** Asset IDs of the equipment this part is fitted in. */
  installedIn: string[]
  storedIn: StoredLocation[]
}

export const CURRENCY = { code: "EUR", locale: "en-GB" } as const

export const INVENTORY = {
  /** Date the stock figures were taken; idle ages are counted from here. */
  asOf: "2026-11-06",
  /** At or below this stock a part is "low". */
  lowStockMax: 2,
  /** Idle at least this many months counts for the Idle filter. */
  idleMonths: 12,
} as const

/** The seven segmented seed objects, as registered assets. */
export const EQUIPMENT: Equipment[] = SEED_OBJECTS.flatMap((o) =>
  o.kind === "equipment" && o.assetId && o.room
    ? [{ assetId: o.assetId, kind: o.kind, concept: o.concept, name: o.name, room: o.room, bins: o.bins }]
    : [],
)

const PART_RECORDS: Omit<Part, "stock">[] = [
  {
    partNo: "BRG-6205-2RS",
    name: "Bearing 6205-2RS",
    description: "Deep-groove ball bearing, 25 × 52 × 15 mm, rubber sealed both sides",
    unitPrice: 8.4,
    supplier: "Supplier A",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [{ partNo: "BRG-6305", match: "related", reason: "same bore, but 62 mm outside: won't fit the same housing" }],
    aliases: [
      { source: "ERP", value: "BEARING 6205 2RS" },
      { source: "Datasheet", value: "Deep groove ball bearing 25×52×15, 2RS" },
      { source: "Invoice", value: "Rillenkugellager 6205-2RS" },
    ],
    installedIn: ["P-104", "M-21"],
    storedIn: [
      { assetId: "CAB-01", bin: "B3", qty: 2 },
      { room: "storeroom", rack: "R2", shelf: 3, qty: 6 },
    ],
  },
  {
    partNo: "BRG-6305",
    name: "Bearing 6305",
    description: "Deep-groove ball bearing, 25 × 62 × 17 mm, metal shields",
    unitPrice: 12.9,
    supplier: "Supplier A",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [{ partNo: "BRG-6205-2RS", match: "related", reason: "same bore, but 52 mm outside: won't fit the same housing" }],
    aliases: [],
    installedIn: ["M-21"],
    storedIn: [{ room: "storeroom", rack: "R2", shelf: 3, qty: 1 }],
  },
  {
    partNo: "SEL-25",
    name: "Mechanical seal 25 mm",
    description: "Single-spring shaft seal, carbon / ceramic faces, NBR elastomers",
    unitPrice: 46,
    supplier: "Supplier B",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [{ partNo: "GSK-SET", match: "related", reason: "static seals for the same pump casing" }],
    aliases: [],
    installedIn: ["P-104"],
    storedIn: [{ assetId: "CAB-01", bin: "B1", qty: 1 }],
  },
  {
    partNo: "IMP-160",
    name: "Impeller Ø160",
    description: "Closed bronze impeller, 160 mm, keyed 25 mm shaft",
    unitPrice: 214,
    supplier: "Supplier B",
    lastCounted: "2026-09-30",
    idleSince: null,
    similar: [
      {
        partNo: "IMP-160-SS",
        match: "functional_substitute",
        reason: "same 160 mm diameter and keyed 25 mm bore; stainless instead of bronze",
      },
    ],
    aliases: [
      { source: "ERP", value: "IMPELLER D160 BRZ" },
      { source: "Datasheet", value: "Laufrad Ø160, Bronze, Nabe 25 mm" },
    ],
    installedIn: ["P-104"],
    storedIn: [],
  },
  {
    partNo: "IMP-160-SS",
    name: "Impeller Ø160, stainless",
    description: "Closed stainless-steel impeller, 160 mm, keyed 25 mm shaft",
    unitPrice: 268,
    supplier: "Supplier D",
    lastCounted: "2026-10-14",
    // Bought for another pump line and never used: the reuse case.
    idleSince: "2025-10-01",
    similar: [
      {
        partNo: "IMP-160",
        match: "functional_substitute",
        reason: "same 160 mm diameter and keyed 25 mm bore; bronze instead of stainless",
      },
    ],
    aliases: [
      { source: "ERP", value: "LAUFRAD 160 VA" },
      { source: "Supplier catalogue", value: "Impeller closed 160/25 1.4408" },
    ],
    installedIn: [],
    storedIn: [{ assetId: "CAB-01", bin: "C1", qty: 1 }],
  },
  {
    partNo: "VBL-A42",
    name: "V-belt A-42",
    description: "Classical wrapped V-belt, section A, 1067 mm inside length",
    unitPrice: 9.6,
    supplier: "Supplier C",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [],
    aliases: [],
    installedIn: ["M-21"],
    storedIn: [
      { assetId: "CAB-01", bin: "C1", qty: 4 },
      { room: "storeroom", rack: "R1", shelf: 2, qty: 8 },
    ],
  },
  {
    partNo: "HFL-10",
    name: "Hydraulic filter 10 µm",
    description: "Spin-on return-line filter, 10 µm glass fibre, 1″ BSP",
    unitPrice: 31.5,
    supplier: "Supplier C",
    lastCounted: "2026-10-02",
    idleSince: null,
    similar: [],
    aliases: [],
    installedIn: [],
    storedIn: [
      { room: "storeroom", rack: "R3", shelf: 1, qty: 3 },
      { room: "production", location: "line 2, machine 4", qty: 1 },
    ],
  },
  {
    partNo: "CTR-25A",
    name: "Contactor 25 A",
    description: "3-pole AC-3 contactor, 24 V DC coil, DIN rail",
    unitPrice: 38,
    supplier: "Supplier A",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [],
    aliases: [],
    installedIn: [],
    storedIn: [
      { assetId: "CAB-01", bin: "A2", qty: 3 },
      { room: "production", location: "line 1, control panel", qty: 1 },
    ],
  },
  {
    partNo: "FUS-32A",
    name: "Fuse 32 A (10 pcs)",
    description: "gG cartridge fuses 10 × 38 mm, pack of 10",
    unitPrice: 17.5,
    supplier: "Supplier A",
    lastCounted: "2026-10-14",
    idleSince: "2025-08-04",
    similar: [],
    aliases: [],
    installedIn: [],
    storedIn: [{ assetId: "CAB-01", bin: "A1", qty: 2 }],
  },
  {
    partNo: "HCL-40-60",
    name: "Hose clamp 40–60 mm",
    description: "Worm-drive clamp, stainless W4, 9 mm band",
    unitPrice: 1.2,
    supplier: "Supplier C",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [],
    aliases: [],
    installedIn: ["H-12"],
    storedIn: [{ assetId: "CAB-01", bin: "B2", qty: 12 }],
  },
  {
    partNo: "BVL-1-BR",
    name: "Ball valve 1″ brass",
    description: "Full-bore brass ball valve, 1″ BSP female, lever handle, PN25",
    unitPrice: 24,
    supplier: "Supplier B",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [],
    aliases: [],
    installedIn: ["V-08"],
    storedIn: [{ room: "storeroom", rack: "R2", shelf: 1, qty: 2 }],
  },
  {
    partNo: "GSK-SET",
    name: "Gasket set",
    description: "Flange and casing gaskets, aramid fibre, DN25–DN40",
    unitPrice: 19,
    supplier: "Supplier B",
    lastCounted: "2026-10-14",
    idleSince: "2025-09-01",
    similar: [{ partNo: "SEL-25", match: "related", reason: "dynamic shaft seal for the same pump" }],
    aliases: [],
    installedIn: ["P-104", "V-08"],
    storedIn: [
      { assetId: "CAB-01", bin: "B1", qty: 2 },
      { room: "storeroom", rack: "R1", shelf: 4, qty: 3 },
    ],
  },
  {
    partNo: "GRS-400",
    name: "Grease cartridge 400 g",
    description: "Lithium-complex bearing grease, NLGI 2, lever-gun cartridge",
    unitPrice: 6.8,
    supplier: "Supplier C",
    lastCounted: "2026-10-14",
    idleSince: null,
    similar: [],
    aliases: [],
    installedIn: [],
    storedIn: [
      { assetId: "CAB-01", bin: "C1", qty: 6 },
      { room: "loading", location: "inbound pallet, door 2", qty: 12 },
    ],
  },
]

export const PARTS: Part[] = PART_RECORDS.map((p) => ({
  ...p,
  stock: p.storedIn.reduce((sum, l) => sum + l.qty, 0),
}))

export const PLANT_STATS = {
  roomsScanned: ROOMS.filter((r) => r.scanned).length,
  roomsTotal: ROOMS.length,
  partRecords: PARTS.length,
  unitsInStock: PARTS.reduce((sum, p) => sum + p.stock, 0),
} as const

/** The one way part totals are worded: records, then units across all locations. */
export const PARTS_SUMMARY = `${PLANT_STATS.partRecords} parts · ${PLANT_STATS.unitsInStock} units`

/** Minimum characters before the search runs. */
export const SEARCH_MIN_CHARS = 2
