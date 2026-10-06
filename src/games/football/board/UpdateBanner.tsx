import type { CSSProperties } from 'react'
import {
  BANNER_ENTER_DELAY_MS,
  BANNER_ENTER_MS,
  BANNER_EXIT_MS,
} from '../../../boards/banner'
import type { FootballMessage } from '../state'
import { BallIcon, CardIcon, SubIcon } from './icons'
import styles from './UpdateBanner.module.css'

/** At most this many substitution pairs are spelled out; the rest are counted. */
const MAX_PAIRS_SHOWN = 3

const timing = {
  '--enter-delay': `${BANNER_ENTER_DELAY_MS}ms`,
  '--enter-ms': `${BANNER_ENTER_MS}ms`,
  '--exit-ms': `${BANNER_EXIT_MS}ms`,
} as CSSProperties

function Content({ notice }: { notice: FootballMessage }) {
  switch (notice.type) {
    case 'goal-scored':
      return (
        <>
          <BallIcon />
          <span>
            {notice.scorer ?? '–'}
            {notice.scorer === undefined && (
              <span className="visually-hidden"> scorer unknown</span>
            )}
          </span>
          {notice.assist !== undefined && (
            <span className={styles.assist}>
              <span aria-hidden="true">A</span>
              <span className="visually-hidden">Assist </span>
              {notice.assist}
            </span>
          )}
        </>
      )
    case 'card-issued':
      return (
        <>
          {notice.groups.map((g, i) => (
            <span key={i} className={styles.group}>
              <CardIcon kind={g.kind} />
              {g.numbers.length > 0 && <span>{g.numbers.join(' ')}</span>}
            </span>
          ))}
        </>
      )
    case 'substitution-made': {
      const shown = notice.pairs.slice(0, MAX_PAIRS_SHOWN)
      const more = notice.pairs.length - shown.length
      return (
        <>
          {/* Several pairs stack, one per row, so they fit the banner. */}
          <span
            className={shown.length > 1 ? styles.pairsStacked : styles.pairs}
          >
            {shown.map((p, i) => (
              <span key={i} className={styles.group}>
                <SubIcon direction="off" />
                <span>{p.off ?? '–'}</span>
                <SubIcon direction="on" />
                <span>{p.on ?? '–'}</span>
              </span>
            ))}
          </span>
          {more > 0 && <span className={styles.more}>+{more}</span>}
        </>
      )
    }
  }
}

/**
 * One update banner, in the scoring team's bottom corner (visitor left, home
 * right), extending under the centre column. Slides in after a short delay and
 * out again; with reduced motion it fades. Timing lives in `boards/banner.ts`.
 */
export function UpdateBanner({
  notice,
  phase,
}: {
  notice: FootballMessage
  phase: 'in' | 'out'
}) {
  return (
    <div
      className={[
        styles.banner,
        notice.team === 'visitor' ? styles.visitor : styles.home,
        phase === 'in' ? styles.in : styles.out,
      ].join(' ')}
      style={timing}
      role="status"
      data-team={notice.team}
      data-phase={phase}
    >
      <span className={styles.minute}>{notice.minute}′</span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.event}>
        <Content notice={notice} />
      </span>
    </div>
  )
}
