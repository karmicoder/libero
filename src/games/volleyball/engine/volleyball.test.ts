import { describe, expect, it } from 'vitest'
import { defaultVolleyballConfig } from '../config'
import { isDecider, matchWinner, setReady, setsWon, setTarget } from '../rules'
import type {
  TeamSide,
  VolleyballAction,
  VolleyballConfig,
  VolleyballState,
} from '../state'
import { MAX_HISTORY, volleyballEngine } from './volleyball'

let clock = 1000
const at = () => (clock += 1)

function run(state: VolleyballState, ...actions: VolleyballAction[]) {
  return actions.reduce((s, a) => volleyballEngine.reduce(s, a).state, state)
}

const fresh = (config: Partial<VolleyballConfig> = {}) =>
  volleyballEngine.initialState({ ...defaultVolleyballConfig(), ...config })

const points = (team: TeamSide, n: number): VolleyballAction[] =>
  Array.from({ length: n }, () => ({ type: 'point', team, at: at() }))

const endSet = (): VolleyballAction => ({ type: 'end-set', at: at() })
const undo = (): VolleyballAction => ({ type: 'undo', at: at() })

/** A set the visitor wins 25-0 and the operator closes. */
const visitorSet = () => [...points('visitor', 25), endSet()]
const homeSet = () => [...points('home', 25), endSet()]

describe('initialState', () => {
  it('starts 0-0 in play with home serving', () => {
    const s = fresh()
    expect(s.current).toEqual({ visitor: 0, home: 0 })
    expect(s.completed).toEqual([])
    expect(s.status).toBe('in-play')
    expect(s.firstServer).toBe('home')
    expect(s.serving).toBe('home')
    expect(s.history).toBeUndefined()
  })
})

describe('point', () => {
  it('adds a point and gives the scorer the serve', () => {
    const s = run(fresh(), ...points('visitor', 1))
    expect(s.current).toEqual({ visitor: 1, home: 0 })
    expect(s.serving).toBe('visitor')
  })

  it('never ends the set by itself', () => {
    const s = run(fresh(), ...points('home', 30))
    expect(s.completed).toEqual([])
    expect(s.current.home).toBe(30)
  })

  it('announces point-scored, flagging a serve change', () => {
    const first = volleyballEngine.reduce(fresh(), {
      type: 'point',
      team: 'visitor',
      at: 5,
    })
    expect(first.messages).toEqual([
      {
        type: 'point-scored',
        id: 'point-scored@5',
        at: 5,
        team: 'visitor',
        serveChanged: true,
        score: { visitor: 1, home: 0 },
      },
    ])
    const second = volleyballEngine.reduce(first.state, {
      type: 'point',
      team: 'visitor',
      at: 6,
    })
    expect(second.messages[0]).toMatchObject({ serveChanged: false })
  })
})

describe('set readiness', () => {
  const ready = (
    home: number,
    visitor: number,
    config?: Partial<VolleyballConfig>,
  ) => setReady({ ...fresh(config), current: { home, visitor } })

  it('needs the target', () => {
    expect(ready(24, 0)).toBe(false)
    expect(ready(25, 0)).toBe(true)
  })

  it('needs a win-by lead at the target', () => {
    expect(ready(25, 24)).toBe(false)
    expect(ready(26, 24)).toBe(true)
    expect(ready(27, 26)).toBe(false)
  })

  it('ends at the cap regardless of win-by', () => {
    expect(ready(30, 29, { cap: 30 })).toBe(true)
    expect(ready(29, 28, { cap: 30 })).toBe(false)
    expect(ready(30, 30, { cap: 30 })).toBe(false)
  })

  it('uses the decider target when both sides are one set away', () => {
    const decider = fresh()
    const s = {
      ...decider,
      completed: [
        { visitor: 25, home: 0, firstServer: 'home' as const },
        { visitor: 25, home: 0, firstServer: 'visitor' as const },
        { visitor: 0, home: 25, firstServer: 'home' as const },
        { visitor: 0, home: 25, firstServer: 'visitor' as const },
      ],
    }
    expect(isDecider(s)).toBe(true)
    expect(setTarget(s)).toBe(15)
    expect(setReady({ ...s, current: { visitor: 15, home: 13 } })).toBe(true)
    expect(setReady({ ...s, current: { visitor: 14, home: 0 } })).toBe(false)
    expect(isDecider(fresh())).toBe(false)
    expect(setTarget(fresh())).toBe(25)
  })
})

