import { useRef, useState } from 'react'
import type { TeamSide } from '../state'
import { ScoreSheet } from './ScoreSheet'
import styles from './TeamColumn.module.css'

interface Props {
  side: TeamSide
  /** The name to show: falls back to the side's label when empty. */
  name: string
  /** The name as typed, possibly empty. */
  rawName: string
  onRename: (name: string) => void
  /** The score to show: the pending −1 value if there is one. */
  score: number
  /** The −1 has not been committed to the match yet. */
  pending: boolean
  serving: boolean
  /** 0-0: the toggle picks who serves first. */
  freshSet: boolean
  finished: boolean
  onPoint: () => void
  onServe: () => void
  onMinus: () => void
  /** Apply an absolute score from the keypad. */
  onSetScore: (score: number) => void
}

const SIDE_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

export function TeamColumn({
  side,
  name,
  rawName,
  onRename,
  score,
  pending,
  serving,
  freshSet,
  finished,
  onPoint,
  onServe,
  onMinus,
  onSetScore,
}: Props) {
  const label = SIDE_LABEL[side]
  const [keypad, setKeypad] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  // The keypad can't outlive the match: Apply would target a dead set.
  const sheetOpen = keypad && !finished
  const close = () => {
    setKeypad(false)
    opener.current?.focus()
  }
  return (
    <section className={styles.column} aria-label={`${label} team`}>
      {/* Inert while the keypad covers it, so Tab and taps can't reach it. */}
      <div className={styles.covered} inert={sheetOpen}>
        <input
          className={styles.name}
          type="text"
          aria-label={`${label} team name`}
          value={rawName}
          placeholder={label}
          onChange={(e) => onRename(e.target.value)}
        />

        {/* The point button stretches over the whole tile (see .point::after). */}
        <div className={styles.tile}>
          <output
            className={pending ? styles.scorePending : styles.score}
            aria-label={`${label} score`}
            aria-live="off"
          >
            {score}
          </output>
          <button
            type="button"
            className={styles.point}
            aria-label={`Point for ${name}`}
            disabled={finished}
            onClick={onPoint}
          >
            Tap for point
          </button>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.serve}
            aria-pressed={serving}
            disabled={finished}
            onClick={onServe}
          >
            {freshSet ? 'Serve first' : 'Serve'}
          </button>
          <button
            type="button"
            className={styles.minus}
            aria-label={`−1 point from ${name}`}
            disabled={finished || score === 0}
            onClick={onMinus}
          >
            −1
          </button>
          <button
            ref={opener}
            type="button"
            className={styles.setScore}
            aria-label={`Set score for ${name}`}
            disabled={finished}
            onClick={() => setKeypad(true)}
          >
            Set score
          </button>
        </div>
      </div>

      {sheetOpen && (
        <ScoreSheet
          teamName={name}
          currentScore={score}
          onApply={(next) => {
            if (next !== undefined) onSetScore(next)
            close()
          }}
          onCancel={close}
        />
      )}
    </section>
  )
}
