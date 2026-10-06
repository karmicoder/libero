import { useEffect, useId, useRef, useState } from 'react'
import { cautionedNumbers } from '../cards'
import type { CardColor, MatchEvent, TeamSide } from '../state'
import styles from './CardSheet.module.css'
import { backspace, parseNumber, typeDigit } from './keypad'

interface Props {
  /** The team whose column opened the sheet; the toggle can change it. */
  initialTeam: TeamSide
  teamNames: Record<TeamSide, string>
  /** The match log, to tell which numbers already have a yellow. */
  events: MatchEvent[]
  onConfirm: (color: CardColor, team: TeamSide, numbers: number[]) => void
  onCancel: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const COLORS: [CardColor, string][] = [
  ['yellow', 'Yellow'],
  ['red', 'Red'],
]
const TEAMS: TeamSide[] = ['visitor', 'home']
const TEAM_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

/**
 * Keypad for a card: pick the colour and team, type shirt numbers and queue
 * several with "+ Add". It is guidance, not validation: nothing stops an
 * unusual sequence, but a yellow for a number that already has one is flagged
 * as a second yellow (the engine turns it into a red). Like the goal sheet it
 * is a non-modal dialog covering a team column, accepts the physical keyboard
 * (digits, Backspace, Enter to add or confirm, Esc to cancel), and focuses
 * itself when it opens.
 */
export function CardSheet({
  initialTeam,
  teamNames,
  events,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const [color, setColor] = useState<CardColor>('yellow')
  const [team, setTeam] = useState<TeamSide>(initialTeam)
  const [entry, setEntry] = useState('')
  const [queued, setQueued] = useState<number[]>([])

  useEffect(() => sheet.current?.focus(), [])

  const cautioned = new Set(cautionedNumbers(events, team))
  const isSecond = (n: number) => color === 'yellow' && cautioned.has(n)
  const typed = parseNumber(entry)
  // Whatever is typed but not yet added counts when confirming.
  const numbers =
    typed !== undefined && !queued.includes(typed) ? [...queued, typed] : queued

  const hint =
    typed !== undefined && isSecond(typed)
      ? '2nd yellow → RED'
      : numbers.length === 0
        ? 'Enter jersey #'
        : 'Add more or confirm'

  const add = () => {
    if (typed !== undefined && !queued.includes(typed)) {
      setQueued([...queued, typed])
    }
    setEntry('')
  }
  const remove = (n: number) => setQueued(queued.filter((q) => q !== n))
  const confirm = () => {
    if (numbers.length > 0) onConfirm(color, team, numbers)
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Handled keys cancel their default action, so an Enter that closes the
    // sheet can't then activate the button focus returns to.
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault()
      setEntry((v) => typeDigit(v, e.key))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setEntry(backspace)
    } else if (e.key === 'Enter' && e.target === e.currentTarget) {
      // On a focused button Enter already presses that button.
      e.preventDefault()
      if (typed !== undefined) add()
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

  return (
    <div
      ref={sheet}
      className={styles.sheet}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <p className="eyebrow">Card · {teamNames[team]}</p>
      <h2 id={titleId} className={styles.title}>
        Show a card
      </h2>

      <div className={styles.toggles}>
        <fieldset className={styles.segment}>
          <legend className="visually-hidden">Card colour</legend>
          {COLORS.map(([value, label]) => (
            <label key={value} className={styles.option} data-color={value}>
              <input
                type="radio"
                name="card-color"
                checked={color === value}
                onChange={() => setColor(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.segment}>
          <legend className="visually-hidden">Team</legend>
          {TEAMS.map((value) => (
            <label key={value} className={styles.option}>
              <input
                type="radio"
                name="card-team"
                checked={team === value}
                onChange={() => {
                  // Queued numbers belong to the team they were typed for.
                  setTeam(value)
                  setQueued([])
                  setEntry('')
                }}
              />
              {TEAM_LABEL[value]}
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.entryRow}>
        <p className={styles.entry}>
          <span className="eyebrow">Jersey #</span>
          <span className={styles.value}>{entry || '–'}</span>
        </p>
        <button
          type="button"
          className={styles.add}
          disabled={typed === undefined || queued.includes(typed)}
          onClick={add}
        >
          + Add
        </button>
      </div>

      <p className={styles.hint} role="status">
        {hint}
      </p>

      {queued.length > 0 && (
        <ul className={styles.chips} aria-label="Queued numbers">
          {queued.map((n) => (
            <li key={n} className={styles.chip} data-color={color}>
              #{n}
              {isSecond(n) && <span className={styles.flag}>2nd yellow</span>}
              <button
                type="button"
                className={styles.removeChip}
                aria-label={`Remove #${n}`}
                onClick={() => remove(n)}
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
            onClick={() => setEntry((v) => typeDigit(v, d))}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={styles.key}
          aria-label="Backspace"
          onClick={() => setEntry(backspace)}
        >
          ⌫
        </button>
        <button
          type="button"
          className={styles.key}
          onClick={() => setEntry((v) => typeDigit(v, '0'))}
        >
          0
        </button>
        <button
          type="button"
          className={`primary ${styles.confirm}`}
          disabled={numbers.length === 0}
          onClick={confirm}
        >
          Confirm
        </button>
      </div>

      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
