import { useEffect, useId, useRef, useState } from 'react'
import type { SubstitutionPair } from '../state'
import styles from './SubSheet.module.css'
import { backspace, parseNumber, typeDigit } from './keypad'

interface Props {
  teamName: string
  /** Substitutions left this period; undefined when there is no limit. */
  remaining?: number
  onConfirm: (pairs: SubstitutionPair[]) => void
  onCancel: () => void
}

type Field = 'off' | 'on'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const FIELDS: [Field, string][] = [
  ['off', 'Off'],
  ['on', 'On'],
]

const show = (n?: number) => (n === undefined ? '–' : `#${n}`)

/**
 * Keypad for a substitution: type the shirt number going off, press "Next ›",
 * type the one coming on, and "+ Add pair" to queue it. Several pairs can be
 * confirmed at once (a triple substitution). Going over the period's limit is
 * guidance, not validation: it shows a warning but confirming stays enabled.
 * Like the other sheets it is a non-modal dialog covering a team column,
 * accepts the physical keyboard (digits, Backspace, Enter for next, add or
 * confirm, Esc to cancel), and focuses itself when it opens.
 */
export function SubSheet({ teamName, remaining, onConfirm, onCancel }: Props) {
  const titleId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const fieldButtons = useRef<Partial<Record<Field, HTMLButtonElement>>>({})
  const [field, setField] = useState<Field>('off')
  const [entry, setEntry] = useState<Record<Field, string>>({ off: '', on: '' })
  const [queued, setQueued] = useState<SubstitutionPair[]>([])

  useEffect(() => sheet.current?.focus(), [])

  const pending: SubstitutionPair = {
    off: parseNumber(entry.off),
    on: parseNumber(entry.on),
  }
  const hasPending = pending.off !== undefined || pending.on !== undefined
  // Whatever is typed but not yet added counts when confirming.
  const pairs = hasPending ? [...queued, pending] : queued
  const overLimit = remaining !== undefined && pairs.length > remaining

  // Buttons that disable themselves would drop focus, and with it the
  // keyboard handler, so focus moves to the field now being entered. Sending
  // it to the sheet instead would make the next Tab land on Off, which
  // selects Off again.
  const focusField = (value: Field) => {
    setField(value)
    fieldButtons.current[value]?.focus()
  }
  const next = () => focusField('on')
  const type = (key: string) =>
    setEntry((v) => ({ ...v, [field]: typeDigit(v[field], key) }))
  const erase = () => setEntry((v) => ({ ...v, [field]: backspace(v[field]) }))
  const add = () => {
    if (!hasPending) return
    setQueued([...queued, pending])
    setEntry({ off: '', on: '' })
    focusField('off')
  }
  const remove = (index: number) =>
    setQueued(queued.filter((_, i) => i !== index))
  const confirm = () => {
    if (pairs.length > 0) onConfirm(pairs)
  }

  const isFieldButton = (target: EventTarget | null) =>
    Object.values(fieldButtons.current).some((button) => button === target)

  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Handled keys cancel their default action, so an Enter that closes the
    // sheet can't then activate the button focus returns to.
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault()
      type(e.key)
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      erase()
    } else if (
      e.key === 'Enter' &&
      (e.target === e.currentTarget || isFieldButton(e.target))
    ) {
      // On any other focused button Enter already presses that button. The
      // field buttons are excluded: focusing one already selects it.
      e.preventDefault()
      if (field === 'off' && entry.off !== '') next()
      else if (hasPending) add()
      else confirm()
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

  const hint = `${remaining === undefined ? '' : `${remaining} left · `}${
    field === 'off' ? 'off first' : 'then on'
  }`

  return (
    <div
      ref={sheet}
      className={styles.sheet}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <p className="eyebrow">Substitution · {teamName}</p>
      <h2 id={titleId} className={styles.title}>
        Make a substitution
      </h2>

      <div className={styles.entryRow}>
        <div
          className={styles.fields}
          role="group"
          aria-label="Number being entered"
        >
          {FIELDS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              ref={(el) => {
                if (el) fieldButtons.current[value] = el
              }}
              className={styles.field}
              aria-pressed={field === value}
              // Focus selects too, so Tab-ing to a field makes it the one
              // that digits type into. Click covers browsers that don't
              // focus buttons on click.
              onFocus={() => setField(value)}
              onClick={() => setField(value)}
            >
              <span className="eyebrow">{label}</span>
              <span className={styles.value}>{entry[value] || '–'}</span>
            </button>
          ))}
        </div>
        <div className={styles.steps}>
          <button
            type="button"
            className={styles.step}
            disabled={field === 'on'}
            onClick={next}
          >
            Next ›
          </button>
          <button
            type="button"
            className={styles.step}
            disabled={!hasPending}
            onClick={add}
          >
            + Add pair
          </button>
        </div>
      </div>

      <p className={styles.hint} role="status">
        {hint}
      </p>
      {overLimit && (
        <p className={styles.warning} role="alert">
          {remaining} left — this will exceed the limit
        </p>
      )}

      {queued.length === 0 ? (
        <p className={styles.empty}>No pairs yet</p>
      ) : (
        <ul className={styles.pairs} aria-label="Queued pairs">
          {queued.map((pair, i) => (
            <li key={i} className={styles.pair}>
              {show(pair.off)} off · {show(pair.on)} on
              <button
                type="button"
                className={styles.removePair}
                aria-label={`Remove pair ${i + 1}`}
                onClick={() => remove(i)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.keys} role="group" aria-label="Keypad">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className={styles.key}
            onClick={() => type(d)}
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
        <button type="button" className={styles.key} onClick={() => type('0')}>
          0
        </button>
        <button
          type="button"
          className={`primary ${styles.confirm}`}
          disabled={pairs.length === 0}
          onClick={confirm}
        >
          {pairs.length === 0
            ? 'Confirm'
            : `Confirm ${pairs.length} substitution${pairs.length === 1 ? '' : 's'}`}
        </button>
      </div>

      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
