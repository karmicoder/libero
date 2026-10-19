import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_BANNER_TIMING,
  type BannerTiming,
  bannerExitMs,
  bannerFlipMs,
  bannerVisibleMs,
} from './banner'

export interface BannerState<Notice> {
  notice: Notice
  /** `in`: entering and on show. `out`: leaving; removed when it has gone. */
  phase: 'in' | 'out'
  /**
   * Identifies the banner card: a follow-up keeps it, so the card flips
   * instead of being replaced.
   */
  key: number
  /** A follow-up turning edge-on (`out`) or settling face-on (`in`). */
  flip?: 'out' | 'in'
}

/**
 * Sequences one banner at a time from a board's notice feed: a notice shows,
 * holds, leaves and is removed; a newer notice replaces the current one at
 * once. Nothing is stored, so a refresh or reconnect never replays a banner.
 *
 * `followUp` may name a second notice to show after the first (e.g. the pairs
 * of a big substitution that didn't fit). The card flips to it, so that it
 * has replaced the first after `BANNER_FOLLOW_UP_MS` instead of the first
 * holding and leaving, and it may itself have a follow-up. It must be a
 * stable function.
 *
 * `timing` overrides the dwell times (hold, follow-up) for a sport; it defaults
 * to football's. Only its numbers matter, so an inline object is fine.
 */
export function useBanner<Notice>(
  subscribeNotices: (listener: (notice: Notice) => void) => () => void,
  followUp?: (notice: Notice) => Notice | undefined,
  timing: BannerTiming = DEFAULT_BANNER_TIMING,
): BannerState<Notice> | null {
  const [banner, setBanner] = useState<BannerState<Notice> | null>(null)
  const cards = useRef(0)
  const { holdMs, followUpMs } = timing

  useEffect(() => {
    let hold: ReturnType<typeof setTimeout> | undefined
    let exit: ReturnType<typeof setTimeout> | undefined
    const clear = () => {
      clearTimeout(hold)
      clearTimeout(exit)
    }

    const show = (notice: Notice, continuing = false) => {
      clear()
      if (!continuing) cards.current += 1
      setBanner({
        notice,
        phase: 'in',
        key: cards.current,
        ...(continuing && { flip: 'in' as const }),
      })
      const next = followUp?.(notice)
      if (next !== undefined) {
        const flip = bannerFlipMs()
        hold = setTimeout(() => {
          setBanner((b) => (b ? { ...b, flip: 'out' } : b))
          hold = setTimeout(() => show(next, true), flip)
        }, followUpMs - flip)
        return
      }
      hold = setTimeout(() => {
        setBanner((b) => (b ? { ...b, phase: 'out' } : b))
        exit = setTimeout(() => setBanner(null), bannerExitMs())
      }, bannerVisibleMs(holdMs))
    }

    const unsubscribe = subscribeNotices(show)

    return () => {
      unsubscribe()
      clear()
    }
  }, [subscribeNotices, followUp, holdMs, followUpMs])

  return banner
}
