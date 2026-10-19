import { configProblems } from './config'
import type { VolleyballConfig, VolleyballState } from './state'

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isSide = (v: unknown) => v === 'visitor' || v === 'home'

const isStatus = (v: unknown) => v === 'in-play' || v === 'finished'

const isPoints = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0

const isScore = (v: unknown) =>
  isObject(v) && isPoints(v.visitor) && isPoints(v.home)

const isClosedSet = (v: unknown) =>
  isScore(v) && isSide((v as { firstServer: unknown }).firstServer)

const isSnapshot = (v: unknown) =>
  isObject(v) &&
  Array.isArray(v.completed) &&
  v.completed.every(isClosedSet) &&
  isScore(v.current) &&
  isSide(v.firstServer) &&
  isSide(v.serving) &&
  isStatus(v.status) &&
  typeof v.label === 'string'

const isTeam = (v: unknown) => isObject(v) && typeof v.name === 'string'

/**
 * Structural check for state read back from storage. It covers what the
 * reducer and views dereference.
 */
export function isVolleyballState(value: unknown): value is VolleyballState {
  if (!isObject(value)) return false
  const { config, teams } = value
  return (
    isObject(config) &&
    configProblems(config as unknown as VolleyballConfig).length === 0 &&
    isObject(teams) &&
    isTeam(teams.visitor) &&
    isTeam(teams.home) &&
    Array.isArray(value.completed) &&
    value.completed.every(isClosedSet) &&
    isScore(value.current) &&
    isSide(value.firstServer) &&
    isSide(value.serving) &&
    isStatus(value.status) &&
    (value.history === undefined ||
      (Array.isArray(value.history) && value.history.every(isSnapshot)))
  )
}
