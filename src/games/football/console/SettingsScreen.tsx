import { useEffect, useId, useRef, useState } from 'react'
import {
  CONFIG_PROBLEM_MESSAGES,
  configProblems,
  defaultMatchConfig,
} from '../config'
import type { MatchConfig, PeriodConfig, PeriodKind } from '../state'
import { LengthSheet } from './LengthSheet'
import { formatLength } from './lengthEntry'
import styles from './SettingsScreen.module.css'

interface Props {
  config: MatchConfig
  currentPeriodId: string
  /** Period ids the match log refers to, so a new period never reuses one. */
  reservedIds: string[]
  onSave: (config: MatchConfig) => void
  onCancel: () => void
}

const MIN_SUBS = 1
const MAX_SUBS = 9
const MAX_ABBREVIATION = 4

const KINDS: [PeriodKind, string][] = [
  ['play', 'Play'],
  ['break', 'Break'],
  ['shootout', 'Shootout'],
]

const clone = (config: MatchConfig): MatchConfig => structuredClone(config)

function freshId(used: Set<string>): string {
  let n = used.size + 1
  while (used.has(`p${n}`)) n++
  return `p${n}`
}

/**
 * Editor for the match configuration, shown in place of the team columns. It
 * works on a draft: Save applies it at once (also mid-match), Cancel drops
 * it, and Reset to defaults only resets the form. Only what would leave the
 * match invalid is blocked (removing the current period, having no play
 * period); everything else is the scorer's call.
 */
