"use client"

import * as React from "react"
import {
  COPY,
  DEFAULT_SERVER_TIER,
  MOCK_DETECTIONS,
  MOCK_NO_MASK_REASON,
  OBJECT_PALETTE,
  SEED_OBJECTS,
  STORAGE_KEYS,
  TIMING,
  UNSUPPORTED_CONCEPTS,
  VOTE_THRESHOLD,
  type GaussianView,
  type ObjectStatus,
  type ServerTierId,
  type WorldObject,
} from "@/lib/data"
import { readJSON, writeJSON } from "@/lib/storage"

export type ServerStatus = "checking" | "online" | "unreachable"
export type Notice = { tone: "info" | "error"; text: string }
export type SelectMode = "only" | "toggle" | "range"

interface WorldState {
  hydrated: boolean
  storageOk: boolean
  objects: WorldObject[]
  selection: string[]
  anchorId: string | null
  activeId: string | null
  hoveredId: string | null
  framedId: string | null
  gaussianView: GaussianView
  serverTier: ServerTierId
  serverStatus: ServerStatus
  draft: string
  notice: Notice | null
}

type Action =
  | { type: "hydrate"; objects: WorldObject[]; selection: string[]; storageOk: boolean }
  | { type: "storageFailed" }
  | { type: "select"; id: string; mode: SelectMode }
  | { type: "setSelection"; ids: string[] }
  | { type: "setActive"; id: string | null }
  | { type: "hover"; id: string | null }
  | { type: "frame"; id: string | null }
  | { type: "setView"; view: GaussianView }
  | { type: "setDraft"; draft: string }
  | { type: "setNotice"; notice: Notice | null }
  | { type: "enqueue"; object: WorldObject }
  | { type: "requeue"; id: string }
  | { type: "start"; id: string; at: number }
  | { type: "resolve"; id: string; at: string }
  | { type: "fail"; id: string; reason: string }
  | { type: "rename"; id: string; name: string }
  | { type: "remove"; id: string }
  | { type: "clearAll" }
  | { type: "loadSeed" }
  | { type: "setServerTier"; tier: ServerTierId }
  | { type: "setServerStatus"; status: ServerStatus }

const PENDING: ObjectStatus[] = ["queued", "segmenting"]
export const DRAWABLE: ObjectStatus[] = ["lifted", "low_confidence"]

function patchObject(objects: WorldObject[], id: string, patch: Partial<WorldObject>) {
  return objects.map((o) => (o.id === id ? { ...o, ...patch } : o))
}

function reducer(state: WorldState, action: Action): WorldState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        hydrated: true,
        storageOk: action.storageOk,
        objects: action.objects,
        selection: action.selection,
        activeId: action.selection[0] ?? action.objects[0]?.id ?? null,
      }
    case "storageFailed":
      return state.storageOk ? { ...state, storageOk: false } : state
    case "select": {
      const { id, mode } = action
      if (mode === "only") {
        return { ...state, selection: [id], anchorId: id, activeId: id }
      }
      if (mode === "toggle") {
        const has = state.selection.includes(id)
        return {
          ...state,
          selection: has ? state.selection.filter((s) => s !== id) : [...state.selection, id],
          anchorId: id,
          activeId: id,
        }
      }
      const ids = state.objects.map((o) => o.id)
      const from = ids.indexOf(state.anchorId ?? id)
      const to = ids.indexOf(id)
      const [a, b] = from < to ? [from, to] : [to, from]
      const range = ids.slice(Math.max(a, 0), b + 1)
      return { ...state, selection: Array.from(new Set([...state.selection, ...range])), activeId: id }
    }
    case "setSelection":
      return {
        ...state,
        selection: action.ids,
        anchorId: action.ids.length ? state.anchorId : null,
        framedId: action.ids.length ? state.framedId : null,
      }
    case "setActive":
      return { ...state, activeId: action.id }
    case "hover":
      return state.hoveredId === action.id ? state : { ...state, hoveredId: action.id }
    case "frame":
      return { ...state, framedId: action.id }
    case "setView":
      return { ...state, gaussianView: action.view }
    case "setDraft":
      return { ...state, draft: action.draft, notice: state.notice?.tone === "error" ? null : state.notice }
    case "setNotice":
      return { ...state, notice: action.notice }
    case "enqueue":
      return { ...state, objects: [...state.objects, action.object], activeId: action.object.id }
    case "requeue":
      return {
        ...state,
        objects: patchObject(state.objects, action.id, { status: "queued", failReason: undefined }),
      }
    case "start":
      return {
        ...state,
        objects: patchObject(state.objects, action.id, { status: "segmenting", startedAt: action.at }),
      }
    case "resolve": {
      const target = state.objects.find((o) => o.id === action.id)
      if (!target) return state
      const hit = MOCK_DETECTIONS[target.concept]
      const patch: Partial<WorldObject> = hit
        ? {
            status: hit.votes < VOTE_THRESHOLD ? "low_confidence" : "lifted",
            splats: hit.splats,
            views: hit.views,
            votes: hit.votes,
            polygon: hit.polygon,
            firstSegmentedAt: target.firstSegmentedAt ?? action.at,
            startedAt: undefined,
          }
        : { status: "failed", failReason: MOCK_NO_MASK_REASON(target.concept), startedAt: undefined }
      return { ...state, objects: patchObject(state.objects, action.id, patch) }
    }
    case "fail":
      return {
        ...state,
        objects: patchObject(state.objects, action.id, {
          status: "failed",
          failReason: action.reason,
          startedAt: undefined,
        }),
      }
    case "rename":
      return { ...state, objects: patchObject(state.objects, action.id, { name: action.name }) }
    case "remove": {
      const index = state.objects.findIndex((o) => o.id === action.id)
      const objects = state.objects.filter((o) => o.id !== action.id)
      const neighbour = objects[Math.min(index, objects.length - 1)]?.id ?? null
      return {
        ...state,
        objects,
        selection: state.selection.filter((s) => s !== action.id),
        activeId: state.activeId === action.id ? neighbour : state.activeId,
        anchorId: state.anchorId === action.id ? null : state.anchorId,
        hoveredId: state.hoveredId === action.id ? null : state.hoveredId,
        framedId: state.framedId === action.id ? null : state.framedId,
      }
    }
    case "clearAll":
      return {
        ...state,
        objects: [],
        selection: [],
        activeId: null,
        anchorId: null,
        hoveredId: null,
        framedId: null,
        notice: null,
      }
    case "loadSeed":
      return { ...state, objects: SEED_OBJECTS, selection: [], activeId: SEED_OBJECTS[0]?.id ?? null }
    case "setServerTier":
      return { ...state, serverTier: action.tier }
    case "setServerStatus":
      return { ...state, serverStatus: action.status }
  }
}

