import { describe, expect, it } from 'vitest'
import { clockSeconds, displayedSeconds } from '../clock'
import { defaultMatchConfig } from '../config'
import type { FootballAction, FootballState } from '../state'
import { footballEngine } from './football'
import { MAX_HISTORY } from './undo'

const T0 = 1_000_000

function run(state: FootballState, ...actions: FootballAction[]) {
  return actions.reduce((s, a) => footballEngine.reduce(s, a).state, state)
}

const fresh = () => footballEngine.initialState(defaultMatchConfig())
const undo = (at = T0): FootballAction => ({ type: 'undo', at })
const goal = (team: 'home' | 'visitor', at = T0): FootballAction => ({
  type: 'goal',
  team,
  at,
})
const lastLabel = (s: FootballState) => s.history?.at(-1)?.label

describe('undo', () => {
  it('does nothing with an empty history', () => {
    const s = fresh()
    expect(run(s, undo())).toBe(s)
  })

  describe('goals', () => {
    it('removes the goal and its point', () => {
      const s = run(fresh(), goal('home'), undo())
      expect(s.teams.home.score).toBe(0)
      expect(s.events).toEqual([])
    })

    it('undoes a goal together with the details added to it', () => {
      const s = run(
        fresh(),
        goal('home'),
        { type: 'set-goal-details', eventId: 'e1', scorer: 9, at: T0 },
        undo(),
      )
      expect(s.teams.home.score).toBe(0)
      expect(s.events).toEqual([])
      expect(s.history).toEqual([])
    })

    it('goes back one step at a time, newest first', () => {
      const s = run(fresh(), goal('home'), goal('visitor'), goal('home'))
      expect(run(s, undo()).teams).toMatchObject({
        home: { score: 1 },
        visitor: { score: 1 },
      })
      expect(run(s, undo(), undo()).teams).toMatchObject({
        home: { score: 1 },
        visitor: { score: 0 },
      })
    })

    it('never reuses an event id', () => {
      const s = run(fresh(), goal('home'), undo(), goal('home'))
      expect(s.events.map((e) => e.id)).toEqual(['e2'])
    })

    it('puts a removed goal back where it was', () => {
      const s = run(
        fresh(),
        goal('home'),
        goal('visitor'),
        { type: 'remove-goal', team: 'home' },
        undo(),
      )
      expect(s.events.map((e) => [e.id, e.team])).toEqual([
        ['e1', 'home'],
        ['e2', 'visitor'],
      ])
      expect(s.teams.home.score).toBe(1)
    })

    it('puts back the point of a goal that had no event', () => {
      const scoreOnly = {
        ...run(fresh(), goal('home')),
        events: [],
      } satisfies FootballState
      const s = run(scoreOnly, { type: 'remove-goal', team: 'home' }, undo())
      expect(s.teams.home.score).toBe(1)
    })
  })

  describe('with the clock running', () => {
    it('keeps the clock running and does not roll it back', () => {
      const running = run(fresh(), { type: 'start-clock', at: T0 })
      const s = run(running, goal('home', T0 + 30_000), undo(T0 + 40_000))
      expect(s.teams.home.score).toBe(0)
      expect(s.clock).toEqual(running.clock)
      expect(displayedSeconds(s.clock, T0 + 40_000)).toBe(40)
    })

    it('keeps a paused clock paused', () => {
      const paused = run(
        fresh(),
        { type: 'start-clock', at: T0 },
        { type: 'stop-clock', at: T0 + 10_000 },
      )
      const s = run(paused, goal('home', T0 + 20_000), undo(T0 + 30_000))
      expect(s.clock).toEqual(paused.clock)
    })

    it('does not undo starting or stopping the clock', () => {
      const s = run(
        fresh(),
        goal('home'),
        { type: 'start-clock', at: T0 },
        { type: 'stop-clock', at: T0 + 5_000 },
        undo(T0 + 6_000),
      )
      expect(s.teams.home.score).toBe(0)
      expect(s.clock.baseSeconds).toBe(5)
    })
  })

  describe('cards', () => {
    it('removes every event the card action added', () => {
      const s = run(
        fresh(),
        { type: 'card', team: 'home', color: 'yellow', numbers: [7], at: T0 },
        {
          type: 'card',
          team: 'home',
          color: 'yellow',
          numbers: [7, 8],
          at: T0,
        },
        undo(),
      )
      // Both a second yellow (#7) and a plain yellow (#8) went; the first yellow stays.
      expect(
        s.events.map((e) => [e.type, 'numbers' in e && e.numbers]),
      ).toEqual([['card', [7]]])
    })
  })

  describe('substitutions', () => {
    const sub: FootballAction = {
      type: 'substitution',
      team: 'home',
      pairs: [{ off: 1, on: 12 }, { off: 2 }],
      at: T0,
    }

    it('removes the event and gives the substitutions back', () => {
      const before = fresh()
      const s = run(before, sub, undo())
      expect(s.events).toEqual([])
      expect(s.subsRemaining).toEqual(before.subsRemaining)
    })

    it('restores a count that had been clamped at 0', () => {
      const one = { ...fresh(), subsRemaining: { visitor: 5, home: 1 } }
      const s = run(one, sub, undo())
      expect(s.subsRemaining.home).toBe(1)
    })

    it('does not carry old counts into a later period', () => {
      const s = run(
        fresh(),
        sub,
        { type: 'set-period', periodId: 'ht', at: T0 },
        { type: 'start-clock', at: T0 },
      )
      // Undo the period change twice over (start, then set-period), then the sub.
      const afterPeriods = run(s, undo(), undo())
      expect(afterPeriods.periodId).toBe('h1')
      // Now back in the period of the sub: its count is restored.
      expect(run(afterPeriods, undo()).subsRemaining.home).toBe(5)

      // Had the period moved on without history, the new period's count stays.
      const moved = {
        ...run(fresh(), sub),
        periodId: 'h2',
        subsRemaining: { visitor: 5, home: 5 },
      }
      expect(run(moved, undo()).subsRemaining.home).toBe(5)
      expect(run(moved, undo()).events).toEqual([])
    })
  })

  describe('manual corrections', () => {
    it('undoes a manual pip change', () => {
      const s = run(
        fresh(),
        { type: 'set-subs-remaining', team: 'home', remaining: 2 },
        undo(),
      )
      expect(s.subsRemaining.home).toBe(5)
    })

    it('undoes stoppage time', () => {
      const s = run(fresh(), { type: 'set-stoppage', minutes: 4 })
      expect(s.stoppageMinutes).toBe(4)
      expect(run(s, undo()).stoppageMinutes).toBeNull()
    })
  })

  describe('clock and period', () => {
    it('undoes set-clock while paused', () => {
      const s = run(
        fresh(),
        { type: 'set-clock', minutes: 30, seconds: 0, at: T0 },
        undo(),
      )
      expect(s.clock).toEqual({ baseSeconds: 0, runningSince: null })
    })

    it('undoes set-clock while running, which keeps running', () => {
      const running = run(fresh(), { type: 'start-clock', at: T0 })
      // At 10s the scorer sets 30:00; ten seconds later they undo.
      const s = run(
        running,
        { type: 'set-clock', minutes: 30, seconds: 0, at: T0 + 10_000 },
        undo(T0 + 20_000),
      )
      expect(s.clock.runningSince).toBe(T0 + 20_000)
      // 10s before the change, plus the ten that have passed since.
      expect(clockSeconds(s.clock, T0 + 20_000)).toBe(20)
    })

    it('undoes a period change, restoring period, time and counts', () => {
      const playing = run(
        fresh(),
        { type: 'set-clock', minutes: 44, seconds: 0, at: T0 },
        { type: 'substitution', team: 'home', pairs: [{}], at: T0 },
        { type: 'set-stoppage', minutes: 2 },
        { type: 'set-period', periodId: 'ht', at: T0 },
      )
      const s = run(playing, undo())
      expect(s.periodId).toBe('h1')
      expect(s.clock).toEqual({ baseSeconds: 44 * 60, runningSince: null })
      expect(s.stoppageMinutes).toBe(2)
      expect(s.subsRemaining.home).toBe(4)
    })

    it('undoes the period entered by starting after a break', () => {
      const atBreak = run(fresh(), {
        type: 'set-period',
        periodId: 'ht',
        at: T0,
      })
      const s = run(atBreak, { type: 'start-clock', at: T0 + 1000 })
      expect(s.periodId).toBe('h2')
      const back = run(s, undo(T0 + 2000))
      expect(back.periodId).toBe('ht')
      expect(back.clock.runningSince).toBeNull()
    })

    it('goal in the first half, break, start, undo: the second half is intact', () => {
      const s = run(
        fresh(),
        goal('home'),
        { type: 'set-period', periodId: 'ht', at: T0 },
        { type: 'start-clock', at: T0 },
        { type: 'substitution', team: 'visitor', pairs: [{}], at: T0 },
        undo(),
      )
      expect(s.periodId).toBe('h2')
      expect(s.subsRemaining).toEqual({ visitor: 5, home: 5 })
      expect(s.teams.home.score).toBe(1)
    })
  })

  describe('what is not undoable', () => {
    it('leaves team names alone and does not record them', () => {
      const s = run(
        fresh(),
        goal('home'),
        { type: 'set-team-name', team: 'home', name: 'United' },
        undo(),
      )
      expect(s.teams.home).toEqual({ name: 'United', score: 0 })
    })

    it('does not record no-op actions', () => {
      const s = run(
        fresh(),
        { type: 'stop-clock', at: T0 },
        { type: 'substitution', team: 'home', pairs: [], at: T0 },
        { type: 'remove-goal', team: 'home' },
        { type: 'set-stoppage', minutes: null },
      )
      expect(s.history ?? []).toEqual([])
    })
  })

  describe('history', () => {
    it('labels the most recent step', () => {
      expect(lastLabel(run(fresh(), goal('home')))).toBe('Goal')
      expect(
        lastLabel(
          run(fresh(), {
            type: 'card',
            team: 'home',
            color: 'red',
            numbers: [3],
            at: T0,
          }),
        ),
      ).toBe('Red card')
      expect(
        lastLabel(
          run(fresh(), {
            type: 'substitution',
            team: 'home',
            pairs: [{}],
            at: T0,
          }),
        ),
      ).toBe('Substitution')
      expect(
        lastLabel(run(fresh(), { type: 'remove-goal', team: 'home' })),
      ).toBeUndefined()
    })

    it('keeps the last 30 steps', () => {
      const goals = Array.from({ length: MAX_HISTORY + 5 }, () => goal('home'))
      const s = run(fresh(), ...goals)
      expect(s.history).toHaveLength(MAX_HISTORY)
      // The oldest five can no longer be undone.
      const undone = run(s, ...Array.from({ length: 40 }, () => undo()))
      expect(undone.teams.home.score).toBe(5)
    })

    it('survives a JSON round-trip', () => {
      const s = run(fresh(), goal('home'), goal('visitor'))
      const back = JSON.parse(JSON.stringify(s)) as FootballState
      expect(run(back, undo()).teams.visitor.score).toBe(0)
    })

    it('drops an entry of an unknown kind instead of crashing', () => {
      const s = {
        ...fresh(),
        history: [{ label: 'Mystery', kind: 'mystery' }],
      } as unknown as FootballState
      const { state } = footballEngine.reduce(s, undo())
      expect(state.history).toEqual([])
    })

    it('emits no notices', () => {
      const s = run(fresh(), goal('home'))
      expect(footballEngine.reduce(s, undo()).messages).toEqual([])
    })
  })
})

describe('undo after a config change', () => {
  it('drops a period change whose old period was removed', () => {
    const moved = run(fresh(), { type: 'set-period', periodId: 'h2', at: T0 })
    const config = defaultMatchConfig()
    config.periods = config.periods.filter((p) => p.id !== 'h1')
    const edited = run(moved, { type: 'update-config', config })
    const undone = run(edited, undo())
    expect(undone.periodId).toBe('h2')
    expect(undone.history).toEqual([])
  })
})

describe('undo clamps to the current config', () => {
  it('does not restore more substitutions than the new limit', () => {
    const subbed = run(fresh(), {
      type: 'substitution',
      team: 'home',
      pairs: [{ off: 1, on: 12 }],
      at: T0,
    })
    const config = defaultMatchConfig()
    config.substitutions.perPeriod = 3
    const undone = run(subbed, { type: 'update-config', config }, undo())
    expect(undone.subsRemaining.home).toBe(3)
  })
})
