import type { GameEngine } from '../../../engines/types'
import { cautionedNumbers } from '../cards'
import { anchorClock, clockSeconds, foldClock, pauseClock } from '../clock'
import {
  configProblems,
  defaultMatchConfig,
  findPeriod,
  MAX_STOPPAGE_MINUTES,
  nextPlayPeriod,
  periodOffsetSeconds,
} from '../config'
import type {
  CardColor,
  CardEvent,
  FootballAction,
  FootballMessage,
  FootballState,
  GoalEvent,
  MatchConfig,
  MatchEvent,
  SubstitutionEvent,
  TeamSide,
} from '../state'
import { maxSubsRemaining, subLimit, subsMade } from '../subs'
import { isFootballState } from '../validate'
import { undoEntryFor, undoLast, withEntry } from './undo'

/** Shirt numbers are 1-99 (no leading zero); anything else is dropped. */
const validJersey = (n: number | undefined): n is number =>
  n !== undefined && Number.isInteger(n) && n >= 1 && n <= 99

/** Only valid numbers become keys, so state is identical after JSON. */
function jerseyDetails(scorer?: number, assist?: number) {
  return {
    ...(validJersey(scorer) && { scorer }),
    ...(validJersey(assist) && { assist }),
  }
}

/** Both teams back to the configured limit (0 when there is none). */
const freshSubs = (config: MatchConfig) => {
  const limit = subLimit(config) ?? 0
  return { visitor: limit, home: limit }
}

const stopped = (seconds: number) => ({
  baseSeconds: seconds,
  runningSince: null,
})

function enterPeriod(
  state: FootballState,
  periodId: string,
  at: number,
): FootballState {
  const period = findPeriod(state.config, periodId)
  if (!period) return state
  // Play periods start at their offset; breaks and shootouts freeze the clock.
  const clock =
    period.kind === 'play'
      ? stopped(periodOffsetSeconds(state.config, periodId))
      : stopped(clockSeconds(state.clock, at))
  return {
    ...state,
    periodId,
    clock,
    stoppageMinutes: null,
    // Each play period gets a fresh set of substitutions; breaks keep them.
    subsRemaining:
      period.kind === 'play' ? freshSubs(state.config) : state.subsRemaining,
  }
}

