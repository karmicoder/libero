/**
 * Banner timing, shared by the hook that sequences a banner and the CSS that
 * animates it. Local to the board: notices carry no timing and are never
 * replayed.
 *
 * Motion durations (the entrance delay, enter, exit and flip) are tokens in
 * `tokens.css`, which the CSS uses directly; the hook reads the same tokens so
 * its timers wait exactly as long as the animation runs. Only the dwell times below are content timing, not
 * motion.
 */
import { motionMs } from '../motion/motionMs'

export const bannerEnterDelayMs = () => motionMs('--motion-enter-delay')
export const bannerEnterMs = () => motionMs('--motion-board-enter')
export const bannerExitMs = () => motionMs('--motion-board-exit')
/** The card flips to the follow-up: each half is a turn to or from edge-on. */
export const bannerFlipMs = () => motionMs('--motion-board-flip')

/**
 * How long a banner holds once it has arrived. A banner that pages through
 * follow-ups (e.g. a big substitution) holds every page this long once it is
 * face-on: each page has as much to read as the first, so the pages don't
 * share one hold. The first page slides in before its hold; each later page
 * flips in.
 */
export const BANNER_HOLD_MS = 9_000

/** Dwell times a sport may override; football's are the defaults above. */
export interface BannerTiming {
  holdMs: number
}

export const DEFAULT_BANNER_TIMING: BannerTiming = {
  holdMs: BANNER_HOLD_MS,
}

/** From a notice arriving to the banner starting to leave. */
export const bannerVisibleMs = (holdMs: number = BANNER_HOLD_MS) =>
  bannerEnterDelayMs() + bannerEnterMs() + holdMs
