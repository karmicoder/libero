import { describe, expect, it } from 'vitest'
import { displayedSeconds } from '../clock'
import { defaultMatchConfig } from '../config'
import type { FootballAction, FootballState } from '../state'
import { subsOverLimit } from '../subs'
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

const goal = (
  team: 'visitor' | 'home',
  at: number,
  extra: { scorer?: number; assist?: number } = {},
): FootballAction => ({ type: 'goal', team, at, ...extra })

describe('goal', () => {
  it('increments the score and logs an event with period and clock time', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      goal('home', T0 + 125_900),
    )
    expect(s.teams.home.score).toBe(1)
    expect(s.teams.visitor.score).toBe(0)
    expect(s.events).toEqual([
      {
        id: 'e1',
        type: 'goal',
        team: 'home',
        periodId: 'h1',
        clockSeconds: 125,
      },
    ])
  })

  it('gives every event a distinct id, even after a removal', () => {
    const s = run(
      fresh(),
      goal('home', T0),
      { type: 'remove-goal', team: 'home' },
      goal('home', T0),
    )
    expect(s.events.map((e) => e.id)).toEqual(['e2'])
  })

  it('records scorer and assist when given', () => {
    const s = run(fresh(), goal('visitor', T0, { scorer: 9, assist: 10 }))
    expect(s.events[0]).toMatchObject({ scorer: 9, assist: 10 })
  })

  it('drops invalid jersey numbers but still scores', () => {
    const s = run(fresh(), goal('home', T0, { scorer: 0, assist: 100 }))
    expect(s.teams.home.score).toBe(1)
    expect(s.events[0]).not.toHaveProperty('scorer')
    expect(s.events[0]).not.toHaveProperty('assist')
  })

  it('emits no messages yet', () => {
    expect(footballEngine.reduce(fresh(), goal('home', T0)).messages).toEqual(
      [],
    )
  })
})

