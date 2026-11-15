import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import { STORAGE_KEYS } from "./data.ts"
import { readJSON, writeJSON } from "./storage.ts"

type Memory = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  seed(key: string, raw: string): void
  throwOnGet: boolean
  throwOnSet: boolean
}

function memoryStorage(): Memory {
  const store = new Map<string, string>()
  const memory: Memory = {
    throwOnGet: false,
    throwOnSet: false,
    getItem(key) {
      if (memory.throwOnGet) throw new Error("storage blocked")
      return store.get(key) ?? null
    },
    setItem(key, value) {
      if (memory.throwOnSet) throw new Error("storage blocked")
      store.set(key, String(value))
    },
    seed(key, raw) {
      store.set(key, raw)
    },
  }
  return memory
}

function install(storage: Memory) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  })
}

function isBoolean(value: unknown): value is boolean {
  return value === true || value === false
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

describe("localStorage JSON", { concurrency: false }, () => {
  let storage: Memory

  beforeEach(() => {
    storage = memoryStorage()
    install(storage)
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it("reads a missing key as an empty success", () => {
    assert.deepEqual(readJSON(STORAGE_KEYS.planHintSeen, isBoolean), { ok: true, value: null })
  })

  it("round-trips a value and overwrites it on the next write", () => {
    assert.equal(writeJSON(STORAGE_KEYS.planHintSeen, true), true)
    assert.deepEqual(readJSON(STORAGE_KEYS.planHintSeen, isBoolean), { ok: true, value: true })

    assert.equal(writeJSON(STORAGE_KEYS.selection, ["obj-pump", "obj-cabinet"]), true)
    assert.equal(writeJSON(STORAGE_KEYS.selection, ["obj-valve"]), true)
    assert.deepEqual(readJSON(STORAGE_KEYS.selection, isStringArray), { ok: true, value: ["obj-valve"] })
    assert.deepEqual(readJSON(STORAGE_KEYS.planHintSeen, isBoolean), { ok: true, value: true })
  })

  it("drops JSON that parses but fails the caller's check", () => {
    storage.seed(STORAGE_KEYS.selection, JSON.stringify({ ids: [1] }))
    assert.deepEqual(readJSON(STORAGE_KEYS.selection, isStringArray), { ok: true, value: null })
    storage.seed(STORAGE_KEYS.planHintSeen, "null")
    assert.deepEqual(readJSON(STORAGE_KEYS.planHintSeen, isBoolean), { ok: true, value: null })
  })

  it("reports corrupt JSON without throwing", () => {
    storage.seed(STORAGE_KEYS.selection, "{")
    assert.deepEqual(readJSON(STORAGE_KEYS.selection, isStringArray), { ok: false, value: null })
  })

  it("reports a blocked read or write and keeps the previous value", () => {
    assert.equal(writeJSON(STORAGE_KEYS.selection, ["obj-pump"]), true)
    storage.throwOnGet = true
    assert.deepEqual(readJSON(STORAGE_KEYS.selection, isStringArray), { ok: false, value: null })
    storage.throwOnGet = false
    storage.throwOnSet = true
    assert.equal(writeJSON(STORAGE_KEYS.selection, ["obj-valve"]), false)
    storage.throwOnSet = false
    assert.deepEqual(readJSON(STORAGE_KEYS.selection, isStringArray), { ok: true, value: ["obj-pump"] })
  })

  it("reports failure when storage cannot be reached", () => {
    delete (globalThis as { window?: unknown }).window
    assert.deepEqual(readJSON(STORAGE_KEYS.planHintSeen, isBoolean), { ok: false, value: null })
    assert.equal(writeJSON(STORAGE_KEYS.planHintSeen, true), false)
  })
})
