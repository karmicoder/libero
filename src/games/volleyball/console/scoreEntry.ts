/**
 * Score entry for the Set score keypad: up to three digits (a capped set can
 * pass 99), no leading zero, so it always parses to 0-999 or is empty.
 */

const MAX_DIGITS = 3

export function typeScoreDigit(current: string, key: string): string {
  if (!/^\d$/.test(key)) return current
  if (current === '0') return key
  if (current.length >= MAX_DIGITS) return current
  return current + key
}

export function backspace(current: string): string {
  return current.slice(0, -1)
}

/** The entered score, or undefined when nothing was entered. */
export function parseScore(entry: string): number | undefined {
  return entry === '' ? undefined : Number(entry)
}
