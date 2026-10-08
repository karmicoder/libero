import { useCallback, useEffect, useState } from 'react'

/** Wall-clock vs monotonic disagreement beyond this counts as a jump. */
export const JUMP_THRESHOLD_MS = 1_000
const CHECK_MS = 1_000

// Module-level so the defaults are stable effect dependencies: a new function
// each render would restart the watch and drop its baseline sample.
const wallNow = () => Date.now()
const monoNow = () => performance.now()

export interface ClockJump {
  /** Seconds the wall clock moved beyond the monotonic clock; negative = back. */
  seconds: number
}

/**
 * Watches for the system clock changing under a running game clock (NTP step,
 * manual change, DST-unrelated tz glitches) or the machine sleeping, by
 * comparing `Date.now()` deltas with `performance.now()` deltas between
 * checks. Throttled or late timers stretch both deltas equally, so they never
 * trigger it. It only reports; the game clock is never "corrected" here.
 */
export function useWallClockJump(
  active: boolean,
  wall: () => number = wallNow,
  mono: () => number = monoNow,
): { jump: ClockJump | null; dismiss: () => void } {
  const [jump, setJump] = useState<ClockJump | null>(null)

  useEffect(() => {
    if (!active) return
    let last = { wall: wall(), mono: mono() }
    const id = setInterval(() => {
      const next = { wall: wall(), mono: mono() }
      const drift = next.wall - last.wall - (next.mono - last.mono)
      last = next
      if (Math.abs(drift) > JUMP_THRESHOLD_MS) {
        setJump({ seconds: Math.round(drift / 1000) })
      }
    }, CHECK_MS)
    return () => clearInterval(id)
  }, [active, wall, mono])

  const dismiss = useCallback(() => setJump(null), [])
  return { jump, dismiss }
}
