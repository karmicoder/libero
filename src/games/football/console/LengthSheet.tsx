import { useEffect, useId, useRef, useState } from 'react'
import styles from './LengthSheet.module.css'
import {
  formatLength,
  lengthEntry,
  parseLength,
  typeLengthDigit,
} from './lengthEntry'
import { backspace } from './keypad'

interface Props {
  periodName: string
  /** Current length in minutes; undefined means no timer. */
  minutes?: number
  /** Passes undefined for "No timer". */
  onApply: (minutes?: number) => void
  onCancel: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Numeric keypad popover for a period's length in minutes (0-999). An empty
 * entry means "No timer". A non-modal dialog like the console's sheets: it
 * takes focus when it opens and the keyboard works too (digits, Backspace,
 * Enter to apply, Esc to cancel). Esc closes only this popover, not the
 * settings screen around it.
 */
export function LengthSheet({ periodName, minutes, onApply, onCancel }: Props) {
  const titleId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const [entry, setEntry] = useState(lengthEntry(minutes))

  useEffect(() => sheet.current?.focus(), [])

  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault()
      setEntry((v) => typeLengthDigit(v, e.key))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setEntry(backspace)
    } else if (e.key === 'Enter' && e.target === e.currentTarget) {
      e.preventDefault()
      onApply(parseLength(entry))
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
      <h4 id={titleId} className="eyebrow">
        {periodName} length
      </h4>

      <output className={styles.readout} aria-label="New length">
        {formatLength(parseLength(entry))}
      </output>

      <div className={styles.keys} role="group" aria-label="Keypad">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className={styles.key}
            onClick={() => setEntry((v) => typeLengthDigit(v, d))}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={styles.key}
          onClick={() => setEntry('')}
        >
          No timer
        </button>
        <button
          type="button"
          className={styles.key}
          onClick={() => setEntry((v) => typeLengthDigit(v, '0'))}
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
          onClick={() => onApply(parseLength(entry))}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
