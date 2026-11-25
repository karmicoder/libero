import { clockSeconds } from '../clock'
import { findPeriod } from '../config'
import { subLimit } from '../subs'
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

/**
 * The state with `entry` pushed onto its history, oldest dropped past the
 * cap. A new step starts a new line of history, so nothing is left to redo.
 */
export function withEntry(
  state: FootballState,
  entry: UndoEntry,
): FootballState {
  return {
    ...withoutFuture(state),
    history: [...(state.history ?? []), entry].slice(-MAX_HISTORY),
  }
}

function withoutFuture(state: FootballState): FootballState {
  if (state.future === undefined) return state
  const rest = { ...state }
  delete rest.future
  return rest
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

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = [...list]
  next.splice(Math.min(index, next.length), 0, item)
  return next
}

interface Applied {
  state: FootballState
  inverse: UndoEntry
}

/**
 * Applies `entry` and returns the result with the entry that reverses it, or
 * undefined when the entry no longer applies and is dropped. The clock is
 * left alone except by set-clock (shifted by what it moved, keeping its
 * running state as it is now) and period changes (the other period, stopped
 * at the time it had). Counts tied to a period are restored only while still
 * in that period.
 */
function applyEntry(
  state: FootballState,
  entry: UndoEntry,
  at: number,
): Applied | undefined {
  const { label } = entry
  switch (entry.kind) {
    case 'goal': {
      if (entry.eventId === undefined) {
        return {
          state: { ...state, teams: withScore(state, entry.team, -1) },
          inverse: {
            label,
            kind: 'goal-removed',
            team: entry.team,
            index: state.events.length,
          },
        }
      }
      const index = state.events.findIndex((e) => e.id === entry.eventId)
      const event = state.events[index]
      if (event?.type !== 'goal') return undefined
      return {
        state: {
          ...state,
          events: state.events.filter((e) => e !== event),
          teams: withScore(state, entry.team, -1),
        },
        inverse: {
          label,
          kind: 'goal-removed',
          team: entry.team,
          event,
          index,
        },
      }
    }
    case 'goal-removed':
      return {
        state: {
          ...state,
          events: entry.event
            ? insertAt(state.events, entry.index, entry.event)
            : state.events,
          teams: withScore(state, entry.team, 1),
        },
        inverse: {
          label,
          kind: 'goal',
          team: entry.team,
          ...(entry.event && { eventId: entry.event.id }),
        },
      }
    case 'cards': {
      const cards = state.events.flatMap((event, index) =>
        event.type === 'card' && entry.eventIds.includes(event.id)
          ? [{ event, index }]
          : [],
      )
      if (cards.length === 0) return undefined
      return {
        state: {
          ...state,
          events: state.events.filter((e) => !entry.eventIds.includes(e.id)),
        },
        inverse: { label, kind: 'cards-removed', cards },
      }
    }
    case 'cards-removed':
      return {
        state: {
          ...state,
          events: entry.cards.reduce<FootballState['events']>(
            (events, { event, index }) => insertAt(events, index, event),
            state.events,
          ),
        },
        inverse: {
          label,
          kind: 'cards',
          eventIds: entry.cards.map((c) => c.event.id),
        },
      }
    case 'substitution': {
      const index = state.events.findIndex((e) => e.id === entry.eventId)
      const event = state.events[index]
      if (event?.type !== 'substitution') return undefined
      return {
        state: {
          ...state,
          events: state.events.filter((e) => e !== event),
          subsRemaining: inPeriod(
            state,
            entry.periodId,
            entry.team,
            entry.before,
          ),
        },
        inverse: {
          label,
          kind: 'substitution-removed',
          team: entry.team,
          event,
          index,
          periodId: entry.periodId,
          before: state.subsRemaining[entry.team],
        },
      }
    }
    case 'substitution-removed':
      return {
        state: {
          ...state,
          events: insertAt(state.events, entry.index, entry.event),
          subsRemaining: inPeriod(
            state,
            entry.periodId,
            entry.team,
            entry.before,
          ),
        },
        inverse: {
          label,
          kind: 'substitution',
          team: entry.team,
          eventId: entry.event.id,
          periodId: entry.periodId,
          before: state.subsRemaining[entry.team],
        },
      }
    case 'subs-remaining':
      if (state.periodId !== entry.periodId) return undefined
      return {
        state: {
          ...state,
          subsRemaining: inPeriod(
            state,
            entry.periodId,
            entry.team,
            entry.before,
          ),
        },
        inverse: { ...entry, before: state.subsRemaining[entry.team] },
      }
    case 'stoppage':
      if (state.periodId !== entry.periodId) return undefined
      return {
        state: { ...state, stoppageMinutes: entry.before },
        inverse: { ...entry, before: state.stoppageMinutes },
      }
    case 'clock': {
      const now = clockSeconds(state.clock, at)
      const seconds = Math.max(0, now - entry.delta)
      return {
        state: {
          ...state,
          clock: {
            baseSeconds: seconds,
            runningSince: state.clock.runningSince !== null ? at : null,
          },
        },
        inverse: { label, kind: 'clock', delta: seconds - now },
      }
    }
    case 'period':
      // A config edit may have removed the period it would go back to.
      if (!findPeriod(state.config, entry.periodId)) return undefined
      return {
        state: {
          ...state,
          periodId: entry.periodId,
          clock: { baseSeconds: entry.seconds, runningSince: null },
          stoppageMinutes: entry.stoppageMinutes,
          subsRemaining: entry.subsRemaining,
        },
        inverse: {
          label,
          kind: 'period',
          periodId: state.periodId,
          seconds: clockSeconds(state.clock, at),
          stoppageMinutes: state.stoppageMinutes,
          subsRemaining: state.subsRemaining,
        },
      }
    // Saved state is only loosely validated: drop an entry of an unknown kind.
    default:
      return undefined
  }
}

