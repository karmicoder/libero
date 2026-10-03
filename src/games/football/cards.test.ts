import { describe, expect, it } from 'vitest'
import { cautionedNumbers, sentOffNumbers } from './cards'
import type { MatchEvent } from './state'

const base = { id: 'e', periodId: 'h1', clockSeconds: 0 }
const card = (
  team: 'home' | 'visitor',
  color: 'yellow' | 'red',
  numbers: number[],
  secondYellow?: boolean,
): MatchEvent => ({
  ...base,
  type: 'card',
  team,
  color,
  numbers,
  ...(secondYellow && { secondYellow }),
})

describe('sentOffNumbers', () => {
  it('lists reds and second yellows for the team, without repeats', () => {
    const events = [
      card('home', 'yellow', [4]),
      card('home', 'red', [4, 7]),
      card('home', 'red', [7], true),
      card('visitor', 'red', [2]),
    ]
    expect(sentOffNumbers(events, 'home')).toEqual([4, 7])
    expect(sentOffNumbers(events, 'visitor')).toEqual([2])
  })

  it('is empty with no cards', () => {
    expect(sentOffNumbers([], 'home')).toEqual([])
  })
})

describe('cautionedNumbers', () => {
  it('lists players with a yellow who have not been sent off', () => {
    const events = [
      card('home', 'yellow', [4, 7]),
      card('home', 'red', [4], true),
      card('visitor', 'yellow', [9]),
    ]
    expect(cautionedNumbers(events, 'home')).toEqual([7])
    expect(cautionedNumbers(events, 'visitor')).toEqual([9])
  })
})