const initialState: WorldState = {
  hydrated: false,
  storageOk: true,
  objects: [],
  selection: [],
  anchorId: null,
  activeId: null,
  hoveredId: null,
  framedId: null,
  gaussianView: "highlight",
  serverTier: DEFAULT_SERVER_TIER,
  serverStatus: "checking",
  draft: "",
  notice: null,
}

function isObjectArray(value: unknown): value is WorldObject[] {
  return (
    Array.isArray(value) &&
    value.every(
      (o) =>
        o && typeof o === "object" && typeof o.id === "string" && typeof o.name === "string" && typeof o.status === "string",
    )
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
}

/** Anything mid-flight when the page closed can't be resumed; surface it as a retryable failure. */
function settleInterrupted(objects: WorldObject[]): WorldObject[] {
  return objects.map((o) =>
    PENDING.includes(o.status)
      ? { ...o, status: "failed", failReason: "Interrupted by a reload — retry to segment again", startedAt: undefined }
      : o,
  )
}

function nextColorIndex(objects: WorldObject[]) {
  const usage = OBJECT_PALETTE.map((_, i) => objects.filter((o) => o.colorIndex === i).length)
  return usage.indexOf(Math.min(...usage))
}

export type SubmitResult = "queued" | "exists" | "invalid"

interface WorldContextValue {
  state: WorldState
  selectedObjects: WorldObject[]
  conceptInputRef: React.RefObject<HTMLInputElement | null>
  registerRow: (id: string, el: HTMLElement | null) => void
  focusRow: (id: string) => void
  select: (id: string, mode?: SelectMode) => void
  setSelection: (ids: string[]) => void
  clearSelection: () => void
  setActive: (id: string | null) => void
  hover: (id: string | null) => void
  frame: (id: string | null) => void
  setView: (view: GaussianView) => void
  setDraft: (draft: string) => void
  submitConcept: (raw: string) => SubmitResult
  segmentDraft: () => void
  retry: (id: string) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  clearAll: () => void
  loadSeed: () => void
  setServerTier: (tier: ServerTierId) => void
  setServerStatus: (status: ServerStatus) => void
}

const WorldContext = React.createContext<WorldContextValue | null>(null)

export function useWorld() {
  const ctx = React.useContext(WorldContext)
  if (!ctx) throw new Error("useWorld must be used inside <WorldProvider>")
  return ctx
}

export function WorldProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState)
  const stateRef = React.useRef(state)
  stateRef.current = state
  const conceptInputRef = React.useRef<HTMLInputElement | null>(null)
  const rowRefs = React.useRef(new Map<string, HTMLElement>())

  React.useEffect(() => {
    const objects = readJSON(STORAGE_KEYS.objects, isObjectArray)
    const selection = readJSON(STORAGE_KEYS.selection, isStringArray)
    const loaded = settleInterrupted(objects.value ?? SEED_OBJECTS)
    const ids = new Set(loaded.map((o) => o.id))
    dispatch({
      type: "hydrate",
      objects: loaded,
      selection: (selection.value ?? []).filter((id) => ids.has(id)),
      storageOk: objects.ok && selection.ok,
    })
    const t = window.setTimeout(() => dispatch({ type: "setServerStatus", status: "online" }), TIMING.serverCheckMs)
    return () => window.clearTimeout(t)
  }, [])

  React.useEffect(() => {
    if (!state.hydrated) return
    const ok = writeJSON(STORAGE_KEYS.objects, state.objects) && writeJSON(STORAGE_KEYS.selection, state.selection)
    if (!ok) dispatch({ type: "storageFailed" })
  }, [state.hydrated, state.objects, state.selection])

  // Mock segmentation queue: one segment view at a time, TIMING.segmentMsPerView each.
  React.useEffect(() => {
    if (!state.hydrated) return
    const running = state.objects.find((o) => o.status === "segmenting")
    if (state.serverStatus === "unreachable") {
      if (running) dispatch({ type: "fail", id: running.id, reason: "Server unreachable — segment view stopped" })
      return
    }
    if (state.serverStatus !== "online") return
    if (running) {
      const elapsed = Date.now() - (running.startedAt ?? Date.now())
      const t = window.setTimeout(
        () => dispatch({ type: "resolve", id: running.id, at: new Date().toISOString() }),
        Math.max(0, TIMING.segmentMsPerView - elapsed),
      )
      return () => window.clearTimeout(t)
    }
    const next = state.objects.find((o) => o.status === "queued")
    if (next) dispatch({ type: "start", id: next.id, at: Date.now() })
  }, [state.hydrated, state.objects, state.serverStatus])

  const focusRow = React.useCallback((id: string) => {
    rowRefs.current.get(id)?.focus()
  }, [])

  const registerRow = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }, [])

  const submitConcept = React.useCallback((raw: string): SubmitResult => {
    const s = stateRef.current
    const concept = raw.trim().toLowerCase().replace(/\s+/g, " ")
    if (!concept) {
      dispatch({ type: "setNotice", notice: { tone: "error", text: "Type a concept first." } })
      return "invalid"
    }
    if (UNSUPPORTED_CONCEPTS.includes(concept)) {
      dispatch({ type: "setNotice", notice: { tone: "error", text: COPY.conceptLimit } })
      return "invalid"
    }
    if (s.serverStatus !== "online") {
      dispatch({ type: "setNotice", notice: { tone: "error", text: "Server isn't ready — segment view is paused." } })
      return "invalid"
    }
    const existing = s.objects.find((o) => o.concept === concept)
    if (existing) {
      if (DRAWABLE.includes(existing.status)) {
        dispatch({ type: "select", id: existing.id, mode: "only" })
        dispatch({ type: "frame", id: existing.id })
        dispatch({
          type: "setNotice",
          notice: { tone: "info", text: `"${concept}" is already lifted — framed it instead of segmenting again.` },
        })
        return "exists"
      }
      if (PENDING.includes(existing.status)) {
        dispatch({ type: "setNotice", notice: { tone: "info", text: `"${concept}" is already in the queue.` } })
        return "exists"
      }
      dispatch({ type: "requeue", id: existing.id })
      dispatch({ type: "setNotice", notice: { tone: "info", text: `Retrying "${concept}".` } })
      return "queued"
    }
    dispatch({
      type: "enqueue",
      object: {
        id: `obj-${concept.replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
        name: concept,
        concept,
        colorIndex: nextColorIndex(s.objects),
        splats: null,
        views: 0,
        votes: 0,
        status: "queued",
        firstSegmentedAt: null,
        polygon: null,
      },
    })
    dispatch({ type: "setNotice", notice: null })
    return "queued"
  }, [])

  const value = React.useMemo<WorldContextValue>(() => {
    const selectedSet = new Set(state.selection)
    return {
      state,
      selectedObjects: state.objects.filter((o) => selectedSet.has(o.id)),
      conceptInputRef,
      registerRow,
      focusRow,
      select: (id, mode = "only") => dispatch({ type: "select", id, mode }),
      setSelection: (ids) => dispatch({ type: "setSelection", ids }),
      clearSelection: () => {
        dispatch({ type: "setSelection", ids: [] })
        dispatch({ type: "frame", id: null })
      },
      setActive: (id) => dispatch({ type: "setActive", id }),
      hover: (id) => dispatch({ type: "hover", id }),
      frame: (id) => dispatch({ type: "frame", id }),
      setView: (view) => dispatch({ type: "setView", view }),
      setDraft: (draft) => dispatch({ type: "setDraft", draft }),
      submitConcept,
      segmentDraft: () => {
        const draft = stateRef.current.draft
        if (!draft.trim()) {
          conceptInputRef.current?.focus()
          return
        }
        if (submitConcept(draft) !== "invalid") dispatch({ type: "setDraft", draft: "" })
      },
      retry: (id) => dispatch({ type: "requeue", id }),
      rename: (id, name) => {
        const clean = name.trim().slice(0, 40)
        if (clean) dispatch({ type: "rename", id, name: clean })
      },
      remove: (id) => dispatch({ type: "remove", id }),
      clearAll: () => dispatch({ type: "clearAll" }),
      loadSeed: () => dispatch({ type: "loadSeed" }),
      setServerTier: (tier) => dispatch({ type: "setServerTier", tier }),
      setServerStatus: (status) => dispatch({ type: "setServerStatus", status }),
    }
  }, [state, registerRow, focusRow, submitConcept])

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>
}
