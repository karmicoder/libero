import type { GameEngine } from '../../../engines/types'
import { clockSeconds } from '../clock'
import {
  defaultMatchConfig,
  findPeriod,
  nextPlayPeriod,
  periodOffsetSeconds,
} from '../config'
import type {
  FootballAction,
  FootballMessage,
  FootballState,
  GoalEvent,
  MatchConfig,
} from '../state'
import { isFootballState } from '../validate'

const MAX_STOPPAGE_MINUTES = 15

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
  return { ...state, periodId, clock, stoppageMinutes: null }
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
    default:
      // Cards, substitutions, undo and config edits are handled by later
      // engine work; until then they leave the state untouched.
      return state
  }
}

export const footballEngine: GameEngine<
  FootballState,
  FootballAction,
  FootballMessage,
  MatchConfig
> = {
  isState: isFootballState,
  initialState: (config = defaultMatchConfig()) => ({
    config,
    clock: stopped(0),
    periodId: config.periods[0]?.id ?? '',
    stoppageMinutes: null,
    teams: {
      visitor: { name: 'Visitor', score: 0 },
      home: { name: 'Home', score: 0 },
    },
    events: [],
    nextEventId: 1,
  }),
  reduce: (state, action) => ({
    state: reduceState(state, action),
    messages: [],
  }),
}