describe('set-goal-details', () => {
  const withGoals = () =>
    run(fresh(), goal('home', T0), goal('visitor', T0), goal('home', T0))

  it('sets scorer and assist on the targeted event only', () => {
    const s = run(withGoals(), {
      type: 'set-goal-details',
      eventId: 'e1',
      scorer: 7,
      assist: 11,
    })
    expect(s.events[0]).toMatchObject({ scorer: 7, assist: 11 })
    expect(s.events[1]).not.toHaveProperty('scorer')
    expect(s.events[2]).not.toHaveProperty('scorer')
  })

  it('replaces both fields; omitted ones are cleared', () => {
    const s = run(run(fresh(), goal('home', T0, { scorer: 7, assist: 11 })), {
      type: 'set-goal-details',
      eventId: 'e1',
      scorer: 8,
    })
    expect(s.events[0]).toMatchObject({ scorer: 8 })
    expect(s.events[0]).not.toHaveProperty('assist')
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('ignores invalid numbers', () => {
    const s = run(withGoals(), {
      type: 'set-goal-details',
      eventId: 'e1',
      scorer: 100,
      assist: 0,
    })
    expect(s.events[0]).not.toHaveProperty('scorer')
    expect(s.events[0]).not.toHaveProperty('assist')
  })

  it('does nothing for an unknown event or a non-goal event', () => {
    const base = withGoals()
    expect(
      run(base, { type: 'set-goal-details', eventId: 'nope', scorer: 1 }),
    ).toEqual(base)
    const card = {
      ...base,
      events: [
        {
          id: 'c1',
          type: 'card' as const,
          team: 'home' as const,
          periodId: 'h1',
          clockSeconds: 0,
          color: 'yellow' as const,
          numbers: [4],
        },
      ],
    }
    expect(
      run(card, { type: 'set-goal-details', eventId: 'c1', scorer: 1 }),
    ).toEqual(card)
  })
})

describe('remove-goal', () => {
  it("removes the team's most recent goal and decrements its score", () => {
    const s = run(
      fresh(),
      goal('home', T0, { scorer: 1 }),
      goal('visitor', T0),
      goal('home', T0, { scorer: 2 }),
      { type: 'remove-goal', team: 'home' },
    )
    expect(s.teams.home.score).toBe(1)
    expect(s.teams.visitor.score).toBe(1)
    expect(s.events.map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('removes the last goal by log order, not by clock time', () => {
    const s = run(
      fresh(),
      { type: 'set-clock', minutes: 30, seconds: 0, at: T0 },
      goal('home', T0, { scorer: 1 }),
      { type: 'set-clock', minutes: 10, seconds: 0, at: T0 },
      goal('home', T0, { scorer: 2 }),
      { type: 'remove-goal', team: 'home' },
    )
    expect(s.events).toHaveLength(1)
    expect(s.events[0]).toMatchObject({ scorer: 1 })
  })

  it('never takes the score below 0', () => {
    const s = fresh()
    expect(run(s, { type: 'remove-goal', team: 'home' })).toEqual(s)
  })

  it('leaves other event types alone', () => {
    const base = run(fresh(), goal('home', T0))
    const card = {
      id: 'c1',
      type: 'card' as const,
      team: 'home' as const,
      periodId: 'h1',
      clockSeconds: 0,
      color: 'yellow' as const,
      numbers: [4],
    }
    const s = run(
      { ...base, events: [...base.events, card] },
      { type: 'remove-goal', team: 'home' },
    )
    expect(s.events).toEqual([card])
  })
})

describe('set-stoppage', () => {
  it('sets the announced minutes during a play period', () => {
    expect(
      run(fresh(), { type: 'set-stoppage', minutes: 4 }).stoppageMinutes,
    ).toBe(4)
  })

  it('clamps to 0-15 and floors fractions', () => {
    expect(
      run(fresh(), { type: 'set-stoppage', minutes: 99 }).stoppageMinutes,
    ).toBe(15)
    expect(
      run(fresh(), { type: 'set-stoppage', minutes: -2 }).stoppageMinutes,
    ).toBe(0)
    expect(
      run(fresh(), { type: 'set-stoppage', minutes: 3.9 }).stoppageMinutes,
    ).toBe(3)
  })

  it('clears with null', () => {
    const s = run(
      fresh(),
      { type: 'set-stoppage', minutes: 4 },
      { type: 'set-stoppage', minutes: null },
    )
    expect(s.stoppageMinutes).toBeNull()
  })

  it('does nothing outside play periods', () => {
    const ht = run(fresh(), { type: 'set-period', periodId: 'ht', at: T0 })
    expect(run(ht, { type: 'set-stoppage', minutes: 3 })).toEqual(ht)
    const pen = run(fresh(), { type: 'set-period', periodId: 'pen', at: T0 })
    expect(run(pen, { type: 'set-stoppage', minutes: 3 })).toEqual(pen)
  })

  it('does nothing when stoppage time is disabled', () => {
    const config = {
      ...defaultMatchConfig(),
      stoppageTime: { enabled: false },
    }
    const s = footballEngine.initialState(config)
    expect(run(s, { type: 'set-stoppage', minutes: 3 })).toEqual(s)
  })
})

const card = (
  team: 'visitor' | 'home',
  color: 'yellow' | 'red',
  numbers: number[],
  at = T0,
): FootballAction => ({ type: 'card', team, color, numbers, at })

describe('card', () => {
  it('records a first yellow as a yellow event with period and clock time', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      card('home', 'yellow', [4], T0 + 61_500),
    )
    expect(s.events).toEqual([
      {
        id: 'e1',
        type: 'card',
        team: 'home',
        periodId: 'h1',
        clockSeconds: 61,
        color: 'yellow',
        numbers: [4],
      },
    ])
  })

  it('escalates a second yellow to a red second-yellow event', () => {
    const s = run(
      fresh(),
      card('home', 'yellow', [4]),
      card('home', 'yellow', [4]),
    )
    expect(s.events).toHaveLength(2)
    expect(s.events[1]).toMatchObject({
      id: 'e2',
      type: 'card',
      color: 'red',
      secondYellow: true,
      numbers: [4],
    })
  })

  it('splits a mixed batch into a yellow and a second-yellow event', () => {
    const s = run(
      fresh(),
      card('home', 'yellow', [4]),
      card('home', 'yellow', [7, 4, 9]),
    )
    expect(s.events.slice(1)).toMatchObject([
      { id: 'e2', color: 'yellow', numbers: [7, 9] },
      { id: 'e3', color: 'red', secondYellow: true, numbers: [4] },
    ])
  })

  it('records a direct red as a red event without escalation flag', () => {
    const s = run(fresh(), card('visitor', 'red', [2, 5]))
    expect(s.events).toEqual([
      expect.objectContaining({
        color: 'red',
        numbers: [2, 5],
        team: 'visitor',
      }),
    ])
    expect(s.events[0]).not.toHaveProperty('secondYellow')
  })

  it('treats a yellow for an already sent-off player as a plain yellow', () => {
    const s = run(
      fresh(),
      card('home', 'red', [4]),
      card('home', 'yellow', [4]),
    )
    expect(s.events[1]).toMatchObject({ color: 'yellow', numbers: [4] })
    expect(s.events[1]).not.toHaveProperty('secondYellow')
  })

  it('keeps each team’s numbers separate', () => {
    const s = run(
      fresh(),
      card('visitor', 'yellow', [4]),
      card('home', 'yellow', [4]),
    )
    expect(s.events[1]).toMatchObject({ team: 'home', color: 'yellow' })
  })

  it('counts a repeated number in one action once', () => {
    const s = run(fresh(), card('home', 'yellow', [4, 4]))
    expect(s.events).toHaveLength(1)
    expect(s.events[0]).toMatchObject({ numbers: [4] })
  })

  it('drops invalid numbers but still records the card', () => {
    const s = run(fresh(), card('home', 'yellow', [0, 100, 7]))
    expect(s.events[0]).toMatchObject({ numbers: [7] })
  })

  it('records a card for an unidentified player with no numbers', () => {
    const s = run(fresh(), card('home', 'yellow', []))
    expect(s.events).toEqual([
      expect.objectContaining({ color: 'yellow', numbers: [] }),
    ])
  })

  it('does not change the score and emits no messages yet', () => {
    const { state, messages } = footballEngine.reduce(
      fresh(),
      card('home', 'red', [3]),
    )
    expect(state.teams.home.score).toBe(0)
    expect(messages).toEqual([])
  })

  it('shares the event id counter with goals', () => {
    const s = run(fresh(), goal('home', T0), card('home', 'yellow', [3]))
    expect(s.events.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(s.nextEventId).toBe(3)
  })

  it('keeps state serialisable', () => {
    const s = run(
      fresh(),
      card('home', 'yellow', [4]),
      card('home', 'yellow', [4]),
    )
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})

const subs = (
  team: 'visitor' | 'home',
  pairs: { off?: number; on?: number }[],
  at = T0,
): FootballAction => ({ type: 'substitution', team, pairs, at })

describe('substitution', () => {
  it('records one pair and uses one sub', () => {
    const s = run(
      fresh(),
      { type: 'start-clock', at: T0 },
      subs('home', [{ off: 3, on: 12 }], T0 + 125_000),
    )
    expect(s.events).toEqual([
      {
        id: 'e1',
        type: 'substitution',
        team: 'home',
        periodId: 'h1',
        clockSeconds: 125,
        pairs: [{ off: 3, on: 12 }],
      },
    ])
    expect(s.subsRemaining).toEqual({ visitor: 3, home: 2 })
  })

  it('records several pairs as one event using one sub each', () => {
    const s = run(
      fresh(),
      subs('visitor', [
        { off: 1, on: 13 },
        { off: 2, on: 14 },
        { off: 3, on: 15 },
      ]),
    )
    expect(s.events).toHaveLength(1)
    expect(s.events[0]).toMatchObject({
      pairs: [
        { off: 1, on: 13 },
        { off: 2, on: 14 },
        { off: 3, on: 15 },
      ],
    })
    expect(s.subsRemaining.visitor).toBe(0)
  })

  it('allows pairs without numbers', () => {
    const s = run(fresh(), subs('home', [{}]))
    expect(s.events[0]).toMatchObject({ pairs: [{}] })
    expect(s.subsRemaining.home).toBe(2)
  })

  it('drops invalid numbers but keeps the pair', () => {
    const s = run(fresh(), subs('home', [{ off: 0, on: 100 }, { off: 4 }]))
    expect(s.events[0]).toMatchObject({ pairs: [{}, { off: 4 }] })
  })

  it('does nothing with no pairs', () => {
    const s = fresh()
    expect(run(s, subs('home', []))).toEqual(s)
  })

  it('allows going over the limit, clamping remaining at 0', () => {
    const s = run(fresh(), subs('home', [{}, {}]), subs('home', [{}, {}]))
    expect(s.subsRemaining.home).toBe(0)
    expect(s.events).toHaveLength(2)
    expect(subsOverLimit(s, 'home')).toBe(true)
  })

  it('does nothing when substitutions are disabled', () => {
    const s = footballEngine.initialState({
      ...defaultMatchConfig(),
      substitutions: { enabled: false },
    })
    expect(run(s, subs('home', [{ off: 1, on: 2 }]))).toEqual(s)
  })

  it('shares the event id counter and emits no messages yet', () => {
    const { state, messages } = footballEngine.reduce(
      run(fresh(), goal('home', T0)),
      subs('home', [{}]),
    )
    expect(state.events.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(messages).toEqual([])
  })

  it('keeps state serialisable', () => {
    const s = run(fresh(), subs('home', [{ off: 1, on: 2 }]))
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})

describe('subsRemaining resets', () => {
  it('starts at the configured limit for both teams', () => {
    expect(fresh().subsRemaining).toEqual({ visitor: 3, home: 3 })
  })

  it('resets on entering a play period', () => {
    const s = run(fresh(), subs('home', [{}, {}]), {
      type: 'set-period',
      periodId: 'h2',
      at: T0,
    })
    expect(s.subsRemaining).toEqual({ visitor: 3, home: 3 })
  })

  it('resets when a break starts the next play period', () => {
    const s = run(
      fresh(),
      subs('home', [{}]),
      { type: 'set-period', periodId: 'ht', at: T0 },
      { type: 'start-clock', at: T0 },
    )
    expect(s.periodId).toBe('h2')
    expect(s.subsRemaining.home).toBe(3)
  })

  it('does not reset on a break or a shootout', () => {
    const afterBreak = run(fresh(), subs('home', [{}]), {
      type: 'set-period',
      periodId: 'ht',
      at: T0,
    })
    expect(afterBreak.subsRemaining.home).toBe(2)
    const afterPens = run(fresh(), subs('home', [{}]), {
      type: 'set-period',
      periodId: 'pen',
      at: T0,
    })
    expect(afterPens.subsRemaining.home).toBe(2)
  })

  it('uses 0 when there is no limit', () => {
    const s = footballEngine.initialState({
      ...defaultMatchConfig(),
      substitutions: { enabled: true },
    })
    expect(s.subsRemaining).toEqual({ visitor: 0, home: 0 })
  })
})

describe('set-subs-remaining', () => {
  const set = (
    team: 'visitor' | 'home',
    remaining: number,
  ): FootballAction => ({
    type: 'set-subs-remaining',
    team,
    remaining,
  })

  it('sets one team’s pips', () => {
    const s = run(fresh(), set('home', 1))
    expect(s.subsRemaining).toEqual({ visitor: 3, home: 1 })
  })

  it('clamps to 0 and to 5 (or the limit if larger), flooring fractions', () => {
    expect(run(fresh(), set('home', -2)).subsRemaining.home).toBe(0)
    expect(run(fresh(), set('home', 9)).subsRemaining.home).toBe(5)
    expect(run(fresh(), set('home', 2.9)).subsRemaining.home).toBe(2)
    const wide = footballEngine.initialState({
      ...defaultMatchConfig(),
      substitutions: { enabled: true, perPeriod: 7 },
    })
    expect(run(wide, set('home', 9)).subsRemaining.home).toBe(7)
  })

  it('does nothing when substitutions or their limit are off', () => {
    const off = footballEngine.initialState({
      ...defaultMatchConfig(),
      substitutions: { enabled: false },
    })
    expect(run(off, set('home', 2))).toEqual(off)
    const unlimited = footballEngine.initialState({
      ...defaultMatchConfig(),
      substitutions: { enabled: true },
    })
    expect(run(unlimited, set('home', 2))).toEqual(unlimited)
  })

  it('does not change the event log', () => {
    expect(run(fresh(), set('home', 1)).events).toEqual([])
  })
})

describe('set-team-name', () => {
  it('renames one team and leaves the other and the score alone', () => {
    const s = run(fresh(), goal('home', T0), {
      type: 'set-team-name',
      team: 'home',
      name: 'Reds',
    })
    expect(s.teams.home).toEqual({ name: 'Reds', score: 1 })
    expect(s.teams.visitor.name).toBe('Visitor')
  })

  it('does nothing when the name is unchanged', () => {
    const s = fresh()
    expect(run(s, { type: 'set-team-name', team: 'home', name: 'Home' })).toBe(
      s,
    )
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
