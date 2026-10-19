/**
 * Volleyball's neutral types: the state shape shared by the engine (which
 * produces it) and the scoreboard and console (which render it). Both sides
 * import from here and never from each other. Everything is plain JSON.
 *
 * Pure helpers that every side needs (`config.ts`, `rules.ts`) sit beside it.
 * There is no clock and no event log: per-set scores are stored, not replayed.
 */

/** Visitor is the left column, Home the right. */
export type TeamSide = 'visitor' | 'home'

export interface VolleyballConfig {
  /** Sets a side needs to win the match (3 = best of 5). */
  setsToWin: number
  pointsPerSet: number
  /** Target in the deciding set, when both sides are one set from winning. */
  deciderPoints: number
  /** Lead needed to take a set once the target is reached. */
  winBy: number
  /** First to the cap wins regardless of `winBy`; undefined = no cap. */
  cap?: number
}

export interface SetScore {
  visitor: number
  home: number
}

export interface ClosedSet extends SetScore {
  firstServer: TeamSide
}

export type VolleyballStatus = 'in-play' | 'finished'

/** What undo restores. Config and team names are not in it. */
export interface VolleyballSnapshot {
  completed: ClosedSet[]
  current: SetScore
  firstServer: TeamSide
  serving: TeamSide
  status: VolleyballStatus
  /** Names the undone action in the toast. */
  label: string
}

export interface VolleyballState {
  config: VolleyballConfig
  teams: Record<TeamSide, { name: string }>
  /** Closed sets, in order; sets won is derived from these. */
  completed: ClosedSet[]
  /** The live set (stays 0-0 once the match is finished). */
  current: SetScore
  /** First server of the current set. */
  firstServer: TeamSide
  serving: TeamSide
  status: VolleyballStatus
  /** Undoable steps, oldest first, capped at 30. Absent means none. */
  history?: VolleyballSnapshot[]
}

/**
 * Actions that are time-bearing carry `at` (the console's `performance.now()`)
 * so the reducer stays pure and notices get a unique id.
 */
export type VolleyballAction =
  | { type: 'point'; team: TeamSide; at: number }
  /** Absolute correction of the live set; floored and clamped to >= 0. */
  | { type: 'set-score'; team: TeamSide; score: number; at: number }
  /** At 0-0 also sets the set's first server; later only `serving`. */
  | { type: 'set-server'; team: TeamSide }
  /** The leader wins the set. A tied live score is a no-op. */
  | { type: 'end-set'; at: number }
  | { type: 'set-team-name'; team: TeamSide; name: string }
  | { type: 'update-config'; config: VolleyballConfig }
  | { type: 'undo'; at: number }

interface NoticeBase {
  /** `<type>@<at>`, unique per session. */
  id: string
  at: number
  /** The scorer / set winner. */
  team: TeamSide
}

export type VolleyballMessage =
  | (NoticeBase & {
      type: 'point-scored'
      /** The point moved serve to a different side. */
      serveChanged: boolean
      score: SetScore
    })
  | (NoticeBase & {
      type: 'set-won'
      /** 1-based. */
      setNumber: number
      /** The closed set's final score. */
      score: SetScore
      setsWon: SetScore
      matchWon: boolean
    })
