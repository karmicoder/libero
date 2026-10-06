/**
 * Banner timing, shared by the hook that sequences a banner and the CSS that
 * animates it (the board passes these to its styles as custom properties).
 * Local to the board: notices carry no timing and are never replayed.
 */
export const BANNER_ENTER_DELAY_MS = 300
export const BANNER_ENTER_MS = 560
export const BANNER_HOLD_MS = 9_000
export const BANNER_EXIT_MS = 560

/**
 * From a notice arriving to its follow-up replacing it, when it has one: half
 * the usual time, since the audience is waiting on the rest of the story.
 */
export const BANNER_FOLLOW_UP_MS = 4_500

/** The card flips to the follow-up: each half is a turn to or from edge-on. */
export const BANNER_FLIP_HALF_MS = 240

/** From a notice arriving to the banner starting to leave. */
export const BANNER_VISIBLE_MS =
  BANNER_ENTER_DELAY_MS + BANNER_ENTER_MS + BANNER_HOLD_MS
