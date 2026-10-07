import { clockSeconds } from '../clock'
import { findPeriod } from '../config'
import type {
  FootballAction,
  FootballState,
  GoalEvent,
  UndoEntry,
} from '../state'

/** How many steps can be undone. */
export const MAX_HISTORY = 30

/**
 * The undo entry for what `action` just did (`prev` to `next`), or undefined
 * when it is not undoable or changed nothing. Entries are inverses rather
 * than snapshots, so undoing one never erases what other actions changed.
 */
export function undoEntryFor(
  prev: FootballState,
  next: FootballState,
  action: FootballAction,
): UndoEntry | undefined {
  if (next === prev) return undefined
  switch (action.type) {
    case 'goal': {
      const event = next.events.at(-1)
      if (event?.type !== 'goal') return undefined
      return {
        label: 'Goal',
        kind: 'goal',
        team: action.team,
        eventId: event.id,
      }
    }
    case 'remove-goal': {
      const removed = prev.events.find((e) => !next.events.includes(e))
      return {
        label: 'Remove goal',
        kind: 'goal-removed',
        team: action.team,
        ...(removed?.type === 'goal' && { event: removed }),
        index: removed ? prev.events.indexOf(removed) : prev.events.length,
      }
    }
    case 'card': {
      const added = next.events.slice(prev.events.length)
      if (added.length === 0) return undefined
      const first = added[0]
      const second = added.some((e) => e.type === 'card' && e.secondYellow)
      return {
        label: second
          ? 'Second yellow'
          : first.type === 'card' && first.color === 'red'
            ? 'Red card'
            : 'Yellow card',
        kind: 'cards',
        eventIds: added.map((e) => e.id),
      }
    }
    case 'substitution': {
      const event = next.events.at(-1)
      if (event?.type !== 'substitution') return undefined
      return {
        label: 'Substitution',
        kind: 'substitution',
        team: action.team,
        eventId: event.id,
        periodId: prev.periodId,
        before: prev.subsRemaining[action.team],
      }
    }
    case 'set-subs-remaining': {
      if (next.subsRemaining[action.team] === prev.subsRemaining[action.team]) {
        return undefined
      }
      return {
        label: 'Substitutions left',
        kind: 'subs-remaining',
        team: action.team,
        periodId: prev.periodId,
        before: prev.subsRemaining[action.team],
      }
    }
    case 'set-stoppage': {
      if (next.stoppageMinutes === prev.stoppageMinutes) return undefined
      return {
        label: 'Stoppage time',
        kind: 'stoppage',
        periodId: prev.periodId,
        before: prev.stoppageMinutes,
      }
    }
    case 'set-clock':
      return {
        label: 'Set clock',
        kind: 'clock',
        delta: next.clock.baseSeconds - clockSeconds(prev.clock, action.at),
      }
    // Starting after a break enters the next period, so it is undoable too.
    case 'set-period':
    case 'start-clock': {
      if (next.periodId === prev.periodId) return undefined
      return {
        label: 'Period change',
        kind: 'period',
        periodId: prev.periodId,
        seconds: clockSeconds(prev.clock, action.at),
        stoppageMinutes: prev.stoppageMinutes,
        subsRemaining: prev.subsRemaining,
      }
    }
    default:
      return undefined
  }
}

/** The state with `entry` pushed onto its history, oldest dropped past the cap. */
export function withEntry(
  state: FootballState,
  entry: UndoEntry,
): FootballState {
  return {
    ...state,
    history: [...(state.history ?? []), entry].slice(-MAX_HISTORY),
  }
}

function withScore(
  state: FootballState,
  team: GoalEvent['team'],
  change: number,
) {
  return {
    ...state.teams,
    [team]: {
      ...state.teams[team],
      score: Math.max(0, state.teams[team].score + change),
    },
  }
}

/**
 * Reverts the most recent step. The clock is left alone except by set-clock
 * (shifted back by what it moved, keeping its running state as it is now) and
 * period changes (the old period, stopped at the time it had). Counts tied to
 * a period are restored only while still in that period.
 */
export function undoLast(state: FootballState, at: number): FootballState {
  const history = state.history ?? []
  const entry = history.at(-1)
  if (!entry) return state
  const base: FootballState = { ...state, history: history.slice(0, -1) }

  switch (entry.kind) {
    case 'goal': {
      if (!state.events.some((e) => e.id === entry.eventId)) return base
      return {
        ...base,
        events: state.events.filter((e) => e.id !== entry.eventId),
        teams: withScore(state, entry.team, -1),
      }
    }
    case 'goal-removed': {
      const events = [...state.events]
      if (entry.event) {
        events.splice(Math.min(entry.index, events.length), 0, entry.event)
      }
      return { ...base, events, teams: withScore(state, entry.team, 1) }
    }
    case 'cards':
      return {
        ...base,
        events: state.events.filter((e) => !entry.eventIds.includes(e.id)),
      }
    case 'substitution':
      return {
        ...base,
        events: state.events.filter((e) => e.id !== entry.eventId),
        subsRemaining:
          state.periodId === entry.periodId
            ? { ...state.subsRemaining, [entry.team]: entry.before }
            : state.subsRemaining,
      }
    case 'subs-remaining':
      return state.periodId === entry.periodId
        ? {
            ...base,
            subsRemaining: {
              ...state.subsRemaining,
              [entry.team]: entry.before,
            },
          }
        : base
    case 'stoppage':
      return state.periodId === entry.periodId
        ? { ...base, stoppageMinutes: entry.before }
        : base
    case 'clock': {
      const running = state.clock.runningSince !== null
      return {
        ...base,
        clock: {
          baseSeconds: Math.max(0, clockSeconds(state.clock, at) - entry.delta),
          runningSince: running ? at : null,
        },
      }
    }
    case 'period':
      // A config edit may have removed the period it would go back to.
      if (!findPeriod(state.config, entry.periodId)) return base
      return {
        ...base,
        periodId: entry.periodId,
        clock: { baseSeconds: entry.seconds, runningSince: null },
        stoppageMinutes: entry.stoppageMinutes,
        subsRemaining: entry.subsRemaining,
      }
    // Saved state is only loosely validated: drop an entry of an unknown kind.
    default:
      return base
  }
}
