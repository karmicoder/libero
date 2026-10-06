import { describe, expect, it } from 'vitest'
import { defaultMatchConfig } from './config'
import type { FootballState, MatchEvent } from './state'
import { maxSubsRemaining, subLimit, subsMade, subsOverLimit } from './subs'

const sub = (
  team: 'home' | 'visitor',
  pairs: number,
  periodId = 'h1',
): MatchEvent => ({
  id: 'e',
  type: 'substitution',
  team,
  periodId,
  clockSeconds: 0,
  pairs: Array.from({ length: pairs }, () => ({})),
})

const stateWith = (
  events: MatchEvent[],
  config = defaultMatchConfig(),
): FootballState => ({
  config,
  clock: { baseSeconds: 0, runningSince: null },
  periodId: 'h1',
  stoppageMinutes: null,
  teams: {
    visitor: { name: 'Visitor', score: 0 },
    home: { name: 'Home', score: 0 },
  },
  subsRemaining: { visitor: 3, home: 3 },
  events,
  nextEventId: 1,
})

describe('subLimit / maxSubsRemaining', () => {
  it('is the per-period limit when enabled', () => {
    expect(subLimit(defaultMatchConfig())).toBe(5)
  })

  it('is undefined when disabled or unlimited', () => {
    const base = defaultMatchConfig()
    expect(
      subLimit({ ...base, substitutions: { enabled: false } }),
    ).toBeUndefined()
    expect(
      subLimit({ ...base, substitutions: { enabled: true } }),
    ).toBeUndefined()
  })

  it('allows setting up to 5, or the limit if larger', () => {
    const base = defaultMatchConfig()
    expect(maxSubsRemaining(base)).toBe(5)
    expect(
      maxSubsRemaining({
        ...base,
        substitutions: { enabled: true, perPeriod: 7 },
      }),
    ).toBe(7)
  })
})

describe('subsMade', () => {
  it('counts pairs, not events, for the team in that period', () => {
    const events = [
      sub('home', 1),
      sub('home', 3),
      sub('home', 2, 'h2'),
      sub('visitor', 1),
    ]
    expect(subsMade(events, 'home', 'h1')).toBe(4)
    expect(subsMade(events, 'home', 'h2')).toBe(2)
    expect(subsMade(events, 'visitor', 'h1')).toBe(1)
  })

  it('ignores other event types', () => {
    const goal: MatchEvent = {
      id: 'g',
      type: 'goal',
      team: 'home',
      periodId: 'h1',
      clockSeconds: 0,
    }
    expect(subsMade([goal], 'home', 'h1')).toBe(0)
  })
})

describe('subsOverLimit', () => {
  it('is false at the limit and true beyond it', () => {
    expect(subsOverLimit(stateWith([sub('home', 5)]), 'home')).toBe(false)
    expect(subsOverLimit(stateWith([sub('home', 6)]), 'home')).toBe(true)
  })

  it('looks at one team and the current period only', () => {
    const events = [sub('home', 4, 'h2'), sub('visitor', 2)]
    expect(subsOverLimit(stateWith(events), 'home')).toBe(false)
    expect(subsOverLimit(stateWith(events), 'visitor')).toBe(false)
  })

  it('is false when there is no limit', () => {
    const config = {
      ...defaultMatchConfig(),
      substitutions: { enabled: false },
    }
    expect(subsOverLimit(stateWith([sub('home', 9)], config), 'home')).toBe(
      false,
    )
  })
})
