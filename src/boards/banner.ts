/**
 * Banner timing, shared by the hook that sequences a banner and the CSS that
 * animates it. Local to the board: notices carry no timing and are never
 * replayed.
 *
 * Motion durations (the entrance delay, enter, exit and flip) are tokens in
 * `tokens.css`, which the CSS uses directly; the hook reads the same tokens so
 * its timers wait exactly as long as the animation runs, including the shorter
 * fades of reduced motion. Only the dwell times below are content timing, not
 * motion.
 */
import { motionMs } from '../motion/motionMs'

export const bannerEnterDelayMs = () => motionMs('--motion-enter-delay')
export const bannerEnterMs = () => motionMs('--motion-board-enter')
export const bannerExitMs = () => motionMs('--motion-board-exit')
/** The card flips to the follow-up: each half is a turn to or from edge-on. */
export const bannerFlipMs = () => motionMs('--motion-board-flip')

/** How long a banner holds once it has arrived. */
export const BANNER_HOLD_MS = 9_000

/**
 * From a notice arriving to its follow-up replacing it, when it has one: half
 * the usual time, since the audience is waiting on the rest of the story.
 */
export const BANNER_FOLLOW_UP_MS = 4_500

/** From a notice arriving to the banner starting to leave. */
export const bannerVisibleMs = () =>
  bannerEnterDelayMs() + bannerEnterMs() + BANNER_HOLD_MS
