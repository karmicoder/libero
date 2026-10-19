import type { FootballMessage } from '../state'
import { MAX_PAIRS_SHOWN } from './followUp'
import { BallIcon, CardIcon, SubIcon } from './icons'
import styles from './UpdateBanner.module.css'

const flipClass = { out: 'flipOut', in: 'flipIn' } as const

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
        </>
      )
    }
  }
}

/**
 * One update banner, in the scoring team's bottom corner (visitor left, home
 * right), extending under the centre column. Slides in after a short delay and
 * out again; with reduced motion it fades. Durations and easings are the `--motion-board-*` tokens; `boards/banner.ts` reads the same tokens for its timers.
 */
export function UpdateBanner({
  notice,
  phase,
  flip,
}: {
  notice: FootballMessage
  phase: 'in' | 'out'
  /** A follow-up flipping in or out: the card turns about its vertical axis. */
  flip?: 'out' | 'in'
}) {
  return (
    <div
      className={[
        styles.banner,
        notice.team === 'visitor' ? styles.visitor : styles.home,
        phase === 'out'
          ? styles.out
          : flip
            ? styles[flipClass[flip]]
            : styles.in,
      ].join(' ')}
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
