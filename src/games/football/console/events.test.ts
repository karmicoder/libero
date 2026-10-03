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
    expect(
      eventSummary({
        ...base,
        type: 'substitution',
        team: 'home',
        playerOff: 3,
        playerOn: 8,
      }),
    ).toBe('12′ Sub #3 off #8 on')
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
