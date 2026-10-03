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

/** One player replacing another. Shirt numbers are optional (no roster). */
export interface SubstitutionPair {
  off?: number
  on?: number
}

/** One stoppage can hold several pairs (e.g. a triple substitution). */
export interface SubstitutionEvent extends MatchEventBase {
  type: 'substitution'
  pairs: SubstitutionPair[]
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
  /**
   * Substitutions each team has left this period: reset to the configured
   * limit on entering a play period, reduced by one per pair, never below 0
   * (going over is allowed). Manually adjustable. 0 when there is no limit.
   */
  subsRemaining: Record<TeamSide, number>
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
  /**
   * Replaces the goal's scorer and assist; an omitted field is cleared.
   * Committing details announces the goal (a `goal-scored` notice), so "No
   * assist" is this action with a scorer only.
   */
  | {
      type: 'set-goal-details'
      eventId: string
      scorer?: number
      assist?: number
      at: number
    }
  /** Removes the team's most recent goal (by log order) and its point. */
  | { type: 'remove-goal'; team: TeamSide }
  /**
   * Announces the goal immediately unless `announce` is false. The console
   * passes false when it is about to ask for details, so the board shows one
   * banner when they are committed (and none if the scorer skips them).
   */
  | {
      type: 'goal'
      team: TeamSide
      scorer?: number
      assist?: number
      announce?: boolean
      at: number
    }
  | {
      type: 'card'
      team: TeamSide
      color: CardColor
      numbers: number[]
      at: number
    }
  /** No-op with no pairs or when substitutions are disabled. */
  | {
      type: 'substitution'
      team: TeamSide
      pairs: SubstitutionPair[]
      at: number
    }
  /**
   * Manual correction of the pips. Floored and clamped to 0 up to the larger
   * of 5 and the configured limit; no-op when substitutions or their limit
   * are off.
   */
  | { type: 'set-subs-remaining'; team: TeamSide; remaining: number }
  | { type: 'undo' }
  | { type: 'update-config'; config: MatchConfig }

/** A run of players receiving the same kind of card in one notice. */
export interface CardNoticeGroup {
  /** `second` is a second yellow, which is also a red. */
  kind: 'yellow' | 'red' | 'second'
  numbers: number[]
}

interface NoticeBase {
  /**
   * Unique per notice (`<event id>@<action time>`), so a board can queue and
   * dedupe banners. The same goal can be announced again when its details
   * arrive, with a different `at`.
   */
  id: string
  /** Epoch ms of the action that produced it. */
  at: number
  team: TeamSide
  /** Match minute of the event: `floor(clockSeconds / 60)`. */
  minute: number
}

/**
 * Transient notices emitted by the reducer; drive scoreboard banners. They
 * are never stored in state, and a notice changes nothing but the messages.
 */
export type FootballMessage =
  /** Missing details show as an en dash on the board. */
  | (NoticeBase & { type: 'goal-scored'; scorer?: number; assist?: number })
  /** One per card action, grouped (e.g. a yellow and a second yellow together). */
  | (NoticeBase & { type: 'card-issued'; groups: CardNoticeGroup[] })
  | (NoticeBase & { type: 'substitution-made'; pairs: SubstitutionPair[] })
