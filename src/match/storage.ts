/**
 * Best-effort match backup in `localStorage`. Storage can be missing, full or
 * blocked (private windows, site settings), so every access is guarded and the
 * app works without it; a failed save only costs the resume prompt.
 */

/**
 * Bump when the persisted shape changes; backups of other versions are then
 * ignored. Version 1 (clock anchored to the wall clock) is still read.
 */
const VERSION = 2
const LEGACY_VERSION = 1

export interface Backup<State> {
  state: State
  /** Wall-clock (epoch ms) save time: only to estimate the gap since. Null in version 1. */
  savedAt: number | null
}

const keyFor = (sportId: string) => `libero:match:${sportId}`

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function saveBackup(
  sportId: string,
  state: unknown,
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(
      keyFor(sportId),
      JSON.stringify({ version: VERSION, savedAt: Date.now(), state }),
    )
  } catch {
    // Quota or access errors: carry on without a backup.
  }
}

/** The stored backup, or null if absent, unreadable, another version or invalid. */
export function loadBackup<State>(
  sportId: string,
  isState: (value: unknown) => value is State,
  storage: Storage | undefined = defaultStorage(),
): Backup<State> | null {
  try {
    const raw = storage?.getItem(keyFor(sportId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { version, state, savedAt } = parsed as {
      version?: unknown
      state?: unknown
      savedAt?: unknown
    }
    if (!isState(state)) return null
    if (version === LEGACY_VERSION) return { state, savedAt: null }
    if (version !== VERSION || typeof savedAt !== 'number') return null
    return { state, savedAt }
  } catch {
    return null
  }
}

export function clearBackup(
  sportId: string,
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.removeItem(keyFor(sportId))
  } catch {
    // Nothing to do.
  }
}
