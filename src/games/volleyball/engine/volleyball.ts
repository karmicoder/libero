import type { GameEngine } from '../../../engines/types'
import { configProblems, defaultVolleyballConfig } from '../config'
import { matchWinner, setsWon } from '../rules'
import type {
  TeamSide,
  VolleyballAction,
  VolleyballConfig,
  VolleyballMessage,
  VolleyballSnapshot,
  VolleyballState,
} from '../state'
import { isVolleyballState } from '../validate'

export const MAX_HISTORY = 30

const otherSide = (team: TeamSide): TeamSide =>
  team === 'home' ? 'visitor' : 'home'

const noticeId = (type: string, at: number) => `${type}@${at}`

function withSnapshot(
  prev: VolleyballState,
  next: VolleyballState,
  label: string,
): VolleyballState {
  const entry: VolleyballSnapshot = {
    completed: prev.completed,
    current: prev.current,
    firstServer: prev.firstServer,
    serving: prev.serving,
    status: prev.status,
    label,
  }
  return {
    ...next,
    history: [...(prev.history ?? []), entry].slice(-MAX_HISTORY),
  }
}

/** Restores the newest snapshot wholesale; config and names are untouched. */
function undoLast(state: VolleyballState): VolleyballState {
  const history = state.history ?? []
  const last = history.at(-1)
  if (!last) return state
  return {
    ...state,
    completed: last.completed,
    current: last.current,
    firstServer: last.firstServer,
    serving: last.serving,
    status: last.status,
    history: history.slice(0, -1),
  }
}

function endSet(state: VolleyballState): VolleyballState {
  const { visitor, home } = state.current
  if (visitor === home) return state
  const completed = [
    ...state.completed,
    { visitor, home, firstServer: state.firstServer },
  ]
  const closed = { ...state, completed }
  if (matchWinner(closed) !== null) return { ...closed, status: 'finished' }
  const firstServer = otherSide(state.firstServer)
  return {
    ...closed,
    current: { visitor: 0, home: 0 },
    firstServer,
    serving: firstServer,
  }
}

function reduceState(
  state: VolleyballState,
  action: VolleyballAction,
): VolleyballState {
  const live = state.status === 'in-play'
  switch (action.type) {
    case 'point':
      if (!live) return state
      return {
        ...state,
        current: {
          ...state.current,
          [action.team]: state.current[action.team] + 1,
        },
        serving: action.team,
      }
    case 'set-score': {
      if (!live || !Number.isFinite(action.score)) return state
      const score = Math.max(0, Math.floor(action.score))
      if (state.current[action.team] === score) return state
      return { ...state, current: { ...state.current, [action.team]: score } }
    }
    case 'set-server': {
      if (!live) return state
      const fresh = state.current.visitor === 0 && state.current.home === 0
      const unchanged =
        state.serving === action.team &&
        (!fresh || state.firstServer === action.team)
      if (unchanged) return state
      return {
        ...state,
        serving: action.team,
        ...(fresh && { firstServer: action.team }),
      }
    }
    case 'end-set':
      return live ? endSet(state) : state
    case 'set-team-name':
      if (state.teams[action.team].name === action.name) return state
      return {
        ...state,
        teams: { ...state.teams, [action.team]: { name: action.name } },
      }
    case 'update-config':
      // The screen shows these as messages; the reducer holds the line anyway.
      if (configProblems(action.config).length > 0) return state
      return { ...state, config: action.config }
    case 'undo':
      return undoLast(state)
  }
}

/** Label for the undo toast; undefined when the action isn't undoable. */
function undoLabel(
  prev: VolleyballState,
  action: VolleyballAction,
): string | undefined {
  switch (action.type) {
    case 'point':
      return `Point for ${prev.teams[action.team].name}`
    case 'set-score':
      return `Score correction for ${prev.teams[action.team].name}`
    case 'set-server':
      return `Serve to ${prev.teams[action.team].name}`
    case 'end-set':
      return `End of set ${prev.completed.length + 1}`
    default:
      return undefined
  }
}

/**
 * The transient notices for what an action just did, derived from the state
 * change so the reducer cases stay about state. A no-op changes nothing and so
 * announces nothing. Notices are never stored.
 */
function noticesFor(
  prev: VolleyballState,
  next: VolleyballState,
  action: VolleyballAction,
): VolleyballMessage[] {
  if (next === prev) return []
  switch (action.type) {
    case 'point':
      return [
        {
          type: 'point-scored',
          id: noticeId('point-scored', action.at),
          at: action.at,
          team: action.team,
          serveChanged: prev.serving !== next.serving,
          score: next.current,
        },
      ]
    case 'end-set': {
      const closed = next.completed.at(-1)
      if (!closed) return []
      return [
        {
          type: 'set-won',
          id: noticeId('set-won', action.at),
          at: action.at,
          team: closed.visitor > closed.home ? 'visitor' : 'home',
          setNumber: next.completed.length,
          score: { visitor: closed.visitor, home: closed.home },
          setsWon: setsWon(next),
          matchWon: next.status === 'finished',
        },
      ]
    }
    default:
      return []
  }
}

export const volleyballEngine: GameEngine<
  VolleyballState,
  VolleyballAction,
  VolleyballMessage,
  VolleyballConfig
> = {
  isState: isVolleyballState,
  initialState: (config = defaultVolleyballConfig()) => ({
    config,
    teams: { visitor: { name: 'Visitor' }, home: { name: 'Home' } },
    completed: [],
    current: { visitor: 0, home: 0 },
    firstServer: 'home',
    serving: 'home',
    status: 'in-play',
  }),
  reduce: (state, action) => {
    const next = reduceState(state, action)
    const label = undoLabel(state, action)
    // A no-op returns the same object, so it leaves no snapshot behind.
    return {
      state: label && next !== state ? withSnapshot(state, next, label) : next,
      messages: noticesFor(state, next, action),
    }
  },
}
