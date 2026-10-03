/**
 * Best-effort match backup in `localStorage`. Storage can be missing, full or
 * blocked (private windows, site settings), so every access is guarded and the
 * app works without it; a failed save only costs the resume prompt.
 */

/** Bump when the persisted shape changes; older backups are then ignored. */
const VERSION = 1

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
      JSON.stringify({ version: VERSION, state }),
    )
  } catch {
    // Quota or access errors: carry on without a backup.
  }
}

/** The stored state, or null if absent, unreadable, another version or invalid. */
export function loadBackup<State>(
  sportId: string,
  isState: (value: unknown) => value is State,
  storage: Storage | undefined = defaultStorage(),
): State | null {
  try {
    const raw = storage?.getItem(keyFor(sportId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { version, state } = parsed as { version?: unknown; state?: unknown }
    return version === VERSION && isState(state) ? state : null
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