describe('end-set', () => {
  it('archives the set, resets the score and alternates the first server', () => {
    const s = run(fresh(), ...visitorSet())
    expect(s.completed).toEqual([{ visitor: 25, home: 0, firstServer: 'home' }])
    expect(s.current).toEqual({ visitor: 0, home: 0 })
    expect(s.firstServer).toBe('visitor')
    expect(s.serving).toBe('visitor')
    expect(setsWon(s)).toEqual({ visitor: 1, home: 0 })
    expect(s.status).toBe('in-play')
  })

  it('alternates the first server each set', () => {
    const s = run(fresh(), ...visitorSet(), ...homeSet())
    expect(s.completed.map((c) => c.firstServer)).toEqual(['home', 'visitor'])
    expect(s.firstServer).toBe('home')
  })

  it('can end early, before the target', () => {
    const s = run(fresh(), ...points('home', 3), endSet())
    expect(s.completed).toEqual([{ visitor: 0, home: 3, firstServer: 'home' }])
  })

  it('is a no-op when tied or 0-0, with no notice or snapshot', () => {
    for (const s of [
      fresh(),
      run(fresh(), ...points('home', 2), ...points('visitor', 2)),
    ]) {
      const result = volleyballEngine.reduce(s, endSet())
      expect(result.state).toBe(s)
      expect(result.messages).toEqual([])
    }
  })

  it('announces set-won', () => {
    const before = run(fresh(), ...points('visitor', 25))
    const { messages } = volleyballEngine.reduce(before, {
      type: 'end-set',
      at: 77,
    })
    expect(messages).toEqual([
      {
        type: 'set-won',
        id: 'set-won@77',
        at: 77,
        team: 'visitor',
        setNumber: 1,
        score: { visitor: 25, home: 0 },
        setsWon: { visitor: 1, home: 0 },
        matchWon: false,
      },
    ])
  })

  it('finishes the match when a side reaches setsToWin', () => {
    const before = run(
      fresh({ setsToWin: 2 }),
      ...visitorSet(),
      ...points('visitor', 25),
    )
    const { state, messages } = volleyballEngine.reduce(before, {
      type: 'end-set',
      at: 9,
    })
    expect(state.status).toBe('finished')
    expect(state.current).toEqual({ visitor: 25, home: 0 })
    expect(matchWinner(state)).toBe('visitor')
    expect(messages[0]).toMatchObject({
      type: 'set-won',
      matchWon: true,
      setNumber: 2,
    })
  })
})

describe('set-score', () => {
  it('sets an absolute score, floored and clamped, without touching serve', () => {
    const s = run(
      fresh(),
      { type: 'set-score', team: 'visitor', score: 7.9, at: at() },
      { type: 'set-score', team: 'home', score: -3, at: at() },
    )
    expect(s.current).toEqual({ visitor: 7, home: 0 })
    expect(s.serving).toBe('home')
  })

  it('ignores non-finite scores and unchanged scores', () => {
    const s = fresh()
    expect(
      run(s, { type: 'set-score', team: 'home', score: NaN, at: at() }),
    ).toBe(s)
    expect(
      run(s, { type: 'set-score', team: 'home', score: 0, at: at() }),
    ).toBe(s)
  })

  it('emits no notice', () => {
    const { messages } = volleyballEngine.reduce(fresh(), {
      type: 'set-score',
      team: 'home',
      score: 4,
      at: at(),
    })
    expect(messages).toEqual([])
  })
})

describe('set-server', () => {
  it('sets the first server while the set is 0-0', () => {
    const s = run(fresh(), { type: 'set-server', team: 'visitor' })
    expect(s.firstServer).toBe('visitor')
    expect(s.serving).toBe('visitor')
  })

  it('only changes serving once play has started', () => {
    const s = run(fresh(), ...points('home', 1), {
      type: 'set-server',
      team: 'visitor',
    })
    expect(s.serving).toBe('visitor')
    expect(s.firstServer).toBe('home')
  })

  it('is a no-op when nothing changes', () => {
    const s = fresh()
    expect(run(s, { type: 'set-server', team: 'home' })).toBe(s)
  })
})

describe('serve under rally scoring', () => {
  it('follows the scorer', () => {
    const s = run(fresh(), ...points('visitor', 1), ...points('home', 1))
    expect(s.serving).toBe('home')
  })
})

