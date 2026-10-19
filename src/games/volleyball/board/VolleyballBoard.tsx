import type { BoardProps } from '../../../boards/registry'
import { Wordmark } from '../../../components/Wordmark'
import { RollingNumber } from '../../../motion/RollingNumber'
import { setsWon } from '../rules'
import type { TeamSide, VolleyballMessage, VolleyballState } from '../state'
import styles from './VolleyballBoard.module.css'

const SIDE_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

function Team({ side, state }: { side: TeamSide; state: VolleyballState }) {
  const name = state.teams[side].name || SIDE_LABEL[side]
  const won = setsWon(state)[side]
  const serving = state.serving === side

  return (
    <section className={styles.team} aria-label={`${SIDE_LABEL[side]} team`}>
      <h2 className={styles.name}>{name}</h2>
      <p className={styles.score} aria-label={`${SIDE_LABEL[side]} score`}>
        <RollingNumber value={state.current[side]} />
      </p>
      <p className={styles.sets}>
        <span className={styles.label}>Sets</span>
        <span className={styles.pips} aria-hidden="true">
          {Array.from({ length: state.config.setsToWin }, (_, i) => (
            <span key={i} className={i < won ? styles.pipWon : styles.pip} />
          ))}
        </span>
        <span className="visually-hidden">
          {won} of {state.config.setsToWin} sets won
        </span>
      </p>
      {serving && (
        <span
          className={`${styles.serve} ${side === 'visitor' ? styles.serveVisitor : styles.serveHome}`}
        >
          <span className="visually-hidden">Serving</span>
        </span>
      )}
    </section>
  )
}

export function VolleyballBoard({
  state,
  connected,
}: BoardProps<VolleyballState, VolleyballMessage>) {
  // A finished match has no live set: keep showing the one that decided it.
  const setNumber =
    state.status === 'finished'
      ? state.completed.length
      : state.completed.length + 1

  return (
    <div className={styles.viewport}>
      <div className={styles.stage} data-testid="board-stage">
        <div className={styles.board}>
          <h1 className="visually-hidden">Volleyball scoreboard</h1>

          <Team side="visitor" state={state} />

          <section className={styles.centre} aria-label="Set">
            <h2 className={styles.label}>Set</h2>
            <p className={styles.setNumber}>{setNumber}</p>
            {state.completed.length > 0 && (
              <ol className={styles.results} aria-label="Completed sets">
                {state.completed.map((set, i) => (
                  <li key={i} className={styles.result}>
                    <span className={styles.resultLabel}>Set {i + 1}</span>
                    <span className={styles.resultScore}>
                      {set.visitor} – {set.home}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Team side="home" state={state} />

          {/* Keeps the bottom row's height; banners will be drawn over it. */}
          <div className={styles.slot} aria-hidden="true">
            Updates
          </div>
          <div className={styles.slotEnd} aria-hidden="true">
            Updates
          </div>
          <Wordmark className={styles.wordmark} />

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
