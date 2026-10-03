import type { BoardProps } from '../../../boards/registry'
import { useNow } from '../../../match/useNow'
import { displayedSeconds, formatClock } from '../clock'
import { findPeriod } from '../config'
import type { FootballMessage, FootballState, TeamSide } from '../state'
import { subLimit } from '../subs'
import styles from './FootballBoard.module.css'

const SIDE_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

function Team({ side, state }: { side: TeamSide; state: FootballState }) {
  const team = state.teams[side]
  const configured = subLimit(state.config)
  const left = state.subsRemaining[side]
  // Normally one pip per allowed sub; a manual raise shows the extra pips.
  const limit =
    configured === undefined ? undefined : Math.max(configured, left)

  return (
    <section className={styles.team} aria-label={`${SIDE_LABEL[side]} team`}>
      <h2 className={styles.name}>{team.name || SIDE_LABEL[side]}</h2>
      <p className={styles.score} aria-label={`${SIDE_LABEL[side]} score`}>
        {team.score}
      </p>
      {limit !== undefined && (
        <p className={styles.subs}>
          <span className={styles.subsLabel}>Subs</span>
          <span className={styles.pips} aria-hidden="true">
            {Array.from({ length: limit }, (_, i) => (
              <span
                key={i}
                className={i < left ? styles.pipLeft : styles.pip}
              />
            ))}
          </span>
          <span className="visually-hidden">
            {left} of {limit} left this period
          </span>
        </p>
      )}
    </section>
  )
}

export function FootballBoard({
  state,
  connected,
}: BoardProps<FootballState, FootballMessage>) {
  const running = state.clock.runningSince !== null
  const now = useNow(running)
  const period = findPeriod(state.config, state.periodId)
  const showClock = period?.kind !== 'shootout'
  const showStoppage =
    state.config.stoppageTime.enabled &&
    period?.kind === 'play' &&
    (state.stoppageMinutes ?? 0) > 0

  return (
    <div className={styles.viewport}>
      <div className={styles.stage} data-testid="board-stage">
        <div className={styles.board}>
          <h1 className="visually-hidden">Football scoreboard</h1>

          <Team side="visitor" state={state} />

          <section className={styles.centre} aria-label="Match clock">
            {showClock && (
              <time
                className={styles.clock}
                dateTime={`PT${displayedSeconds(state.clock, now)}S`}
              >
                {formatClock(displayedSeconds(state.clock, now))}
              </time>
            )}
            <h2 className={styles.period}>{period?.name}</h2>
            {showStoppage && (
              <p className={styles.pill}>
                <span className="visually-hidden">Stoppage time </span>+
                {state.stoppageMinutes}′
              </p>
            )}
          </section>

          <Team side="home" state={state} />

          {/* Reserved for update banners (#11); invisible until then. */}
          <div className={styles.slot} aria-hidden="true">
            Updates
          </div>
          <div className={styles.slotEnd} aria-hidden="true">
            Updates
          </div>
          <p className={styles.wordmark}>Libero</p>

          {!connected && (
            <p className={styles.disconnected} role="status">
              Disconnected from console
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
