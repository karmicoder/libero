import { describe, expect, it } from 'vitest'
import { configProblems, defaultVolleyballConfig } from './config'

describe('defaultVolleyballConfig', () => {
  it('is the indoor best-of-five', () => {
    expect(defaultVolleyballConfig()).toEqual({
      setsToWin: 3,
      pointsPerSet: 25,
      deciderPoints: 15,
      winBy: 2,
    })
  })

  it('returns a fresh object each call', () => {
    expect(defaultVolleyballConfig()).not.toBe(defaultVolleyballConfig())
  })
})

describe('configProblems', () => {
  const base = defaultVolleyballConfig()

  it('accepts the defaults and a valid cap', () => {
    expect(configProblems(base)).toEqual([])
    expect(configProblems({ ...base, cap: 25 })).toEqual([])
  })

  it('rejects non-integers and values below 1', () => {
    expect(configProblems({ ...base, setsToWin: 0 })).toEqual(['sets-to-win'])
    expect(configProblems({ ...base, pointsPerSet: 2.5 })).toEqual([
      'points-per-set',
    ])
    expect(configProblems({ ...base, deciderPoints: -1 })).toEqual([
      'decider-points',
    ])
    expect(configProblems({ ...base, winBy: NaN })).toEqual(['win-by'])
  })

  it('rejects a cap below the larger target or not whole', () => {
    expect(configProblems({ ...base, cap: 24 })).toEqual(['cap'])
    expect(configProblems({ ...base, cap: 30.5 })).toEqual(['cap'])
  })
})
