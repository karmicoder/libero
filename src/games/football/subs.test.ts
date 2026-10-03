import { describe, expect, it } from 'vitest'
import type { MatchEvent } from './state'
import { subsUsed } from './subs'

const base = { id: 'e', periodId: 'h1', clockSeconds: 0 }

describe('subsUsed', () => {
  const events: MatchEvent[] = [
    { ...base, type: 'substitution', team: 'home' },
    { ...base, type: 'substitution', team: 'home', periodId: 'h2' },
    { ...base, type: 'goal', team: 'home' },
  ]

  it('counts only the team’s substitutions in that period', () => {
    expect(subsUsed(events, 'home', 'h1')).toBe(1)
    expect(subsUsed(events, 'home', 'h2')).toBe(1)
    expect(subsUsed(events, 'visitor', 'h1')).toBe(0)
  })
})
