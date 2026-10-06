import type { FootballMessage } from '../state'

/** At most this many substitution pairs fit one banner. */
export const MAX_PAIRS_SHOWN = 3

/**
 * The banner to show after this one: the substitution pairs that didn't fit,
 * or undefined when everything did (or for any other notice).
 */
export function followUpNotice(
  notice: FootballMessage,
): FootballMessage | undefined {
  if (
    notice.type !== 'substitution-made' ||
    notice.pairs.length <= MAX_PAIRS_SHOWN
  ) {
    return undefined
  }
  return {
    ...notice,
    id: `${notice.id}+`,
    pairs: notice.pairs.slice(MAX_PAIRS_SHOWN),
  }
}
