import { useEffect, useState } from 'react'
import {
  BANNER_EXIT_MS,
  BANNER_FOLLOW_UP_MS,
  BANNER_VISIBLE_MS,
} from './banner'

export interface BannerState<Notice> {
  notice: Notice
  /** `in`: entering and on show. `out`: leaving; removed when it has gone. */
  phase: 'in' | 'out'
}

/**
 * Sequences one banner at a time from a board's notice feed: a notice shows,
 * holds, leaves and is removed; a newer notice replaces the current one at
 * once. Nothing is stored, so a refresh or reconnect never replays a banner.
 *
 * `followUp` may name a second notice to show after the first (e.g. the pairs
 * of a big substitution that didn't fit). It replaces the first after
 * `BANNER_FOLLOW_UP_MS` instead of the first holding and leaving, and may
 * itself have a follow-up. It must be a stable function.
 */
export function useBanner<Notice>(
  subscribeNotices: (listener: (notice: Notice) => void) => () => void,
  followUp?: (notice: Notice) => Notice | undefined,
): BannerState<Notice> | null {
  const [banner, setBanner] = useState<BannerState<Notice> | null>(null)

  useEffect(() => {
    let hold: ReturnType<typeof setTimeout> | undefined
    let exit: ReturnType<typeof setTimeout> | undefined
    const clear = () => {
      clearTimeout(hold)
      clearTimeout(exit)
    }

    const show = (notice: Notice) => {
      clear()
      setBanner({ notice, phase: 'in' })
      const next = followUp?.(notice)
      if (next !== undefined) {
        hold = setTimeout(() => show(next), BANNER_FOLLOW_UP_MS)
        return
      }
      hold = setTimeout(() => {
        setBanner((b) => (b ? { ...b, phase: 'out' } : b))
        exit = setTimeout(() => setBanner(null), BANNER_EXIT_MS)
      }, BANNER_VISIBLE_MS)
    }

    const unsubscribe = subscribeNotices(show)

    return () => {
      unsubscribe()
      clear()
    }
  }, [subscribeNotices, followUp])

  return banner
}
