import { describe, expect, it } from 'vitest'
import { backspace, parseNumber, typeDigit } from './keypad'

describe('typeDigit', () => {
  it('appends digits up to two', () => {
    expect(typeDigit('', '7')).toBe('7')
    expect(typeDigit('7', '4')).toBe('74')
  })

  it('ignores a third digit', () => {
    expect(typeDigit('74', '1')).toBe('74')
  })

  it('ignores a leading zero but allows a zero after a digit', () => {
    expect(typeDigit('', '0')).toBe('')
    expect(typeDigit('1', '0')).toBe('10')
  })

  it('ignores anything that is not a single digit', () => {
    expect(typeDigit('1', 'a')).toBe('1')
    expect(typeDigit('1', '12')).toBe('1')
    expect(typeDigit('1', '')).toBe('1')
  })
})

describe('backspace', () => {
  it('removes the last digit', () => {
    expect(backspace('74')).toBe('7')
    expect(backspace('7')).toBe('')
  })

  it('does nothing on an empty entry', () => {
    expect(backspace('')).toBe('')
  })
})

describe('parseNumber', () => {
  it('is the number, or undefined when empty', () => {
    expect(parseNumber('9')).toBe(9)
    expect(parseNumber('10')).toBe(10)
    expect(parseNumber('')).toBeUndefined()
  })
})
