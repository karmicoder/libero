import { describe, expect, it } from 'vitest'
import { defaultMatchConfig } from './config'
import { clockControl, clockSeconds, displayedSeconds } from './clock'
import type { FootballState } from './state'

const state = (patch: Partial<FootballState> = {}): FootballState => ({
  config: defaultMatchConfig(),
  clock: { baseSeconds: 0, runningSince: null },
  periodId: 'h1',
  stoppageMinutes: null,
  teams: {
    visitor: { name: 'Visitor', score: 0 },
    home: { name: 'Home', score: 0 },
  },
  events: [],
  nextEventId: 1,
  ...patch,
})

describe('clockSeconds', () => {
  it('returns the base while stopped', () => {
    expect(clockSeconds({ baseSeconds: 90, runningSince: null }, 999_999)).toBe(
      90,
    )
  })

  it('adds elapsed time while running', () => {
    expect(
      clockSeconds({ baseSeconds: 60, runningSince: 1_000 }, 1_000 + 2_500),
    ).toBe(62.5)
  })

  it('runs past the period length without stopping', () => {
    const clock = { baseSeconds: 105 * 60, runningSince: 0 }
    expect(displayedSeconds(clock, 37_900)).toBe(105 * 60 + 37)
  })

  it('never goes negative if now is behind runningSince', () => {
    expect(clockSeconds({ baseSeconds: 5, runningSince: 10_000 }, 0)).toBe(5)
  })
})

describe('displayedSeconds', () => {
  it('floors to whole seconds', () => {
    expect(displayedSeconds({ baseSeconds: 0.9, runningSince: null }, 0)).toBe(
      0,
    )
    expect(displayedSeconds({ baseSeconds: 59, runningSince: 0 }, 1_999)).toBe(
      60,
    )
  })
})

describe('clockControl', () => {
  const now = 10_000

  it('is start at the beginning of a play period', () => {
    expect(clockControl(state(), now)).toEqual({ kind: 'start' })
    expect(
      clockControl(
        state({
          periodId: 'h2',
          clock: { baseSeconds: 45 * 60, runningSince: null },
        }),
        now,
      ),
    ).toEqual({ kind: 'start' })
  })

  it('is resume when stopped mid-period', () => {
    expect(
      clockControl(
        state({ clock: { baseSeconds: 600, runningSince: null } }),
        now,
      ),
    ).toEqual({ kind: 'resume' })
  })

  it('is pause while running', () => {
    expect(
      clockControl(state({ clock: { baseSeconds: 0, runningSince: 1 } }), now),
    ).toEqual({ kind: 'pause' })
  })

  it('starts the next play period from a break', () => {
    const c = clockControl(state({ periodId: 'ht' }), now)
    expect(c).toMatchObject({ kind: 'start-next' })
    expect(c.kind === 'start-next' && c.period.id).toBe('h2')
  })

  it('is disabled in a shootout, or a break with no play period after it', () => {
    expect(clockControl(state({ periodId: 'pen' }), now)).toEqual({
      kind: 'disabled',
    })
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
    expect(clockControl(state({ config, periodId: 'b' }), now)).toEqual({
      kind: 'disabled',
    })
  })
})