describe('undo', () => {
  it('reverts a point', () => {
    const s = run(fresh(), ...points('visitor', 2), undo())
    expect(s.current).toEqual({ visitor: 1, home: 0 })
    expect(s.serving).toBe('visitor')
    expect(s.history).toHaveLength(1)
  })

  it('is a no-op with nothing to undo', () => {
    const s = fresh()
    expect(run(s, undo())).toBe(s)
  })

  it('reopens a closed set with its score and serve', () => {
    const before = run(fresh(), ...points('visitor', 25))
    const s = run(before, endSet(), undo())
    expect(s.completed).toEqual([])
    expect(s.current).toEqual({ visitor: 25, home: 0 })
    expect(s.firstServer).toBe('home')
    expect(s.serving).toBe('visitor')
  })

  it('crosses a set boundary to undo the last point of the earlier set', () => {
    const s = run(fresh(), ...visitorSet(), undo(), undo())
    expect(s.completed).toEqual([])
    expect(s.current).toEqual({ visitor: 24, home: 0 })
  })

  it('undoes the match-winning end-set back to in-play', () => {
    const base = run(fresh({ setsToWin: 1 }), ...points('home', 25))
    const finished = run(base, endSet())
    expect(finished.status).toBe('finished')
    const s = run(finished, undo())
    expect(s.status).toBe('in-play')
    expect(s.current).toEqual({ visitor: 0, home: 25 })
    expect(s.completed).toEqual([])
  })

  it('leaves config and team names alone and does not record them', () => {
    const renamed = run(
      fresh(),
      ...points('home', 1),
      { type: 'set-team-name', team: 'home', name: 'Hawks' },
      {
        type: 'update-config',
        config: { ...defaultVolleyballConfig(), winBy: 1 },
      },
    )
    expect(renamed.history).toHaveLength(1)
    const s = run(renamed, undo())
    expect(s.teams.home.name).toBe('Hawks')
    expect(s.config.winBy).toBe(1)
    expect(s.current.home).toBe(0)
  })

  it('caps history at 30', () => {
    const s = run(fresh(), ...points('home', 40))
    expect(s.history).toHaveLength(MAX_HISTORY)
  })

  it('emits no notice', () => {
    const s = run(fresh(), ...points('home', 1))
    expect(volleyballEngine.reduce(s, undo()).messages).toEqual([])
  })
})

describe('finished state', () => {
  const finished = () =>
    run(fresh({ setsToWin: 1 }), ...points('home', 25), endSet())

  it('ignores point, set-score, set-server and end-set', () => {
    const s = finished()
    for (const action of [
      ...points('visitor', 1),
      { type: 'set-score', team: 'home', score: 3, at: at() },
      { type: 'set-server', team: 'visitor' },
      endSet(),
    ] satisfies VolleyballAction[]) {
      const result = volleyballEngine.reduce(s, action)
      expect(result.state).toBe(s)
      expect(result.messages).toEqual([])
    }
  })

  it('still allows renaming, config edits and undo', () => {
    const s = run(
      finished(),
      { type: 'set-team-name', team: 'home', name: 'Hawks' },
      {
        type: 'update-config',
        config: { ...defaultVolleyballConfig(), winBy: 1 },
      },
    )
    expect(s.teams.home.name).toBe('Hawks')
    expect(s.config.winBy).toBe(1)
    expect(s.status).toBe('finished')
  })
})

describe('update-config', () => {
  it('rejects a config with problems', () => {
    const s = fresh()
    expect(
      run(s, {
        type: 'update-config',
        config: { ...defaultVolleyballConfig(), pointsPerSet: 0 },
      }),
    ).toBe(s)
    expect(
      run(s, {
        type: 'update-config',
        config: { ...defaultVolleyballConfig(), cap: 20 },
      }),
    ).toBe(s)
  })

  it('applies mid-match and re-derives readiness', () => {
    const base = run(fresh(), ...points('home', 15))
    expect(setReady(base)).toBe(false)
    const s = run(base, {
      type: 'update-config',
      config: { ...defaultVolleyballConfig(), pointsPerSet: 15 },
    })
    expect(setReady(s)).toBe(true)
  })
})

describe('isState', () => {
  it('accepts engine state, including after JSON and with history', () => {
    const s = run(fresh({ cap: 30 }), ...visitorSet(), ...points('home', 2))
    expect(volleyballEngine.isState?.(JSON.parse(JSON.stringify(s)))).toBe(true)
    expect(volleyballEngine.isState?.(fresh())).toBe(true)
  })

  it('rejects malformed state', () => {
    const good = JSON.parse(JSON.stringify(fresh()))
    expect(volleyballEngine.isState?.(null)).toBe(false)
    expect(volleyballEngine.isState?.([])).toBe(false)
    expect(volleyballEngine.isState?.({ ...good, status: 'paused' })).toBe(
      false,
    )
    expect(volleyballEngine.isState?.({ ...good, serving: 'left' })).toBe(false)
    expect(
      volleyballEngine.isState?.({
        ...good,
        completed: [{ visitor: 1, home: 0 }],
      }),
    ).toBe(false)
    expect(
      volleyballEngine.isState?.({ ...good, teams: { home: { name: 'A' } } }),
    ).toBe(false)
    expect(volleyballEngine.isState?.({ ...good, history: [{}] })).toBe(false)
    expect(
      volleyballEngine.isState?.({ ...good, config: { setsToWin: 3 } }),
    ).toBe(false)
  })
})
