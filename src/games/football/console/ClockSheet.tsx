import { useEffect, useId, useRef, useState } from 'react'
import { formatClock } from '../clock'
import styles from './ClockSheet.module.css'
import {
  entryForSeconds,
  parseClockEntry,
  typeClockDigit,
  typeDoubleZero,
} from './clockEntry'
import { backspace } from './keypad'

interface Props {
  /** The time shown when nothing has been entered, in whole seconds. */
  currentSeconds: number
  /** Preset times in seconds, derived from the configured periods. */
  presets: number[]
  /** Set the clock. An empty entry applies nothing and passes no time. */
  onApply: (time?: { minutes: number; seconds: number }) => void
  onCancel: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Keypad for setting the match clock. Digits shift in from the right as
 * `mm:ss`; seconds clamp to 59 and an empty entry keeps the current time. It
 * is a non-modal dialog over the clock panel: it takes focus when it opens,
 * and the physical keyboard works too (digits, Backspace, Enter to apply, Esc
 * to cancel).
 */
export function ClockSheet({
  currentSeconds,
  presets,
  onApply,
  onCancel,
}: Props) {
  const titleId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const [entry, setEntry] = useState('')

  useEffect(() => sheet.current?.focus(), [])

  const time = parseClockEntry(entry)
  const shown = time
    ? formatClock(time.minutes * 60 + time.seconds)
    : formatClock(currentSeconds)

  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Handled keys cancel their default action, notably Enter: closing hands
    // focus back to "Set clock" within the same key press, and an uncancelled
    // Enter would then activate it and reopen the sheet.
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault()
      setEntry((v) => typeClockDigit(v, e.key))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setEntry(backspace)
    } else if (e.key === 'Enter' && e.target === e.currentTarget) {
      // On any focused button Enter already presses that button.
      e.preventDefault()
      onApply(time)
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
        Set clock
      </h3>

      <output
        className={entry === '' ? styles.readoutIdle : styles.readout}
        aria-label="New clock time"
      >
        {shown}
      </output>

      <div className={styles.presets} role="group" aria-label="Presets">
        {presets.map((seconds) => (
          <button
            key={seconds}
            type="button"
            className={styles.preset}
            onClick={() => setEntry(entryForSeconds(seconds))}
          >
            {formatClock(seconds)}
          </button>
        ))}
      </div>

      <div className={styles.keys} role="group" aria-label="Keypad">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className={styles.key}
            onClick={() => setEntry((v) => typeClockDigit(v, d))}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={styles.key}
          onClick={() => setEntry(typeDoubleZero)}
        >
          00
        </button>
        <button
          type="button"
          className={styles.key}
          onClick={() => setEntry((v) => typeClockDigit(v, '0'))}
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
        <button type="button" className="primary" onClick={() => onApply(time)}>
          Apply
        </button>
      </div>
    </div>
  )
}