/** The remaining counts with `team`'s set to `count`, if still in `periodId`. */
function inPeriod(
  state: FootballState,
  periodId: string,
  team: GoalEvent['team'],
  count: number,
): FootballState['subsRemaining'] {
  return state.periodId === periodId
    ? { ...state.subsRemaining, [team]: count }
    : state.subsRemaining
}

/**
 * Entries hold values from when they were recorded, and a config edit may
 * have changed what is allowed since: keep the restored counts within the
 * current config.
 */
function withinConfig(state: FootballState): FootballState {
  const max = subLimit(state.config) ?? 0
  const fit = (n: number) => Math.min(max, Math.max(0, n))
  return {
    ...state,
    subsRemaining: {
      visitor: fit(state.subsRemaining.visitor),
      home: fit(state.subsRemaining.home),
    },
    stoppageMinutes: state.config.stoppageTime.enabled
      ? state.stoppageMinutes
      : null,
  }
}

/** `state` with both stacks replaced; an empty `future` is left out. */
function withStacks(
  state: FootballState,
  history: UndoEntry[],
  future: UndoEntry[],
): FootballState {
  const next = withoutFuture({ ...state, history })
  return future.length > 0 ? { ...next, future } : next
}

/**
 * Applies the newest entry of one stack and moves its inverse onto the other:
 * undo takes from `history` and gives to `future`, redo the reverse. A
 * dropped entry is only removed.
 */
function step(
  state: FootballState,
  from: 'history' | 'future',
  at: number,
): FootballState {
  const stacks = { history: state.history ?? [], future: state.future ?? [] }
  const entry = stacks[from].at(-1)
  if (!entry) return state
  stacks[from] = stacks[from].slice(0, -1)
  const applied = applyEntry(state, entry, at)
  if (!applied) return withStacks(state, stacks.history, stacks.future)
  const to = from === 'history' ? 'future' : 'history'
  stacks[to] = [...stacks[to], applied.inverse].slice(-MAX_HISTORY)
  return withinConfig(withStacks(applied.state, stacks.history, stacks.future))
}

/** Reverts the most recent undoable step. */
export const undoLast = (state: FootballState, at: number) =>
  step(state, 'history', at)

/** Reapplies the most recently undone step. */
export const redoLast = (state: FootballState, at: number) =>
  step(state, 'future', at)
