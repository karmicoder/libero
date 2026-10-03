import { useEffect, useState } from 'react'
import { BANNER_EXIT_MS, BANNER_VISIBLE_MS } from './banner'

export interface BannerState<Notice> {
  notice: Notice
  /** `in`: entering and on show. `out`: leaving; removed when it has gone. */
  phase: 'in' | 'out'
}

/**
 * Sequences one banner at a time from a board's notice feed: a notice shows,
 * holds, leaves and is removed; a newer notice replaces the current one at
 * once. Nothing is stored, so a refresh or reconnect never replays a banner.
 */
export function useBanner<Notice>(
  subscribeNotices: (listener: (notice: Notice) => void) => () => void,
): BannerState<Notice> | null {
  const [banner, setBanner] = useState<BannerState<Notice> | null>(null)

  useEffect(() => {
    let hold: ReturnType<typeof setTimeout> | undefined
    let exit: ReturnType<typeof setTimeout> | undefined
    const clear = () => {
      clearTimeout(hold)
      clearTimeout(exit)
    }

    const unsubscribe = subscribeNotices((notice) => {
      clear()
      setBanner({ notice, phase: 'in' })
      hold = setTimeout(() => {
        setBanner((b) => (b ? { ...b, phase: 'out' } : b))
        exit = setTimeout(() => setBanner(null), BANNER_EXIT_MS)
      }, BANNER_VISIBLE_MS)
    })

    return () => {
      unsubscribe()
      clear()
    }
  }, [subscribeNotices])

  return banner
}