export function SettingsScreen({
  config,
  currentPeriodId,
  reservedIds,
  onSave,
  onCancel,
}: Props) {
  const titleId = useId()
  const screen = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [draft, setDraft] = useState(() => clone(config))
  // Which period's length keypad is open, and what blocked the last removal.
  const [lengthFor, setLengthFor] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const nameInputs = useRef(new Map<string, HTMLInputElement>())
  const lengthButtons = useRef(new Map<string, HTMLButtonElement>())
  const focusNewName = useRef<string | null>(null)

  useEffect(() => heading.current?.focus(), [])

  // Esc cancels. The length keypad stops its own Esc from getting this far.
  const latestCancel = useRef(onCancel)
  useEffect(() => {
    latestCancel.current = onCancel
  })
  useEffect(() => {
    const element = screen.current
    const listener = (e: KeyboardEvent) => {
      // Esc in an open dropdown only closes the dropdown.
      if (e.key === 'Escape' && !(e.target instanceof HTMLSelectElement)) {
        latestCancel.current()
      }
    }
    element?.addEventListener('keydown', listener)
    return () => element?.removeEventListener('keydown', listener)
  }, [])
  useEffect(() => {
    if (focusNewName.current === null) return
    nameInputs.current.get(focusNewName.current)?.focus()
    focusNewName.current = null
  })

  const problems = configProblems(draft, currentPeriodId)
  const edit = (change: (d: MatchConfig) => void) => {
    setBlocked(null)
    setDraft((d) => {
      const next = clone(d)
      change(next)
      return next
    })
  }
  const editPeriod = (id: string, change: (p: PeriodConfig) => void) =>
    edit((d) => {
      const p = d.periods.find((x) => x.id === id)
      if (p) change(p)
    })

  const subs = draft.substitutions
  const limit = subs.perPeriod ?? defaultMatchConfig().substitutions.perPeriod!

  const move = (index: number, by: -1 | 1) =>
    edit((d) => {
      const [p] = d.periods.splice(index, 1)
      d.periods.splice(index + by, 0, p)
    })

  const remove = (id: string) => {
    const candidate = clone(draft)
    candidate.periods = candidate.periods.filter((p) => p.id !== id)
    const [problem] = configProblems(candidate, currentPeriodId)
    if (problem) {
      setBlocked(CONFIG_PROBLEM_MESSAGES[problem])
      return
    }
    setBlocked(null)
    setDraft(candidate)
  }

  const add = () =>
    edit((d) => {
      const used = new Set([...reservedIds, ...d.periods.map((p) => p.id)])
      const id = freshId(used)
      const n = d.periods.length + 1
      d.periods.push({
        id,
        name: `Period ${n}`,
        abbreviation: `P${n}`,
        lengthMinutes: 15,
        kind: 'play',
      })
      focusNewName.current = id
    })

  const closeLength = () => {
    const id = lengthFor
    setLengthFor(null)
    if (id) queueMicrotask(() => lengthButtons.current.get(id)?.focus())
  }

  const messages = [
    ...problems.map((p) => CONFIG_PROBLEM_MESSAGES[p]),
    ...(blocked && !problems.some((p) => CONFIG_PROBLEM_MESSAGES[p] === blocked)
      ? [blocked]
      : []),
  ]

  return (
    <section className={styles.settings} aria-labelledby={titleId} ref={screen}>
      <div className={styles.header}>
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          Match settings
        </h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setBlocked(null)
              setDraft(defaultMatchConfig())
            }}
          >
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

      <div className={styles.toggles}>
        <fieldset className={styles.group}>
          <legend className="eyebrow">Substitutions</legend>
          <label className={styles.switchRow}>
            <input
              type="checkbox"
              role="switch"
              checked={subs.enabled}
              onChange={(e) =>
                edit((d) => {
                  d.substitutions.enabled = e.target.checked
                  d.substitutions.perPeriod ??= limit
                })
              }
            />
            Track substitutions
          </label>
          <div
            className={styles.stepper}
            role="group"
            aria-label="Substitutions per period"
          >
            <span id={`${titleId}-limit`}>Per period</span>
            <button
              type="button"
              className={styles.step}
              aria-label="Fewer substitutions"
              disabled={!subs.enabled || limit <= MIN_SUBS}
              onClick={() =>
                edit((d) => {
                  d.substitutions.perPeriod = Math.max(MIN_SUBS, limit - 1)
                })
              }
            >
              −
            </button>
            <output aria-labelledby={`${titleId}-limit`}>{limit}</output>
            <button
              type="button"
              className={styles.step}
              aria-label="More substitutions"
              disabled={!subs.enabled || limit >= MAX_SUBS}
              onClick={() =>
                edit((d) => {
                  d.substitutions.perPeriod = Math.min(MAX_SUBS, limit + 1)
                })
              }
            >
              +
            </button>
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className="eyebrow">Stoppage time</legend>
          <label className={styles.switchRow}>
            <input
              type="checkbox"
              role="switch"
              checked={draft.stoppageTime.enabled}
              onChange={(e) =>
                edit((d) => {
                  d.stoppageTime.enabled = e.target.checked
                })
              }
            />
            Show added time
          </label>
        </fieldset>
      </div>

      <section className={styles.periods} aria-labelledby={`${titleId}-p`}>
        <h3 id={`${titleId}-p`} className="eyebrow">
          Periods
        </h3>
        <ol className={styles.list}>
          {draft.periods.map((p, i) => {
            const current = p.id === currentPeriodId
            return (
              <li key={p.id} className={styles.period}>
                <div className={styles.fields}>
                  <label className={styles.field}>
                    <span className="eyebrow">Name</span>
                    <input
                      type="text"
                      value={p.name}
                      ref={(el) => {
                        if (el) nameInputs.current.set(p.id, el)
                        else nameInputs.current.delete(p.id)
                      }}
                      onChange={(e) =>
                        editPeriod(p.id, (x) => {
                          x.name = e.target.value
                        })
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span className="eyebrow">Abbr.</span>
                    <input
                      type="text"
                      className={styles.abbreviation}
                      value={p.abbreviation}
                      maxLength={MAX_ABBREVIATION}
                      onChange={(e) =>
                        editPeriod(p.id, (x) => {
                          x.abbreviation = e.target.value
                            .toUpperCase()
                            .slice(0, MAX_ABBREVIATION)
                        })
                      }
                    />
                  </label>
                  <div className={styles.field}>
                    <span className="eyebrow">Length</span>
                    <button
                      type="button"
                      className={styles.lengthButton}
                      aria-label={`${p.name} length: ${formatLength(p.lengthMinutes)}`}
                      ref={(el) => {
                        if (el) lengthButtons.current.set(p.id, el)
                        else lengthButtons.current.delete(p.id)
                      }}
                      onClick={() => setLengthFor(p.id)}
                    >
                      {formatLength(p.lengthMinutes)}
                    </button>
                  </div>
                  <label className={styles.field}>
                    <span className="eyebrow">Kind</span>
                    <select
                      value={p.kind}
                      onChange={(e) =>
                        editPeriod(p.id, (x) => {
                          x.kind = e.target.value as PeriodKind
                        })
                      }
                    >
                      {KINDS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={styles.rowActions}>
                  {current && <span className={styles.current}>Current</span>}
                  <button
                    type="button"
                    className={styles.step}
                    aria-label={`Move ${p.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.step}
                    aria-label={`Move ${p.name} down`}
                    disabled={i === draft.periods.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    aria-label={`Remove ${p.name}`}
                    onClick={() => remove(p.id)}
                  >
                    Remove
                  </button>
                </div>
                {lengthFor === p.id && (
                  <LengthSheet
                    periodName={p.name}
                    minutes={p.lengthMinutes}
                    onApply={(minutes) => {
                      editPeriod(p.id, (x) => {
                        if (minutes === undefined) delete x.lengthMinutes
                        else x.lengthMinutes = minutes
                      })
                      closeLength()
                    }}
                    onCancel={closeLength}
                  />
                )}
              </li>
            )
          })}
        </ol>
        <button type="button" className={styles.secondary} onClick={add}>
          Add period
        </button>
      </section>

      <div role="alert" className={styles.messages}>
        {messages.map((m) => (
          <p key={m}>{m}</p>
        ))}
      </div>
    </section>
  )
}
