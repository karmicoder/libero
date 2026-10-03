import { describe, expect, it } from 'vitest'
import type { MatchEvent } from '../state'
import { eventSummary, recentEvents } from './events'

const base = { id: 'e', periodId: 'h1', clockSeconds: 12 * 60 + 5 }
const goal = (over: Partial<MatchEvent> = {}): MatchEvent =>
  ({ ...base, type: 'goal', team: 'home', ...over }) as MatchEvent

describe('eventSummary', () => {
  it('summarises goals with floor-minute, scorer and assist', () => {
    expect(eventSummary(goal())).toBe('12′ Goal')
    expect(eventSummary(goal({ scorer: 9 } as Partial<MatchEvent>))).toBe(
      '12′ Goal #9',
    )
    expect(
      eventSummary(goal({ scorer: 9, assist: 10 } as Partial<MatchEvent>)),
    ).toBe('12′ Goal #9 (A #10)')
  })

  it('summarises cards and substitutions', () => {
    const card = (extra: object) =>
      ({
        ...base,
        type: 'card',
        team: 'home',
        numbers: [4, 7],
        ...extra,
      }) as MatchEvent
    expect(eventSummary(card({ color: 'yellow' }))).toBe(
      '12′ Yellow card #4 #7',
    )
    expect(eventSummary(card({ color: 'red' }))).toBe('12′ Red card #4 #7')
    expect(eventSummary(card({ color: 'red', secondYellow: true }))).toBe(
      '12′ Second yellow #4 #7',
    )
  })

  it('summarises substitutions, including several pairs and unnumbered ones', () => {
    const sub = (pairs: { off?: number; on?: number }[]): MatchEvent => ({
      ...base,
      type: 'substitution',
      team: 'home',
      pairs,
    })
    expect(eventSummary(sub([{ off: 3, on: 8 }]))).toBe('12′ Sub #3 off #8 on')
    expect(
      eventSummary(
        sub([
          { off: 1, on: 13 },
          { off: 2, on: 14 },
        ]),
      ),
    ).toBe('12′ Sub #1 off #13 on, #2 off #14 on')
    expect(eventSummary(sub([{ off: 5 }]))).toBe('12′ Sub #5 off')
    expect(eventSummary(sub([{}]))).toBe('12′ Sub')
    expect(eventSummary(sub([{}, {}, {}]))).toBe('12′ Sub ×3')
  })
})

describe('recentEvents', () => {
  it("returns a team's last events, newest first, capped", () => {
    const events = Array.from({ length: 7 }, (_, i) =>
      goal({ id: `e${i}` }),
    ).concat(goal({ id: 'v', team: 'visitor' }))
    expect(recentEvents(events, 'home').map((e) => e.id)).toEqual([
      'e6',
      'e5',
      'e4',
      'e3',
      'e2',
    ])
    expect(recentEvents(events, 'visitor').map((e) => e.id)).toEqual(['v'])
  })
})
