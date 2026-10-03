import { describe, expect, it } from 'vitest'
import { displayedSeconds } from '../clock'
import { defaultMatchConfig } from '../config'
import type { FootballAction, FootballState } from '../state'
import { footballEngine } from './football'

const T0 = 1_000_000

function run(state: FootballState, ...actions: FootballAction[]) {
  return actions.reduce((s, a) => footballEngine.reduce(s, a).state, state)
}

const fresh = () => footballEngine.initialState(defaultMatchConfig())

describe('initialState', () => {
  it('starts in the first period with a stopped clock at 0', () => {
    const s = fresh()
    expect(s.periodId).toBe('h1')
    expect(s.clock).toEqual({ baseSeconds: 0, runningSince: null })
    expect(s.stoppageMinutes).toBeNull()
    expect(s.teams.visitor.score).toBe(0)
    expect(s.teams.home.score).toBe(0)
    expect(s.events).toEqual([])
  })
})

describe('start-clock', () => {
  it('starts the clock', () => {
    const s = run(fresh(), { type: 'start-clock', at: T0 })
    expect(s.clock).toEqual({ baseSeconds: 0, runningSince: T0 })
  })

  it('does nothing when already running', () => {
    const running = run(fresh(), { type: 'start-clock', at: T0 })
    expect(run(running, { type: 'start-clock', at: T0 + 5000 })).toEqual(
      running,
    )
  })

  it('does nothing in a shootout', () => {
    const s = run(fresh(), { type: 'set-period', periodId: 'pen', at: T0 })
    expect(run(s, { type: 'start-clock', at: T0 })).toEqual(s)
  })

  it('advances from a break to the next play period and starts it', () => {
    const ht = run(fresh(), { type: 'set-period', periodId: 'ht', at: T0 })
    const s = run(ht, { type: 'start-clock', at: T0 + 1000 })
    expect(s.periodId).toBe('h2')
    expect(s.clock).toEqual({ baseSeconds: 45 * 60, runningSince: T0 + 1000 })
  })

  it('does nothing from a break with no later play period', () => {
    const config = {
      ...defaultMatchConfig(),
      periods: [
        {
          id: 'p',
          name: 'P',
          abbreviation: 'P',
          lengthMinutes: 10,
          kind: 'play' as const,
        },
        { id: 'b', name: 'B', abbreviation: 'B', kind: 'break' as const },
      ],
    }
    const s = run(footballEngine.initialState(config), {
      type: 'set-period',
      periodId: 'b',
      at: T0,
    })
    expect(run(s, { type: 'start-clock', at: T0 })).toEqual(s)
  })
})

describe('stop-clock', () => {
  it('freezes the clock at the elapsed time', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      { type: 'stop-clock', at: T0 + 90_000 },
    )
    expect(s.clock).toEqual({ baseSeconds: 90, runningSince: null })
  })

  it('does nothing when already stopped', () => {
    const s = fresh()
    expect(run(s, { type: 'stop-clock', at: T0 })).toEqual(s)
  })

  it('keeps sub-second time across start/stop cycles', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      { type: 'stop-clock', at: T0 + 400 },
      { type: 'start-clock', at: T0 + 10_000 },
      { type: 'stop-clock', at: T0 + 10_700 },
    )
    expect(s.clock.baseSeconds).toBeCloseTo(1.1)
    expect(displayedSeconds(s.clock, T0 + 99_999)).toBe(1)
  })
})

describe('set-clock', () => {
  it('sets mm:ss', () => {
    const s = run(fresh(), {
      type: 'set-clock',
      minutes: 12,
      seconds: 34,
      at: T0,
    })
    expect(s.clock).toEqual({ baseSeconds: 12 * 60 + 34, runningSince: null })
  })

  it('clamps seconds to 59 and floors negatives at 0', () => {
    expect(
      run(fresh(), { type: 'set-clock', minutes: 1, seconds: 75, at: T0 }).clock
        .baseSeconds,
    ).toBe(60 + 59)
    expect(
      run(fresh(), { type: 'set-clock', minutes: -3, seconds: -1, at: T0 })
        .clock.baseSeconds,
    ).toBe(0)
  })

  it('re-bases a running clock to the time of the action', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      { type: 'set-clock', minutes: 30, seconds: 0, at: T0 + 5000 },
    )
    expect(s.clock).toEqual({ baseSeconds: 1800, runningSince: T0 + 5000 })
  })

  it('does nothing in a shootout', () => {
    const s = run(fresh(), { type: 'set-period', periodId: 'pen', at: T0 })
    expect(
      run(s, { type: 'set-clock', minutes: 5, seconds: 0, at: T0 }),
    ).toEqual(s)
  })

  it('lets the display run past the period length', () => {
    const s = run(
      fresh(),
      { type: 'set-period', periodId: 'et2', at: T0 },
      { type: 'set-clock', minutes: 105, seconds: 0, at: T0 },
      { type: 'start-clock', at: T0 },
    )
    expect(displayedSeconds(s.clock, T0 + 37_000)).toBe(105 * 60 + 37)
  })
})

describe('set-period', () => {
  it('moves to a play period at its offset with the clock stopped', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      { type: 'set-period', periodId: 'et1', at: T0 + 1000 },
    )
    expect(s.periodId).toBe('et1')
    expect(s.clock).toEqual({ baseSeconds: 90 * 60, runningSince: null })
  })

  it('stops the clock in place on a break', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      { type: 'set-period', periodId: 'ht', at: T0 + 60_000 },
    )
    expect(s.periodId).toBe('ht')
    expect(s.clock).toEqual({ baseSeconds: 60, runningSince: null })
  })

  it('stops the clock in place on a shootout', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      { type: 'set-period', periodId: 'pen', at: T0 + 60_000 },
    )
    expect(s.clock).toEqual({ baseSeconds: 60, runningSince: null })
  })

  it('clears stoppage time', () => {
    const s = run(
      { ...fresh(), stoppageMinutes: 4 },
      {
        type: 'set-period',
        periodId: 'h2',
        at: T0,
      },
    )
    expect(s.stoppageMinutes).toBeNull()
  })

  it('ignores unknown periods and the current period', () => {
    const running = run(fresh(), { type: 'start-clock', at: T0 })
    expect(
      run(running, { type: 'set-period', periodId: 'nope', at: T0 + 1 }),
    ).toEqual(running)
    expect(
      run(running, { type: 'set-period', periodId: 'h1', at: T0 + 1 }),
    ).toEqual(running)
  })

  it('uses offsets from a custom period list', () => {
    const config = {
      ...defaultMatchConfig(),
      periods: [
        {
          id: 'a',
          name: 'A',
          abbreviation: 'A',
          lengthMinutes: 20,
          kind: 'play' as const,
        },
        {
          id: 'b',
          name: 'B',
          abbreviation: 'B',
          lengthMinutes: 5,
          kind: 'break' as const,
        },
        {
          id: 'c',
          name: 'C',
          abbreviation: 'C',
          lengthMinutes: 20,
          kind: 'play' as const,
        },
      ],
    }
    const s = run(footballEngine.initialState(config), {
      type: 'set-period',
      periodId: 'c',
      at: T0,
    })
    expect(s.clock.baseSeconds).toBe(20 * 60)
  })
})

describe('reduce', () => {
  it('returns no messages for clock actions', () => {
    expect(
      footballEngine.reduce(fresh(), { type: 'start-clock', at: T0 }).messages,
    ).toEqual([])
  })

  it('keeps state serialisable', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      { type: 'set-period', periodId: 'ht', at: T0 + 500 },
      { type: 'start-clock', at: T0 + 1000 },
    )
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})
