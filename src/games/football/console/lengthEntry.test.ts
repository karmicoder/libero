import { describe, expect, it } from 'vitest'
import {
  formatLength,
  lengthEntry,
  parseLength,
  typeLengthDigit,
} from './lengthEntry'

describe('typeLengthDigit', () => {
  it('appends digits up to three', () => {
    expect(typeLengthDigit('', '4')).toBe('4')
    expect(typeLengthDigit('9', '9')).toBe('99')
    expect(typeLengthDigit('99', '9')).toBe('999')
    expect(typeLengthDigit('999', '9')).toBe('999')
  })

  it('collapses leading zeros', () => {
    expect(typeLengthDigit('', '0')).toBe('0')
    expect(typeLengthDigit('0', '0')).toBe('0')
    expect(typeLengthDigit('0', '5')).toBe('5')
  })

  it('ignores non-digits', () => {
    expect(typeLengthDigit('4', 'a')).toBe('4')
  })
})

describe('parse and format', () => {
  it('treats an empty entry as no timer', () => {
    expect(parseLength('')).toBeUndefined()
    expect(parseLength('0')).toBe(0)
    expect(parseLength('45')).toBe(45)
    expect(lengthEntry(undefined)).toBe('')
    expect(lengthEntry(45)).toBe('45')
    expect(formatLength(undefined)).toBe('No timer')
    expect(formatLength(45)).toBe('45 min')
  })
})
