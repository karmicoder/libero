import { useEffect, useId, useRef, useState } from 'react'
import styles from './ScoreSheet.module.css'
import { backspace, parseScore, typeScoreDigit } from './scoreEntry'

interface Props {
  teamName: string
  /** Shown when nothing has been entered. */
  currentScore: number
  /** Set the score. An empty entry applies nothing and passes no score. */
  onApply: (score?: number) => void
  onCancel: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Keypad for correcting one team's score in the live set. Digits shift in
 * from the right; an empty entry keeps the current score. It is a non-modal
 * dialog over the team's column: it takes focus when it opens, and the
 * physical keyboard works too (digits, Backspace, Enter to apply, Esc to
 * cancel).
 */
export function ScoreSheet({
  teamName,
  currentScore,
  onApply,
  onCancel,
}: Props) {
  const titleId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const [entry, setEntry] = useState('')

  useEffect(() => sheet.current?.focus(), [])

  const score = parseScore(entry)

  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Handled keys cancel their default action, notably Enter: closing hands
    // focus back to the opener within the same key press, and an uncancelled
    // Enter would then activate it and reopen the sheet.
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault()
      setEntry((v) => typeScoreDigit(v, e.key))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setEntry(backspace)
    } else if (e.key === 'Enter' && e.target === e.currentTarget) {
      // On any focused button Enter already presses that button.
      e.preventDefault()
      onApply(score)
    }
  }
  // The listener is attached once and calls whichever handler is latest.
  const latestHandler = useRef(handleKey)
  useEffect(() => {
    latestHandler.current = handleKey
  })
  useEffect(() => {
    const element = sheet.current
    const listener = (e: KeyboardEvent) => latestHandler.current(e)
    element?.addEventListener('keydown', listener)
    return () => element?.removeEventListener('keydown', listener)
  }, [])

  return (
    <div
      ref={sheet}
      className={styles.sheet}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <h3 id={titleId} className="eyebrow">
        Set score · {teamName}
      </h3>

      <output
        className={entry === '' ? styles.readoutIdle : styles.readout}
        aria-label="New score"
      >
        {score ?? currentScore}
      </output>

      <div className={styles.keys} role="group" aria-label="Keypad">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className={styles.key}
            onClick={() => setEntry((v) => typeScoreDigit(v, d))}
          >
            {d}
          </button>
        ))}
        <span aria-hidden="true" />
        <button
          type="button"
          className={styles.key}
          onClick={() => setEntry((v) => typeScoreDigit(v, '0'))}
        >
          0
        </button>
        <button
          type="button"
          className={styles.key}
          aria-label="Backspace"
          onClick={() => setEntry(backspace)}
        >
          ⌫
        </button>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => onApply(score)}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