function reduceState(
  state: FootballState,
  action: FootballAction,
): FootballState {
  const period = findPeriod(state.config, state.periodId)
  const running = state.clock.runningSince !== null

  switch (action.type) {
    case 'start-clock': {
      if (running || !period || period.kind === 'shootout') return state
      if (period.kind === 'break') {
        const next = nextPlayPeriod(state.config, period.id)
        if (!next) return state
        const entered = enterPeriod(state, next.id, action.at)
        return {
          ...entered,
          clock: { ...entered.clock, runningSince: action.at },
        }
      }
      return { ...state, clock: { ...state.clock, runningSince: action.at } }
    }
    case 'stop-clock':
      if (!running) return state
      return { ...state, clock: stopped(clockSeconds(state.clock, action.at)) }
    case 'set-clock': {
      if (period?.kind === 'shootout') return state
      const minutes = Math.max(0, Math.floor(action.minutes))
      const seconds = Math.min(59, Math.max(0, Math.floor(action.seconds)))
      return {
        ...state,
        clock: {
          baseSeconds: minutes * 60 + seconds,
          runningSince: running ? action.at : null,
        },
      }
    }
    case 'set-period':
      if (action.periodId === state.periodId) return state
      return enterPeriod(state, action.periodId, action.at)
    case 'goal': {
      const event: GoalEvent = {
        id: `e${state.nextEventId}`,
        type: 'goal',
        team: action.team,
        periodId: state.periodId,
        clockSeconds: Math.floor(clockSeconds(state.clock, action.at)),
        ...jerseyDetails(action.scorer, action.assist),
      }
      return {
        ...state,
        teams: {
          ...state.teams,
          [action.team]: {
            ...state.teams[action.team],
            score: state.teams[action.team].score + 1,
          },
        },
        events: [...state.events, event],
        nextEventId: state.nextEventId + 1,
      }
    }
    case 'set-goal-details': {
      const index = state.events.findIndex((e) => e.id === action.eventId)
      const target = state.events[index]
      if (target?.type !== 'goal') return state
      // Rebuilt without the old details so omitted fields are cleared.
      const events = [...state.events]
      events[index] = {
        id: target.id,
        type: 'goal',
        team: target.team,
        periodId: target.periodId,
        clockSeconds: target.clockSeconds,
        ...jerseyDetails(action.scorer, action.assist),
      }
      return { ...state, events }
    }
    case 'remove-goal': {
      const score = state.teams[action.team].score
      const index = state.events.findLastIndex(
        (e) => e.type === 'goal' && e.team === action.team,
      )
      if (index === -1 && score === 0) return state
      return {
        ...state,
        teams: {
          ...state.teams,
          [action.team]: {
            ...state.teams[action.team],
            score: Math.max(0, score - 1),
          },
        },
        events:
          index === -1
            ? state.events
            : state.events.filter((_, i) => i !== index),
      }
    }
    case 'set-stoppage': {
      if (!state.config.stoppageTime.enabled || period?.kind !== 'play') {
        return state
      }
      const minutes =
        action.minutes === null
          ? null
          : Math.min(
              MAX_STOPPAGE_MINUTES,
              Math.max(0, Math.floor(action.minutes)),
            )
      return { ...state, stoppageMinutes: minutes }
    }
    case 'card': {
      const numbers = [...new Set(action.numbers.filter(validJersey))]
      // A yellow for a cautioned player on the pitch is a second yellow, which
      // is a red. Anyone else (first yellow, or already sent off) gets a plain
      // yellow. A batch can mix both, so it splits into up to two events.
      const cautioned = new Set(cautionedNumbers(state.events, action.team))
      type Group = { color: CardColor; numbers: number[]; second?: true }
      const split: Group[] = [
        { color: 'yellow', numbers: numbers.filter((n) => !cautioned.has(n)) },
        {
          color: 'red',
          numbers: numbers.filter((n) => cautioned.has(n)),
          second: true,
        },
      ]
      const groups: Group[] =
        action.color === 'red' || numbers.length === 0
          ? [{ color: action.color, numbers }]
          : split.filter((g) => g.numbers.length > 0)
      const clock = Math.floor(clockSeconds(state.clock, action.at))
      const events: CardEvent[] = groups.map((g, i) => ({
        id: `e${state.nextEventId + i}`,
        type: 'card',
        team: action.team,
        periodId: state.periodId,
        clockSeconds: clock,
        color: g.color,
        numbers: g.numbers,
        ...(g.second && { secondYellow: true }),
      }))
      return {
        ...state,
        events: [...state.events, ...events],
        nextEventId: state.nextEventId + events.length,
      }
    }
    case 'set-team-name': {
      if (state.teams[action.team].name === action.name) return state
      return {
        ...state,
        teams: {
          ...state.teams,
          [action.team]: { ...state.teams[action.team], name: action.name },
        },
      }
    }
    case 'substitution': {
      if (!state.config.substitutions.enabled) return state
      const pairs = action.pairs.map((p) => ({
        ...(validJersey(p.off) && { off: p.off }),
        ...(validJersey(p.on) && { on: p.on }),
      }))
      if (pairs.length === 0) return state
      const event: SubstitutionEvent = {
        id: `e${state.nextEventId}`,
        type: 'substitution',
        team: action.team,
        periodId: state.periodId,
        clockSeconds: Math.floor(clockSeconds(state.clock, action.at)),
        pairs,
      }
      return {
        ...state,
        // Over the limit is allowed: remaining just stops at 0.
        subsRemaining: {
          ...state.subsRemaining,
          [action.team]: Math.max(
            0,
            state.subsRemaining[action.team] - pairs.length,
          ),
        },
        events: [...state.events, event],
        nextEventId: state.nextEventId + 1,
      }
    }
    case 'set-subs-remaining': {
      if (subLimit(state.config) === undefined) return state
      const remaining = Math.min(
        maxSubsRemaining(state.config),
        Math.max(0, Math.floor(action.remaining)),
      )
      return {
        ...state,
        subsRemaining: { ...state.subsRemaining, [action.team]: remaining },
      }
    }
    case 'update-config': {
      // The screen shows these as messages; the reducer holds the line anyway.
      if (configProblems(action.config, state.periodId).length > 0) {
        return state
      }
      const config = action.config
      // The clock is untouched: later periods' offsets derive from the config.
      const limit = subLimit(config)
      const left = (team: TeamSide) =>
        limit === undefined
          ? 0
          : Math.max(0, limit - subsMade(state.events, team, state.periodId))
      // Only a changed limit re-derives the counts; any other edit keeps the
      // scorer's manual corrections.
      const limitChanged = limit !== subLimit(state.config)
      return {
        ...state,
        config,
        stoppageMinutes: config.stoppageTime.enabled
          ? state.stoppageMinutes
          : null,
        subsRemaining: limitChanged
          ? { visitor: left('visitor'), home: left('home') }
          : state.subsRemaining,
      }
    }
    default:
      // Undo is handled in `reduce`.
      return state
  }
}

