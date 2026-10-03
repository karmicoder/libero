import { periodOffsetSeconds } from '../config'
import type { MatchConfig } from '../state'

/**
 * Clock entry for the set-clock sheet: a string of up to five digits that
 * shift in from the right, read as `mm:ss` (so `10500` is 105:00). Leading
 * zeros are kept, because typing `0` is a real entry (00:00).
 */

const MAX_DIGITS = 5

export function typeClockDigit(current: string, key: string): string {
  if (!/^\d$/.test(key)) return current
  return current.length >= MAX_DIGITS ? current : current + key
}

/** The `00` key: two zeros, or nothing when they would not both fit. */
export function typeDoubleZero(current: string): string {
  return current.length + 2 > MAX_DIGITS ? current : current + '00'
}

/** The entered time with seconds clamped to 59, or undefined when empty. */
export function parseClockEntry(
  entry: string,
): { minutes: number; seconds: number } | undefined {
  if (entry === '') return undefined
  const padded = entry.padStart(4, '0')
  return {
    minutes: Number(padded.slice(0, -2)),
    seconds: Math.min(59, Number(padded.slice(-2))),
  }
}

/** The entry that reads as `totalSeconds`, for preset chips. */
export function entryForSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return String(minutes * 100 + seconds).padStart(4, '0')
}

/**
 * Where each play period starts, ascending and without duplicates: the
 * sheet's preset chips follow the configured periods.
 */
export function clockPresets(config: MatchConfig): number[] {
  const offsets = config.periods
    .filter((p) => p.kind === 'play')
    .map((p) => periodOffsetSeconds(config, p.id))
  return [...new Set(offsets)].sort((a, b) => a - b)
}
