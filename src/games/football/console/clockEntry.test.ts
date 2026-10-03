import { describe, expect, it } from 'vitest'
import { defaultMatchConfig } from '../config'
import {
  clockPresets,
  entryForSeconds,
  parseClockEntry,
  typeClockDigit,
  typeDoubleZero,
} from './clockEntry'

describe('clock entry', () => {
  it('shifts digits in from the right, up to five', () => {
    let entry = ''
    for (const d of '1050099') entry = typeClockDigit(entry, d)
    expect(entry).toBe('10500')
    expect(parseClockEntry(entry)).toEqual({ minutes: 105, seconds: 0 })
  })

  it('ignores non-digits', () => {
    expect(typeClockDigit('12', 'x')).toBe('12')
  })

  it('reads short entries as seconds, then minutes', () => {
    expect(parseClockEntry('5')).toEqual({ minutes: 0, seconds: 5 })
    expect(parseClockEntry('130')).toEqual({ minutes: 1, seconds: 30 })
  })

  it('keeps typed zeros as a real 00:00', () => {
    expect(parseClockEntry(typeClockDigit('', '0'))).toEqual({
      minutes: 0,
      seconds: 0,
    })
  })

  it('has no time when empty', () => {
    expect(parseClockEntry('')).toBeUndefined()
  })

  it('clamps seconds to 59', () => {
    expect(parseClockEntry('4575')).toEqual({ minutes: 45, seconds: 59 })
  })

  it('adds two zeros, only when both fit', () => {
    expect(typeDoubleZero('45')).toBe('4500')
    expect(typeDoubleZero('450')).toBe('45000')
    expect(typeDoubleZero('4500')).toBe('4500')
  })

  it('round-trips seconds to an entry', () => {
    expect(entryForSeconds(0)).toBe('0000')
    expect(parseClockEntry(entryForSeconds(105 * 60))).toEqual({
      minutes: 105,
      seconds: 0,
    })
  })

  it('derives presets from the play-period offsets', () => {
    expect(clockPresets(defaultMatchConfig())).toEqual([
      0,
      45 * 60,
      90 * 60,
      105 * 60,
    ])
  })

  it('follows a custom config', () => {
    const config = defaultMatchConfig()
    config.periods = [
      {
        id: 'q1',
        name: 'Q1',
        abbreviation: 'Q1',
        lengthMinutes: 20,
        kind: 'play',
      },
      {
        id: 'q2',
        name: 'Q2',
        abbreviation: 'Q2',
        lengthMinutes: 20,
        kind: 'play',
      },
    ]
    expect(clockPresets(config)).toEqual([0, 20 * 60])
  })
})
