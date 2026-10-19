import { afterEach, describe, expect, it } from 'vitest'
import { motionMs } from './motionMs'

const set = (name: string, value: string) =>
  document.documentElement.style.setProperty(name, value)

afterEach(() => document.documentElement.removeAttribute('style'))

describe('motionMs', () => {
  it('reads milliseconds', () => {
    set('--t', '560ms')
    expect(motionMs('--t')).toBe(560)
  })

  it('reads seconds', () => {
    set('--t', '0.2s')
    expect(motionMs('--t')).toBe(200)
  })

  it('is 0 for a token that is not defined', () => {
    expect(motionMs('--nope')).toBe(0)
  })
})
