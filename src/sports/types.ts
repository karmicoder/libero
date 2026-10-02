/**
 * Metadata describing a sport. Deliberately data-only (serialisable): the game
 * engine and scoreboard layouts will attach to a sport later, keyed by `id`,
 * so sports can be injected at runtime without the UI knowing about either.
 */
export interface SportDefinition {
  /** Stable identifier, used in URLs (`/match/:sportId`). */
  id: string
  name: string
  /** `ready` sports can start a match; `coming-soon` ones are listed but disabled. */
  status: 'ready' | 'coming-soon'
  /** `d` attribute of a single path on a 24x24 viewBox. */
  iconPath: string
}
