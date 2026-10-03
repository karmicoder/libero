import type { MatchEvent, TeamSide } from './state'

/** Shirt numbers sent off (red card or second yellow), in order, without repeats. */
export function sentOffNumbers(events: MatchEvent[], team: TeamSide): number[] {
  const numbers = events.flatMap((e) =>
    e.type === 'card' && e.team === team && e.color === 'red' ? e.numbers : [],
  )
  return [...new Set(numbers)]
}

/**
 * Shirt numbers with a yellow card who are still on the pitch: another yellow
 * for one of them is a second yellow, which sends them off.
 */
export function cautionedNumbers(
  events: MatchEvent[],
  team: TeamSide,
): number[] {
  const sentOff = new Set(sentOffNumbers(events, team))
  const yellows = events.flatMap((e) =>
    e.type === 'card' && e.team === team && e.color === 'yellow'
      ? e.numbers
      : [],
  )
  return [...new Set(yellows)].filter((n) => !sentOff.has(n))
}
