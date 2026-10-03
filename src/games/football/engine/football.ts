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
  MatchConfig,
} from '../state'

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
    default:
      // Goals, cards, substitutions, undo and config edits are handled by
      // later engine work; until then they leave the state untouched.
      return state
  }
}

export const footballEngine: GameEngine<
  FootballState,
  FootballAction,
  FootballMessage,
  MatchConfig
> = {
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
  }),
  reduce: (state, action) => ({
    state: reduceState(state, action),
    messages: [],
  }),
}
