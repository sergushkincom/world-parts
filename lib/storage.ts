export type StorageRead<T> = { ok: true; value: T | null } | { ok: false; value: null }

/** Reads JSON from localStorage. Never throws: blocked storage and bad JSON are both handled. */
export function readJSON<T>(key: string, isValid: (value: unknown) => value is T): StorageRead<T> {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return { ok: true, value: null }
    const parsed: unknown = JSON.parse(raw)
    return { ok: true, value: isValid(parsed) ? parsed : null }
  } catch {
    return { ok: false, value: null }
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
