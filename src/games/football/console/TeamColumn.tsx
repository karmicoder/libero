import { useEffect, useRef } from 'react'
import type { FootballAction, FootballState, TeamSide } from '../state'
import { sentOffNumbers } from '../cards'
import { subLimit } from '../subs'
import { eventSummary, recentEvents } from './events'
import { GoalSheet } from './GoalSheet'
import styles from './TeamColumn.module.css'

interface Props {
  side: TeamSide
  state: FootballState
  dispatch: (action: FootballAction) => void
  /** Called to score a goal; the console then opens the goal sheet. */
  onGoal: (side: TeamSide) => void
  /** Present while this team's goal sheet is open. */
  goalSheet?: {
    onDone: (scorer?: number, assist?: number) => void
    onSkip: () => void
  }
}

const SIDE_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

export function TeamColumn({
  side,
  state,
  dispatch,
  onGoal,
  goalSheet,
}: Props) {
  const team = state.teams[side]
  const label = SIDE_LABEL[side]
  const name = team.name || label
  const { substitutions } = state.config
  const configured = subLimit(state.config)
  const left = state.subsRemaining[side]
  // Normally one pip per allowed sub; a manual raise shows the extra pips.
  const pipCount =
    configured === undefined ? undefined : Math.max(configured, left)
  const recent = recentEvents(state.events, side)
  const sentOff = sentOffNumbers(state.events, side)

  // When the sheet closes, focus goes back to the button that opened it.
  const goalButton = useRef<HTMLButtonElement>(null)
  const sheetWasOpen = useRef(false)
  const sheetOpen = goalSheet !== undefined
  useEffect(() => {
    if (sheetWasOpen.current && !sheetOpen) goalButton.current?.focus()
    sheetWasOpen.current = sheetOpen
  }, [sheetOpen])

  return (
    <section className={styles.column} aria-label={`${label} team`}>
      {/* Inert while the sheet covers it, so Tab stays in the sheet. */}
      <div className={styles.content} inert={sheetOpen}>
        <input
          className={styles.name}
          type="text"
          aria-label={`${label} team name`}
          value={team.name}
          placeholder={label}
          onChange={(e) =>
            dispatch({
              type: 'set-team-name',
              team: side,
              name: e.target.value,
            })
          }
        />

        <div className={styles.scoreRow}>
          <button
            type="button"
            className={styles.step}
            aria-label={`Remove goal for ${name}`}
            disabled={team.score === 0}
            onClick={() => dispatch({ type: 'remove-goal', team: side })}
          >
            −
          </button>
          <output
            className={styles.score}
            aria-label={`${label} score`}
            aria-live="off"
          >
            {team.score}
          </output>
          <button
            ref={goalButton}
            type="button"
            className={styles.step}
            aria-label={`Goal for ${name}`}
            onClick={() => onGoal(side)}
          >
            +
          </button>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.action} disabled>
            Card
          </button>
          {substitutions.enabled && (
            <button type="button" className={styles.action} disabled>
              Substitution
            </button>
          )}
        </div>

        {pipCount !== undefined && (
          <p className={styles.subs}>
            <span className="eyebrow">Subs</span>
            <span className={styles.pips} aria-hidden="true">
              {Array.from({ length: pipCount }, (_, i) => (
                <span
                  key={i}
                  className={i < left ? styles.pipLeft : styles.pip}
                />
              ))}
            </span>
            <span className="visually-hidden">
              {left} of {pipCount} left this period
            </span>
          </p>
        )}

        {sentOff.length > 0 && (
          <p className={styles.sentOff}>
            <span className="eyebrow">Sent off</span>{' '}
            {sentOff.map((n) => `#${n}`).join(' ')}
          </p>
        )}

        <div>
          <h2 className="eyebrow">Recent events</h2>
          {recent.length === 0 ? (
            <p className={styles.empty}>None yet</p>
          ) : (
            <ol className={styles.events}>
              {recent.map((e) => (
                <li key={e.id}>{eventSummary(e)}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {goalSheet && (
        <GoalSheet
          teamName={name}
          onDone={goalSheet.onDone}
          onSkip={goalSheet.onSkip}
        />
      )}
    </section>
  )
}
