/**
 * Shirt-number entry for the console sheets: a string of at most two digits
 * with no leading zero, so it always parses to 1-99 (or is empty).
 */

const MAX_DIGITS = 2

export function typeDigit(current: string, key: string): string {
  if (!/^\d$/.test(key)) return current
  if (current.length >= MAX_DIGITS) return current
  if (current === '' && key === '0') return current
  return current + key
}

export function backspace(current: string): string {
  return current.slice(0, -1)
}

/** The entered number, or undefined when nothing was entered. */
export function parseNumber(entry: string): number | undefined {
  return entry === '' ? undefined : Number(entry)
}
