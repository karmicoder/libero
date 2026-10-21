import { useEffect, useId, useRef, useState } from 'react'
import {
  CONFIG_PROBLEM_MESSAGES,
  configProblems,
  defaultVolleyballConfig,
} from '../config'
import type { ConfigProblem } from '../config'
import type { VolleyballConfig } from '../state'
import styles from './SettingsScreen.module.css'

interface Props {
  config: VolleyballConfig
  onSave: (config: VolleyballConfig) => void
  onCancel: () => void
}

type Field = 'setsToWin' | 'pointsPerSet' | 'deciderPoints' | 'winBy' | 'cap'

const FIELDS: { key: Exclude<Field, 'cap'>; label: string; hint: string }[] = [
  { key: 'setsToWin', label: 'Sets to win', hint: '3 is best of 5' },
  { key: 'pointsPerSet', label: 'Points per set', hint: 'Target for a set' },
  {
    key: 'deciderPoints',
    label: 'Decider points',
    hint: 'Target in the deciding set',
  },
  { key: 'winBy', label: 'Win by', hint: 'Lead needed once at the target' },
]

const PROBLEM_FIELD: Record<ConfigProblem, Field> = {
  'sets-to-win': 'setsToWin',
  'points-per-set': 'pointsPerSet',
  'decider-points': 'deciderPoints',
  'win-by': 'winBy',
  cap: 'cap',
}

/** Cap suggested when the scorer turns the cap on. */
const suggestedCap = (c: VolleyballConfig) =>
  Math.max(c.pointsPerSet, c.deciderPoints) + 10

type Raw = Record<Field, string>

const toRaw = (c: VolleyballConfig): Raw => ({
  setsToWin: String(c.setsToWin),
  pointsPerSet: String(c.pointsPerSet),
  deciderPoints: String(c.deciderPoints),
  winBy: String(c.winBy),
  cap: c.cap === undefined ? '' : String(c.cap),
})

/** An empty or malformed field becomes NaN, which `configProblems` rejects. */
const parse = (text: string) => (text.trim() === '' ? NaN : Number(text))

/**
 * Editor for the match rules, shown in place of the team columns. It works
 * on a draft: Save applies it at once (also mid-match), Cancel drops it, and
 * Reset to defaults only resets the form. Team names are not here; they are
 * edited inline on the console.
 */
export function SettingsScreen({ config, onSave, onCancel }: Props) {
  const titleId = useId()
  const screen = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // Text, so a field can be emptied while typing a new number.
  const [raw, setRaw] = useState(() => toRaw(config))
  const [capOn, setCapOn] = useState(config.cap !== undefined)

  useEffect(() => heading.current?.focus(), [])

  // Esc cancels.
  const latestCancel = useRef(onCancel)
  useEffect(() => {
    latestCancel.current = onCancel
  })
  useEffect(() => {
    const element = screen.current
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latestCancel.current()
    }
    element?.addEventListener('keydown', listener)
    return () => element?.removeEventListener('keydown', listener)
  }, [])

  const draft: VolleyballConfig = {
    setsToWin: parse(raw.setsToWin),
    pointsPerSet: parse(raw.pointsPerSet),
    deciderPoints: parse(raw.deciderPoints),
    winBy: parse(raw.winBy),
    ...(capOn ? { cap: parse(raw.cap) } : {}),
  }
  const problems = configProblems(draft)
  const invalid = new Set(problems.map((p) => PROBLEM_FIELD[p]))

  const setField = (key: Field, text: string) =>
    setRaw((r) => ({ ...r, [key]: text }))

  const reset = () => {
    setRaw(toRaw(defaultVolleyballConfig()))
    setCapOn(false)
  }

  const toggleCap = (on: boolean) => {
    setCapOn(on)
    if (on && raw.cap.trim() === '')
      setField('cap', String(suggestedCap(draft)))
  }

  return (
    <section className={styles.settings} aria-labelledby={titleId} ref={screen}>
      <div className={styles.header}>
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          Match settings
        </h2>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondary} onClick={reset}>
            Reset to defaults
          </button>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={problems.length > 0}
            onClick={() => onSave(draft)}
          >
            Save
          </button>
        </div>
      </div>

      <fieldset className={styles.group}>
        <legend className="eyebrow">Sets and points</legend>
        <div className={styles.fields}>
          {FIELDS.map(({ key, label, hint }) => (
            <label key={key} className={styles.field}>
              <span className="eyebrow">{label}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={raw[key]}
                aria-invalid={invalid.has(key)}
                onChange={(e) => setField(key, e.target.value)}
              />
              <span className={styles.hint}>{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className="eyebrow">Point cap</legend>
        <label className={styles.switchRow}>
          <input
            type="checkbox"
            role="switch"
            checked={capOn}
            onChange={(e) => toggleCap(e.target.checked)}
          />
          Cap the points in a set
        </label>
        <label className={styles.field}>
          <span className="eyebrow">Cap</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            disabled={!capOn}
            value={raw.cap}
            aria-invalid={invalid.has('cap')}
            onChange={(e) => setField('cap', e.target.value)}
          />
          <span className={styles.hint}>First to the cap wins the set</span>
        </label>
      </fieldset>

      <div role="alert" className={styles.messages}>
        {problems.map((p) => (
          <p key={p}>{CONFIG_PROBLEM_MESSAGES[p]}</p>
        ))}
      </div>
    </section>
  )
}
