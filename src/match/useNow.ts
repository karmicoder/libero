import { useCallback, useRef, useSyncExternalStore } from 'react'

/**
 * `Date.now()` re-read on an interval while `active`, for repainting a running
 * clock. Displayed time is always derived from the timestamp, so a late or
 * dropped tick only delays a repaint; it can never make the clock wrong.
 */
export function useNow(active: boolean, intervalMs = 200): number {
  // 0 until the first subscription: a stopped clock ignores `now`, and a
  // running one is re-read immediately on subscribe.
  const latest = useRef(0)
  const subscribe = useCallback(
    (onTick: () => void) => {
      if (!active) return () => {}
      latest.current = Date.now()
      const id = setInterval(() => {
        latest.current = Date.now()
        onTick()
      }, intervalMs)
      return () => clearInterval(id)
    },
    [active, intervalMs],
  )
  return useSyncExternalStore(subscribe, () => latest.current)
}
