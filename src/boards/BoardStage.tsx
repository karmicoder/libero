import type { ReactNode } from 'react'
import { Wordmark } from '../components/Wordmark'
import styles from './BoardStage.module.css'

interface BoardStageProps {
  /** Accessible page title, e.g. "Football scoreboard". */
  title: string
  connected: boolean
  /** The sport's grid class: layout and the tokens the chrome reads. */
  gridClassName: string
  /** The active update banner, drawn over the reserved slots. */
  banner?: ReactNode
  children: ReactNode
}

/** The scaled 16:9 stage and chrome every scoreboard shares. The sport's
 * `children` fill its grid; the update slots, wordmark and disconnected
 * status are added here. The grid class must define `--pad`, `--label-size`
 * and `--slot-height` (and may set `--slot-margin`); the chrome reads them. */
export function BoardStage({
  title,
  connected,
  gridClassName,
  banner,
  children,
}: BoardStageProps) {
  return (
    <div className={styles.viewport}>
      <div className={styles.stage} data-testid="board-stage">
        <div className={`${styles.board} ${gridClassName}`}>
          <h1 className="assistive-only">{title}</h1>

          {children}

          {/* Keeps the bottom row's height; the banner is drawn over it. */}
          <div className={styles.slot} aria-hidden="true">
            Updates
          </div>
          <div className={styles.slotEnd} aria-hidden="true">
            Updates
          </div>
          {banner}
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
