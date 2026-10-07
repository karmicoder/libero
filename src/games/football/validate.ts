import type { FootballState } from './state'

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isTeam = (v: unknown) =>
  isObject(v) && typeof v.name === 'string' && typeof v.score === 'number'

/**
 * Structural check for state read back from storage. It covers what the
 * reducer and views dereference, not every field of every event.
 */
export function isFootballState(value: unknown): value is FootballState {
  if (!isObject(value)) return false
  const { config, clock, teams } = value
  return (
    isObject(config) &&
    Array.isArray(config.periods) &&
    config.periods.every((p) => isObject(p) && typeof p.id === 'string') &&
    isObject(config.substitutions) &&
    isObject(config.stoppageTime) &&
    isObject(clock) &&
    typeof clock.baseSeconds === 'number' &&
    (clock.runningSince === null || typeof clock.runningSince === 'number') &&
    typeof value.periodId === 'string' &&
    (value.stoppageMinutes === null ||
      typeof value.stoppageMinutes === 'number') &&
    isObject(teams) &&
    isTeam(teams.visitor) &&
    isTeam(teams.home) &&
    isObject(value.subsRemaining) &&
    typeof value.subsRemaining.visitor === 'number' &&
    typeof value.subsRemaining.home === 'number' &&
    Array.isArray(value.events) &&
    typeof value.nextEventId === 'number' &&
    (value.history === undefined || Array.isArray(value.history))
  )
}
