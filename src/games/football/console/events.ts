import type { MatchEvent, TeamSide } from '../state'

const withNumbers = (label: string, numbers: number[]) =>
  numbers.length > 0
    ? `${label} ${numbers.map((n) => `#${n}`).join(' ')}`
    : label

/** One-line text for the recent-events log, e.g. `12′ Goal #9 (A #10)`. */
export function eventSummary(event: MatchEvent): string {
  const minute = `${Math.floor(event.clockSeconds / 60)}′`
  switch (event.type) {
    case 'goal': {
      const scorer = event.scorer !== undefined ? ` #${event.scorer}` : ''
      const assist = event.assist !== undefined ? ` (A #${event.assist})` : ''
      return `${minute} Goal${scorer}${assist}`
    }
    case 'card': {
      const label = event.secondYellow
        ? 'Second yellow'
        : event.color === 'red'
          ? 'Red card'
          : 'Yellow card'
      return `${minute} ${withNumbers(label, event.numbers)}`
    }
    case 'substitution': {
      const pairs = event.pairs.map((p) =>
        [
          p.off !== undefined && `#${p.off} off`,
          p.on !== undefined && `#${p.on} on`,
        ]
          .filter(Boolean)
          .join(' '),
      )
      const detail = pairs.filter(Boolean).join(', ')
      const count = event.pairs.length > 1 ? ` ×${event.pairs.length}` : ''
      return `${minute} Sub${detail ? ` ${detail}` : count}`
    }
  }
}

/** The team's most recent events, newest first. */
export function recentEvents(
  events: MatchEvent[],
  team: TeamSide,
  limit = 5,
): MatchEvent[] {
  return events
    .filter((e) => e.team === team)
    .slice(-limit)
    .reverse()
}
