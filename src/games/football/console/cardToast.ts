import type { MatchEvent } from '../state'

/** Toast for a card action that produced second yellows, else null. */
export function cardToast(events: MatchEvent[]): string | null {
  const numbers = events.flatMap((e) =>
    e.type === 'card' && e.secondYellow ? e.numbers : [],
  )
  if (numbers.length === 0) return null
  const list = numbers.map((n) => `#${n}`).join(' ')
  return `${list} · second yellow → red card`
}
