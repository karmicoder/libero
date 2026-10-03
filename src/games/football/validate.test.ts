import { describe, expect, it } from 'vitest'
import { defaultMatchConfig } from './config'
import type { FootballState } from './state'
import { isFootballState } from './validate'

const valid = (): FootballState => ({
  config: defaultMatchConfig(),
  clock: { baseSeconds: 12, runningSince: 1_000 },
  periodId: 'h1',
  stoppageMinutes: null,
  teams: {
    visitor: { name: 'Visitor', score: 0 },
    home: { name: 'Home', score: 1 },
  },
  subsRemaining: { visitor: 3, home: 3 },
  events: [],
  nextEventId: 1,
})

describe('isFootballState', () => {
  it('accepts valid state, including after a JSON round-trip', () => {
    expect(isFootballState(valid())).toBe(true)
    expect(isFootballState(JSON.parse(JSON.stringify(valid())))).toBe(true)
  })

  it('rejects non-objects and incomplete state', () => {
    expect(isFootballState(null)).toBe(false)
    expect(isFootballState('x')).toBe(false)
    expect(isFootballState({})).toBe(false)
    expect(isFootballState({ ...valid(), events: undefined })).toBe(false)
    expect(isFootballState({ ...valid(), nextEventId: undefined })).toBe(false)
    // A backup from before substitutions were tracked in state.
    expect(isFootballState({ ...valid(), subsRemaining: undefined })).toBe(
      false,
    )
  })

  it('rejects a mistyped clock or teams', () => {
    expect(isFootballState({ ...valid(), clock: { baseSeconds: '0' } })).toBe(
      false,
    )
    expect(
      isFootballState({ ...valid(), teams: { home: valid().teams.home } }),
    ).toBe(false)
  })
})