const eventMinute = (e: MatchEvent) => Math.floor(e.clockSeconds / 60)
const noticeId = (eventId: string, at: number) => `${eventId}@${at}`

function goalNotice(e: GoalEvent, at: number): FootballMessage {
  return {
    type: 'goal-scored',
    id: noticeId(e.id, at),
    at,
    team: e.team,
    minute: eventMinute(e),
    ...(e.scorer !== undefined && { scorer: e.scorer }),
    ...(e.assist !== undefined && { assist: e.assist }),
  }
}

/**
 * The transient notices for what an action just did, derived from the state
 * change so the reducer cases stay about state. A no-op action changes
 * nothing and so announces nothing. Notices are never stored.
 */
function noticesFor(
  prev: FootballState,
  next: FootballState,
  action: FootballAction,
): FootballMessage[] {
  switch (action.type) {
    case 'goal': {
      const event = next.events.at(-1)
      if (action.announce === false || event?.type !== 'goal') return []
      return [goalNotice(event, action.at)]
    }
    case 'set-goal-details': {
      if (next === prev) return []
      const event = next.events.find((e) => e.id === action.eventId)
      return event?.type === 'goal' ? [goalNotice(event, action.at)] : []
    }
    case 'card': {
      const cards = next.events
        .slice(prev.events.length)
        .filter((e): e is CardEvent => e.type === 'card')
      if (cards.length === 0) return []
      return [
        {
          type: 'card-issued',
          id: noticeId(cards[0].id, action.at),
          at: action.at,
          team: action.team,
          minute: eventMinute(cards[0]),
          groups: cards.map((c) => ({
            kind: c.secondYellow ? 'second' : c.color,
            numbers: c.numbers,
          })),
        },
      ]
    }
    case 'substitution': {
      const event = next.events.at(-1)
      if (next === prev || event?.type !== 'substitution') return []
      return [
        {
          type: 'substitution-made',
          id: noticeId(event.id, action.at),
          at: action.at,
          team: action.team,
          minute: eventMinute(event),
          pairs: event.pairs,
        },
      ]
    }
    default:
      return []
  }
}

export const footballEngine: GameEngine<
  FootballState,
  FootballAction,
  FootballMessage,
  MatchConfig
> = {
  isState: isFootballState,
  clockTiming: {
    isRunning: (state) => state.clock.runningSince !== null,
    fold: foldClock,
    anchor: anchorClock,
    pause: pauseClock,
    legacyEpochRunningSince: (state) => state.clock.runningSince,
  },
  initialState: (config = defaultMatchConfig()) => ({
    config,
    clock: stopped(0),
    periodId: config.periods[0]?.id ?? '',
    stoppageMinutes: null,
    teams: {
      visitor: { name: 'Visitor', score: 0 },
      home: { name: 'Home', score: 0 },
    },
    subsRemaining: freshSubs(config),
    events: [],
    nextEventId: 1,
  }),
  reduce: (state, action) => {
    if (action.type === 'undo') {
      return { state: undoLast(state, action.at), messages: [] }
    }
    const next = reduceState(state, action)
    const entry = undoEntryFor(state, next, action)
    return {
      state: entry ? withEntry(next, entry) : next,
      messages: noticesFor(state, next, action),
    }
  },
}
