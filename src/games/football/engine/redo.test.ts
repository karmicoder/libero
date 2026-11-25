import { describe, expect, it } from 'vitest'
import { clockSeconds } from '../clock'
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
const redo = (at = T0): FootballAction => ({ type: 'redo', at })
const goal = (team: 'home' | 'visitor', at = T0): FootballAction => ({
  type: 'goal',
  team,
  at,
})

describe('redo', () => {
  it('does nothing with nothing undone', () => {
    const s = run(fresh(), goal('home'))
    expect(run(s, redo())).toBe(s)
  })

  it('emits no notices', () => {
    const s = run(fresh(), goal('home'), undo())
    expect(footballEngine.reduce(s, redo()).messages).toEqual([])
  })

  // Each case is a state reached by an undoable step, with the clock stopped.
  const cases: [string, FootballState][] = [
    ['a goal', run(fresh(), goal('home'))],
    [
      'a goal with details',
      run(fresh(), goal('home'), {
        type: 'set-goal-details',
        eventId: 'e1',
        scorer: 9,
        assist: 7,
        at: T0,
      }),
    ],
    [
      'a removed goal',
      run(fresh(), goal('home'), goal('visitor'), {
        type: 'remove-goal',
        team: 'home',
      }),
    ],
    [
      'a removed point that had no logged goal',
      run(
        { ...run(fresh(), goal('home')), events: [], history: [] },
        { type: 'remove-goal', team: 'home' },
      ),
    ],
    [
      'a second yellow shown with another yellow',
      run(
        fresh(),
        { type: 'card', team: 'home', color: 'yellow', numbers: [7], at: T0 },
        goal('visitor'),
        {
          type: 'card',
          team: 'home',
          color: 'yellow',
          numbers: [7, 8],
          at: T0,
        },
      ),
    ],
    [
      'a substitution',
      run(fresh(), {
        type: 'substitution',
        team: 'home',
        pairs: [{ off: 1, on: 12 }, { off: 2 }],
        at: T0,
      }),
    ],
    [
      'a manual pip change',
      run(fresh(), { type: 'set-subs-remaining', team: 'home', remaining: 2 }),
    ],
    ['stoppage time', run(fresh(), { type: 'set-stoppage', minutes: 3 })],
    [
      'set-clock',
      run(fresh(), { type: 'set-clock', minutes: 30, seconds: 5, at: T0 }),
    ],
    [
      'a period change',
      run(
        fresh(),
        { type: 'set-clock', minutes: 44, seconds: 0, at: T0 },
        { type: 'substitution', team: 'home', pairs: [{}], at: T0 },
        { type: 'set-stoppage', minutes: 2 },
        { type: 'set-period', periodId: 'ht', at: T0 },
      ),
    ],
  ]

  it.each(cases)('restores the exact pre-undo state after %s', (_, before) => {
    const undone = run(before, undo())
    expect(undone).not.toEqual(before)
    expect(run(undone, redo())).toEqual(before)
  })

  it('names the step it would redo with the label it was undone under', () => {
    const s = run(fresh(), goal('home'), { type: 'remove-goal', team: 'home' })
    const undone = run(s, undo())
    expect(undone.future?.at(-1)?.label).toBe('Remove goal')
    expect(run(undone, redo()).history?.at(-1)?.label).toBe('Remove goal')
  })

  it('walks forward through several undone steps, oldest first', () => {
    const before = run(
      fresh(),
      goal('home'),
      { type: 'card', team: 'visitor', color: 'red', numbers: [4], at: T0 },
      { type: 'set-stoppage', minutes: 2 },
      goal('visitor'),
    )
    const undone = run(before, undo(), undo(), undo(), undo())
    expect(undone.teams.home.score).toBe(0)
    expect(run(undone, redo()).teams.home.score).toBe(1)
    expect(run(undone, redo(), redo(), redo(), redo())).toEqual(before)
    // Extra presses past the end do nothing.
    expect(run(undone, redo(), redo(), redo(), redo(), redo())).toEqual(before)
  })

  it('can undo a redone step again', () => {
    const before = run(fresh(), goal('home'))
    const s = run(before, undo(), redo(), undo())
    expect(s.teams.home.score).toBe(0)
    expect(run(s, redo())).toEqual(before)
  })

  it('is cleared by a new undoable step', () => {
    const s = run(fresh(), goal('home'), undo(), goal('visitor'))
    expect(s.future).toBeUndefined()
    expect(run(s, redo())).toBe(s)
  })

  it('survives steps that are not undoable', () => {
    const s = run(
      fresh(),
      goal('home'),
      undo(),
      { type: 'set-team-name', team: 'home', name: 'United' },
      { type: 'start-clock', at: T0 },
      { type: 'stop-clock', at: T0 + 5_000 },
      redo(T0 + 6_000),
    )
    expect(s.teams.home).toEqual({ name: 'United', score: 1 })
    expect(s.clock.baseSeconds).toBe(5)
  })

  it('keeps redo of set-clock relative, like undo', () => {
    const s = run(
      fresh(),
      { type: 'set-clock', minutes: 30, seconds: 0, at: T0 },
      undo(T0),
      { type: 'start-clock', at: T0 },
      redo(T0 + 10_000),
    )
    // 10s of play since the undo, then the 30:00 jump put back on top.
    expect(s.clock).toEqual({
      baseSeconds: 30 * 60 + 10,
      runningSince: T0 + 10_000,
    })
  })

  it('re-enters a period with its clock stopped', () => {
    const s = run(
      fresh(),
      { type: 'set-period', periodId: 'ht', at: T0 },
      { type: 'start-clock', at: T0 },
    )
    expect(s.periodId).toBe('h2')
    const back = run(s, undo(T0 + 10_000))
    expect(back.periodId).toBe('ht')
    const again = run(back, redo(T0 + 20_000))
    expect(again.periodId).toBe('h2')
    // Ten seconds into the second half when it was undone.
    expect(again.clock).toEqual({
      baseSeconds: clockSeconds(s.clock, T0 + 10_000),
      runningSince: null,
    })
    expect(again.clock.baseSeconds).toBe(s.clock.baseSeconds + 10)
  })

  it('keeps the last 30 undone steps', () => {
    const goals = Array.from({ length: MAX_HISTORY }, () => goal('home'))
    const s = run(fresh(), ...goals)
    const undone = run(s, ...Array.from({ length: MAX_HISTORY }, () => undo()))
    expect(undone.future).toHaveLength(MAX_HISTORY)
    expect(undone.history).toEqual([])
  })

  it('survives a JSON round-trip', () => {
    const before = run(fresh(), goal('home'), goal('visitor'))
    const undone = JSON.parse(
      JSON.stringify(run(before, undo())),
    ) as FootballState
    expect(run(undone, redo())).toEqual(before)
  })

  it('drops an entry of an unknown kind instead of crashing', () => {
    const s = {
      ...fresh(),
      future: [{ label: 'Mystery', kind: 'mystery' }],
    } as unknown as FootballState
    const { state } = footballEngine.reduce(s, redo())
    expect(state.future).toBeUndefined()
    expect(state.history ?? []).toEqual([])
  })

  it('drops a period change whose period was removed', () => {
    const s = run(
      fresh(),
      { type: 'set-period', periodId: 'h2', at: T0 },
      undo(),
    )
    const config = defaultMatchConfig()
    config.periods = config.periods.filter((p) => p.id !== 'h2')
    const edited = run(s, { type: 'update-config', config })
    const redone = run(edited, redo())
    expect(redone.periodId).toBe('h1')
    expect(redone.future).toBeUndefined()
  })

  it('restores a manual raise above the limit, and leaves it alone otherwise', () => {
    const config = defaultMatchConfig()
    config.substitutions.perPeriod = 3
    const raised = run(footballEngine.initialState(config), {
      type: 'set-subs-remaining',
      team: 'home',
      remaining: 5,
    })
    expect(raised.subsRemaining.home).toBe(5)
    expect(run(raised, undo(), redo())).toEqual(raised)
    const scored = run(raised, goal('visitor'))
    expect(run(scored, undo(), redo())).toEqual(scored)
  })

  it('does not restore more substitutions than the current limit', () => {
    const s = run(
      fresh(),
      { type: 'substitution', team: 'home', pairs: [{}], at: T0 },
      undo(),
    )
    const config = defaultMatchConfig()
    config.substitutions.perPeriod = 3
    const redone = run(s, { type: 'update-config', config }, redo())
    // The 4 left after the sub, cut back to the new limit.
    expect(redone.subsRemaining.home).toBe(3)
    expect(redone.events).toHaveLength(1)
  })
})
