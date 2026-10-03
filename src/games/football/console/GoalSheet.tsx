import { useEffect, useId, useRef, useState } from 'react'
import styles from './GoalSheet.module.css'
import { backspace, parseNumber, typeDigit } from './keypad'

interface Props {
  /** The scoring team's name, for the sheet's label. */
  teamName: string
  /** Commit the details and announce the goal. "No assist" passes no assist. */
  onDone: (scorer?: number, assist?: number) => void
  /** Close without details and without announcing (the goal still counts). */
  onSkip: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Two-step keypad for a goal's details: step 1 the scorer, step 2 the assist.
 * Either field can be tapped to jump between steps. It is a non-modal dialog
 * covering the scoring team's column: focus lands on the scorer field when it
 * opens, and the physical keyboard works too (digits, Backspace, Enter on a
 * field to advance, Esc to skip).
 */
export function GoalSheet({ teamName, onDone, onSkip }: Props) {
  const titleId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [scorer, setScorer] = useState('')
  const [assist, setAssist] = useState('')

  const fields = useRef<(HTMLButtonElement | null)[]>([])

  // Open on the scorer field, so a keyboard user can type at once and a single
  // Tab reaches the assist.
  useEffect(() => fields.current[0]?.focus(), [])

  const setCurrent = step === 1 ? setScorer : setAssist
  const press = (key: string) => setCurrent((v) => typeDigit(v, key))
  const erase = () => setCurrent(backspace)
  const advance = () =>
    step === 1 ? setStep(2) : onDone(parseNumber(scorer), parseNumber(assist))

  // Physical keyboard, added as a listener rather than a JSX handler: the
  // dialog itself isn't interactive, it just also accepts typed digits.
  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Handled keys cancel their default action. This matters for Enter: the
    // sheet closing hands focus back to the "+" button within the same key
    // press, and an uncancelled Enter would then activate it and reopen.
    if (e.key === 'Escape') {
      e.preventDefault()
      onSkip()
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault()
      press(e.key)
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      erase()
    } else if (
      e.key === 'Enter' &&
      (e.target === e.currentTarget ||
        fields.current.some((f) => f === e.target))
    ) {
      // On the sheet or a field Enter means "next"; on any other focused
      // button it already presses that button.
      e.preventDefault()
      // Keep focus on the field being entered.
      if (step === 1) fields.current[1]?.focus()
      advance()
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
      <p className="eyebrow">Goal · {teamName}</p>
      <h3 id={titleId} className={styles.title}>
        Step {step} of 2 · {step === 1 ? 'Scorer' : 'Assist'}
      </h3>

      <div className={styles.fields}>
        {(
          [
            [1, 'Scorer', scorer],
            [2, 'Assist', assist],
          ] as const
        ).map(([n, label, value]) => (
          <button
            key={n}
            ref={(el) => {
              fields.current[n - 1] = el
            }}
            type="button"
            className={styles.field}
            aria-current={step === n ? 'step' : undefined}
            // Focus (Tab, Shift+Tab or a click) makes this the field being
            // entered, so a keyboard user can move between them.
            onFocus={() => setStep(n)}
            onClick={() => setStep(n)}
          >
            <span className="eyebrow">{label}</span>
            <span className={styles.value}>{value || '–'}</span>
          </button>
        ))}
      </div>

      <div className={styles.keys} role="group" aria-label="Keypad">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className={styles.key}
            onClick={() => press(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={styles.key}
          aria-label="Backspace"
          onClick={erase}
        >
          ⌫
        </button>
        <button type="button" className={styles.key} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className={`primary ${styles.advance}`}
          onClick={advance}
        >
          {step === 1 ? 'Next ›' : 'Done'}
        </button>
      </div>

      {step === 1 ? (
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip details
        </button>
      ) : (
        <button
          type="button"
          className={styles.skip}
          onClick={() => onDone(parseNumber(scorer), undefined)}
        >
          No assist
        </button>
      )}
    </div>
  )
}
