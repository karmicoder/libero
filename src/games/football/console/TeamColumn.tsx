import type { FootballAction, FootballState, TeamSide } from '../state'
import { eventSummary, recentEvents, sentOffNumbers, subsUsed } from './events'
import styles from './TeamColumn.module.css'

interface Props {
  side: TeamSide
  state: FootballState
  dispatch: (action: FootballAction) => void
}

const SIDE_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

export function TeamColumn({ side, state, dispatch }: Props) {
  const team = state.teams[side]
  const label = SIDE_LABEL[side]
  const name = team.name || label
  const { substitutions } = state.config
  const subLimit = substitutions.enabled ? substitutions.perPeriod : undefined
  const used = subsUsed(state.events, side, state.periodId)
  const recent = recentEvents(state.events, side)
  const sentOff = sentOffNumbers(state.events, side)

  return (
    <section className={styles.column} aria-label={`${label} team`}>
      <input
        className={styles.name}
        type="text"
        aria-label={`${label} team name`}
        value={team.name}
        placeholder={label}
        onChange={(e) =>
          dispatch({ type: 'set-team-name', team: side, name: e.target.value })
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
          type="button"
          className={styles.step}
          aria-label={`Goal for ${name}`}
          onClick={() => dispatch({ type: 'goal', team: side, at: Date.now() })}
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

      {subLimit !== undefined && (
        <p className={styles.subs}>
          <span className="eyebrow">Subs</span>
          <span className={styles.pips} aria-hidden="true">
            {Array.from({ length: subLimit }, (_, i) => (
              <span
                key={i}
                className={i < subLimit - used ? styles.pipLeft : styles.pip}
              />
            ))}
          </span>
          <span className="visually-hidden">
            {Math.max(0, subLimit - used)} of {subLimit} left this period
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
    </section>
  )
}
