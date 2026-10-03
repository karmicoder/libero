import { describe, expect, it } from 'vitest'
import type { FootballState } from './state'

describe('FootballState', () => {
  it('survives a JSON round trip', () => {
    const state: FootballState = {
      config: {
        periods: [
          {
            id: 'h1',
            name: 'First half',
            abbreviation: '1H',
            lengthMinutes: 45,
            kind: 'play',
          },
        ],
        substitutions: { enabled: true, perPeriod: 3 },
        stoppageTime: { enabled: true },
      },
      clock: { baseSeconds: 0, runningSince: null },
      periodId: 'h1',
      stoppageMinutes: null,
      teams: {
        visitor: { name: 'Visitor', score: 0 },
        home: { name: 'Home', score: 1 },
      },
      events: [
        {
          id: 'e1',
          type: 'goal',
          team: 'home',
          periodId: 'h1',
          clockSeconds: 60,
          scorer: 9,
        },
      ],
      subsRemaining: { visitor: 3, home: 2 },
      nextEventId: 2,
    }
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })
})
