import type { TeamSide, VolleyballMessage } from '../state'
import styles from './SetBanner.module.css'

export type SetWon = Extract<VolleyballMessage, { type: 'set-won' }>

/**
 * The `set-won` banner (including the match-winning one), in the winner's
 * bottom column. Enter and exit are the shared `--motion-board-*` tokens;
 * `useBanner` reads the same tokens for its timers.
 */
export function SetBanner({
  notice,
  phase,
  names,
}: {
  notice: SetWon
  phase: 'in' | 'out'
  names: Record<TeamSide, string>
}) {
  const { team, score, setsWon, matchWon, setNumber } = notice
  return (
    <div
      className={[
        styles.banner,
        team === 'visitor' ? styles.visitor : styles.home,
        phase === 'out' ? styles.out : styles.in,
      ].join(' ')}
      role="status"
      data-team={team}
      data-phase={phase}
    >
      <span className={styles.label}>
        {matchWon ? 'Match' : `Set ${setNumber}`}
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.event}>
        <span className={styles.winner}>{names[team]}</span>
        <span>
          {matchWon
            ? `win ${setsWon.visitor} – ${setsWon.home}`
            : `win ${score.visitor} – ${score.home}`}
        </span>
      </span>
    </div>
  )
}
