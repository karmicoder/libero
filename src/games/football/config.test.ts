import { describe, expect, it } from 'vitest'
import {
  defaultMatchConfig,
  nextPlayPeriod,
  periodOffsetSeconds,
} from './config'
import type { MatchConfig, PeriodConfig } from './state'

const period = (
  id: string,
  kind: PeriodConfig['kind'],
  lengthMinutes?: number,
): PeriodConfig => ({ id, name: id, abbreviation: id, kind, lengthMinutes })

describe('defaultMatchConfig', () => {
  it('matches the design defaults', () => {
    const c = defaultMatchConfig()
    expect(
      c.periods.map((p) => [p.name, p.abbreviation, p.lengthMinutes, p.kind]),
    ).toEqual([
      ['1st half', '1H', 45, 'play'],
      ['Half time', 'HT', 15, 'break'],
      ['2nd half', '2H', 45, 'play'],
      ['Extra time 1', 'ET1', 15, 'play'],
      ['Extra time 2', 'ET2', 15, 'play'],
      ['Penalties', 'PEN', undefined, 'shootout'],
    ])
    expect(c.substitutions).toEqual({ enabled: true, perPeriod: 5 })
    expect(c.stoppageTime).toEqual({ enabled: true })
  })

  it('has unique period ids and returns a fresh object each call', () => {
    const c = defaultMatchConfig()
    expect(new Set(c.periods.map((p) => p.id)).size).toBe(c.periods.length)
    expect(defaultMatchConfig()).not.toBe(c)
    expect(JSON.parse(JSON.stringify(c))).toEqual(c)
  })
})

describe('periodOffsetSeconds', () => {
  it('sums the lengths of preceding play periods only', () => {
    const c = defaultMatchConfig()
    const offset = (id: string) => periodOffsetSeconds(c, id)
    expect(offset('h1')).toBe(0)
    expect(offset('ht')).toBe(45 * 60)
    expect(offset('h2')).toBe(45 * 60)
    expect(offset('et1')).toBe(90 * 60)
    expect(offset('et2')).toBe(105 * 60)
    expect(offset('pen')).toBe(120 * 60)
  })

  it('works for custom period lists', () => {
    const c: MatchConfig = {
      ...defaultMatchConfig(),
      periods: [
        period('q1', 'play', 10),
        period('b1', 'break', 2),
        period('q2', 'play'),
        period('q3', 'play', 10),
      ],
    }
    expect(periodOffsetSeconds(c, 'q3')).toBe(10 * 60)
  })

  it('is 0 for an unknown period', () => {
    expect(periodOffsetSeconds(defaultMatchConfig(), 'nope')).toBe(0)
  })
})

describe('nextPlayPeriod', () => {
  it('finds the next play period, skipping breaks', () => {
    const c = defaultMatchConfig()
    expect(nextPlayPeriod(c, 'h1')?.id).toBe('h2')
    expect(nextPlayPeriod(c, 'ht')?.id).toBe('h2')
    expect(nextPlayPeriod(c, 'et2')).toBeUndefined()
    expect(nextPlayPeriod(c, 'nope')).toBeUndefined()
  })
})
