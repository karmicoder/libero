import type { BoardProps } from '../../../boards/registry'
import { useBanner } from '../../../boards/useBanner'
import { Wordmark } from '../../../components/Wordmark'
import { RollingNumber } from '../../../motion/RollingNumber'
import { matchWinner, setsWon } from '../rules'
import type { TeamSide, VolleyballMessage, VolleyballState } from '../state'
import { SetBanner } from './SetBanner'
import {
  useBoardTransitions,
  type BoardTransitions,
} from './useBoardTransitions'
import styles from './VolleyballBoard.module.css'

/** A set win is the only banner, so it holds shorter than football's. */
const BANNER_TIMING = { holdMs: 5_000, followUpMs: 0 }

const SIDE_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

function Team({
  side,
  state,
  transitions,
}: {
  side: TeamSide
  state: VolleyballState
  transitions: BoardTransitions
}) {
  const name = state.teams[side].name || SIDE_LABEL[side]
  const won = setsWon(state)[side]
  const finished = state.status === 'finished'
  const winner = matchWinner(state) === side
  const serving = state.serving === side && !finished
  const { gen, ghost, popped, serveFrom } = transitions
  // The pip that just filled is the one at index won - 1.
  const popping = popped.includes(side)
  const other = side === 'visitor' ? 'home' : 'visitor'
  const sideClass = side === 'visitor' ? styles.serveVisitor : styles.serveHome

  return (
    <section className={styles.team} aria-label={`${SIDE_LABEL[side]} team`}>
      <h2 className={winner ? styles.winnerName : styles.name}>{name}</h2>
      {/* A finished match has no live set: the sets won stand in its place. */}
      <p
        className={styles.score}
        aria-label={`${SIDE_LABEL[side]} ${finished ? 'sets won' : 'score'}`}
      >
        <RollingNumber value={finished ? won : state.current[side]} />
        {ghost && (
          // Drawn from the closed set over the truthful reset digits; a newer
          // change drops it (see useBoardTransitions).
          <span
            key={gen}
            className={
              ghost[side] > ghost[other] ? styles.ghostWon : styles.ghost
            }
            aria-hidden="true"
          >
            {ghost[side]}
          </span>
        )}
      </p>
      <p className={styles.sets}>
        <span className={styles.label}>Sets</span>
        <span
          className={styles.pips}
          role="img"
          aria-label={`${won} of ${state.config.setsToWin} sets won`}
        >
          {Array.from({ length: state.config.setsToWin }, (_, i) => (
            <span
              key={i === won - 1 && popping ? `${i}:${gen}` : i}
              className={
                i < won
                  ? i === won - 1 && popping
                    ? styles.pipPop
                    : styles.pipWon
                  : styles.pip
              }
            />
          ))}
        </span>
      </p>
      {serving && (
        <span
          key={serveFrom === null ? 'still' : `in:${gen}`}
          className={`${serveFrom === null ? styles.serve : styles.serveIn} ${sideClass}`}
          role="img"
          aria-label="Serving"
        />
      )}
      {serveFrom === side && !finished && (
        <span
          key={`out:${gen}`}
          className={`${styles.serveOut} ${sideClass}`}
          aria-hidden="true"
        />
      )}
    </section>
  )
}

export function VolleyballBoard({
  state,
  connected,
  subscribeNotices,
}: BoardProps<VolleyballState, VolleyballMessage>) {
  const banner = useBanner(subscribeNotices, undefined, BANNER_TIMING)
  const transitions = useBoardTransitions(state)
  const finished = state.status === 'finished'
  const winner = matchWinner(state)
  // A finished match has no live set: keep showing the one that decided it.
  const setNumber = finished
    ? state.completed.length
    : state.completed.length + 1

  return (
    <div className={styles.viewport}>
      <div className={styles.stage} data-testid="board-stage">
        <div className={styles.board}>
          <h1 className="assistive-only">Volleyball scoreboard</h1>

          <Team side="visitor" state={state} transitions={transitions} />

          <section className={styles.centre} aria-label="Set">
            <h2 className={styles.label}>{finished ? 'Match over' : 'Set'}</h2>
            <p className={styles.setNumber}>{setNumber}</p>
            {finished && winner && (
              <p className={styles.final}>
                {state.teams[winner].name || SIDE_LABEL[winner]} wins
              </p>
            )}
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

          <Team side="home" state={state} transitions={transitions} />

          {/* Keeps the bottom row's height; the banner is drawn over it. */}
          <div className={styles.slot} aria-hidden="true">
            Updates
          </div>
          <div className={styles.slotEnd} aria-hidden="true">
            Updates
          </div>
          {banner && banner.notice.type === 'set-won' && (
            <SetBanner
              key={banner.key}
              notice={banner.notice}
              phase={banner.phase}
              names={{
                visitor: state.teams.visitor.name || SIDE_LABEL.visitor,
                home: state.teams.home.name || SIDE_LABEL.home,
              }}
            />
          )}
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
