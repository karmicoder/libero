/**
 * Period-length entry for the settings screen: a string of at most three
 * digits (0-999 minutes). Empty means "No timer". Leading zeros collapse, so
 * an entry always parses to a plain number.
 */

const MAX_DIGITS = 3

export function typeLengthDigit(current: string, key: string): string {
  if (!/^\d$/.test(key)) return current
  const next = current === '0' ? key : current + key
  return next.length > MAX_DIGITS ? current : next
}

/** The entered minutes, or undefined when nothing was entered (no timer). */
export function parseLength(entry: string): number | undefined {
  return entry === '' ? undefined : Number(entry)
}

export function lengthEntry(minutes: number | undefined): string {
  return minutes === undefined ? '' : String(minutes)
}

/** "45 min", or "No timer" when the period has no length. */
export function formatLength(minutes: number | undefined): string {
  return minutes === undefined ? 'No timer' : `${minutes} min`
}
