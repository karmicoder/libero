/**
 * Football's neutral types: the state shape shared by the engine (which
 * produces it) and the scoreboard and console (which render it). Both sides
 * import from here and never from each other. Everything is plain JSON.
 *
 * Pure helpers that every side needs (`config.ts`, `clock.ts`) sit beside it.
 */

/** Visitor is the left column, Home the right. */
export type TeamSide = 'visitor' | 'home'

export type CardColor = 'yellow' | 'red'

/** `shootout` is a period label only: the clock is disabled during it. */
export type PeriodKind = 'play' | 'break' | 'shootout'

/**
 * `{ baseSeconds, runningSince }`: every window derives the displayed time as
 * `baseSeconds + (Date.now() - runningSince) / 1000` while running, so no tick
 * actions exist. `runningSince` is an epoch-ms timestamp, or null when stopped.
 */
export interface Clock {
  baseSeconds: number
  runningSince: number | null
}

export interface PeriodConfig {
  /** Stable across renames and reordering. */
  id: string
  name: string
  abbreviation: string
  /** Nominal length. Never stops the clock; stoppage time is manual. Unused for breaks. */
  lengthMinutes?: number
  kind: PeriodKind
}

export interface MatchConfig {
  periods: PeriodConfig[]
  substitutions: {
    enabled: boolean
    /** Warn (don't block) when a team exceeds this in one period. */
    perPeriod?: number
  }
  stoppageTime: { enabled: boolean }
}

interface MatchEventBase {
  id: string
  team: TeamSide
  periodId: string
  /** Match clock when it happened, in seconds. */
  clockSeconds: number
}

export interface GoalEvent extends MatchEventBase {
  type: 'goal'
  scorer?: number
  assist?: number
}

export interface CardEvent extends MatchEventBase {
  type: 'card'
  color: CardColor
  /** Shirt numbers; a card may be shown to several players at once. */
  numbers: number[]
  /** A red that is the result of a second yellow. */
  secondYellow?: boolean
}

export interface SubstitutionEvent extends MatchEventBase {
  type: 'substitution'
  playerOff?: number
  playerOn?: number
}

export type MatchEvent = GoalEvent | CardEvent | SubstitutionEvent

export interface TeamState {
  name: string
  score: number
}

export interface FootballState {
  config: MatchConfig
  clock: Clock
  /** Id of the current period in `config.periods`. */
  periodId: string
  /** Announced added minutes for the current period; null when none shown. */
  stoppageMinutes: number | null
  teams: Record<TeamSide, TeamState>
  /** Chronological log of goals, cards and substitutions. */
  events: MatchEvent[]
  /** Next event id is `e<nextEventId>`. Never reused, even after removals. */
  nextEventId: number
}

/**
 * Actions that depend on time carry `at` (epoch ms) so the reducer stays pure.
 * Later engine tickets may extend this union.
 */
export type FootballAction =
  | { type: 'start-clock'; at: number }
  | { type: 'stop-clock'; at: number }
  /** The engine clamps `seconds` to 0-59 and `minutes` to >= 0. */
  | { type: 'set-clock'; minutes: number; seconds: number; at: number }
  | { type: 'set-period'; periodId: string; at: number }
  /** Clamped to 0-15; only applies in a play period with stoppage enabled. */
  | { type: 'set-stoppage'; minutes: number | null }
  | { type: 'set-team-name'; team: TeamSide; name: string }
  /** Replaces the goal's scorer and assist; an omitted field is cleared. */
  | {
      type: 'set-goal-details'
      eventId: string
      scorer?: number
      assist?: number
    }
  /** Removes the team's most recent goal (by log order) and its point. */
  | { type: 'remove-goal'; team: TeamSide }
  | {
      type: 'goal'
      team: TeamSide
      scorer?: number
      assist?: number
      at: number
    }
  | {
      type: 'card'
      team: TeamSide
      color: CardColor
      numbers: number[]
      at: number
    }
  | {
      type: 'substitution'
      team: TeamSide
      playerOff?: number
      playerOn?: number
      at: number
    }
  | { type: 'undo' }
  | { type: 'update-config'; config: MatchConfig }

/** Transient notices emitted by the reducer; drive scoreboard banners. */
export type FootballMessage =
  | { type: 'goal-scored'; event: GoalEvent }
  | { type: 'card-issued'; event: CardEvent }
  | { type: 'second-yellow'; event: CardEvent }
  | { type: 'substitution-made'; event: SubstitutionEvent }
