import { useRef, useState } from 'react'
import type { TeamSide } from '../state'
import { ScoreSheet } from './ScoreSheet'
import styles from './TeamColumn.module.css'

interface Props {
  side: TeamSide
  name: string
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
  const close = () => {
    setKeypad(false)
    opener.current?.focus()
  }
  return (
    <section className={styles.column} aria-label={`${label} team`}>
      <h2 className={styles.name}>{name}</h2>

      <button
        type="button"
        className={styles.tile}
        aria-label={`Point for ${name}`}
        disabled={finished}
        onClick={onPoint}
      >
        <span
          className={pending ? styles.scorePending : styles.score}
          aria-hidden="true"
        >
          {score}
        </span>
        <span className={styles.hint} aria-hidden="true">
          Tap for point
        </span>
      </button>
      <output
        className="visually-hidden"
        aria-label={`${label} score`}
        aria-live="off"
      >
        {score}
      </output>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.serve}
          aria-pressed={serving}
          disabled={finished}
          onClick={onServe}
        >
          <span className={styles.serveDot} aria-hidden="true" />
          {freshSet ? 'Serve first' : 'Serve'}
        </button>
        <button
          type="button"
          className={styles.minus}
          aria-label={`Subtract one from ${name}`}
          disabled={finished || score === 0}
          onClick={onMinus}
        >
          −1
        </button>
        <button
          ref={opener}
          type="button"
          className={styles.minus}
          aria-label={`Set score for ${name}`}
          disabled={finished}
          onClick={() => setKeypad(true)}
        >
          Set score
        </button>
      </div>

      {keypad && (
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
