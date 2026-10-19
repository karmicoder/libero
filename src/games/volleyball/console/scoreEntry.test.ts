import { describe, expect, it } from 'vitest'
import { backspace, parseScore, typeScoreDigit } from './scoreEntry'

describe('scoreEntry', () => {
  it('shifts digits in, up to three', () => {
    let entry = ''
    for (const d of '1234') entry = typeScoreDigit(entry, d)
    expect(entry).toBe('123')
  })

  it('drops a leading zero but keeps a lone zero', () => {
    expect(typeScoreDigit('', '0')).toBe('0')
    expect(typeScoreDigit('0', '7')).toBe('7')
    expect(typeScoreDigit('0', '0')).toBe('0')
  })

  it('ignores non-digits and backspaces', () => {
    expect(typeScoreDigit('1', 'a')).toBe('1')
    expect(backspace('12')).toBe('1')
    expect(backspace('')).toBe('')
  })

  it('parses an empty entry to undefined', () => {
    expect(parseScore('')).toBeUndefined()
    expect(parseScore('0')).toBe(0)
    expect(parseScore('25')).toBe(25)
  })
})
