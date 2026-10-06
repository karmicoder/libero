import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { ConsoleProps } from '../../../consoles/registry'
import { useMatchState } from '../../../match/useMatchState'
import type {
  CardColor,
  FootballAction,
  FootballMessage,
  FootballState,
  TeamSide,
} from '../state'
import { cardToast } from './cardToast'
import { CentrePanel } from './CentrePanel'
import styles from './FootballConsole.module.css'
import { TeamColumn } from './TeamColumn'

const TOAST_MS = 3000

/** Space toggles the clock, unless focus is somewhere it already means something. */
function useSpaceToggle(onToggle: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, button, a, [role="dialog"], [contenteditable="true"]',
        )
      ) {
        return
      }
      e.preventDefault()
      onToggle()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggle])
}

export function FootballConsole({
  store,
  boardConnected,
  boardPath,
}: ConsoleProps<FootballState, FootballAction, FootballMessage>) {
  const state = useMatchState(store)
  const { dispatch } = store

  // The goal sheet that is open, if any: the scoring team and its goal event.
  // It closes by itself if that goal is removed in the meantime.
  const [sheet, setSheet] = useState<{
    side: TeamSide
    eventId: string
  } | null>(null)
  const openSheet =
    sheet && state.events.some((e) => e.id === sheet.eventId) ? sheet : null

  /** Scores at once, held back from the board until details are committed. */
  const addGoal = (side: TeamSide) => {
    dispatch({ type: 'goal', team: side, announce: false, at: Date.now() })
    const event = store.getState().events.at(-1)
    if (event?.type === 'goal') setSheet({ side, eventId: event.id })
  }

  const goalSheetFor = (side: TeamSide) =>
    openSheet?.side === side
      ? {
          onDone: (scorer?: number, assist?: number) => {
            dispatch({
              type: 'set-goal-details',
              eventId: openSheet.eventId,
              scorer,
              assist,
              at: Date.now(),
            })
            setSheet(null)
          },
          onSkip: () => setSheet(null),
        }
      : undefined

  // Which team's column the card sheet covers, if open.
  const [cardSide, setCardSide] = useState<TeamSide | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const cardSheetFor = (side: TeamSide) =>
    cardSide === side
      ? {
          onConfirm: (color: CardColor, team: TeamSide, numbers: number[]) => {
            const before = store.getState().events.length
            dispatch({ type: 'card', team, color, numbers, at: Date.now() })
            const message = cardToast(store.getState().events.slice(before))
            if (message) setToast(message)
            setCardSide(null)
          },
          onCancel: () => setCardSide(null),
        }
      : undefined

  useSpaceToggle(() => {
    const current = store.getState()
    dispatch(
      current.clock.runningSince !== null
        ? { type: 'stop-clock', at: Date.now() }
        : { type: 'start-clock', at: Date.now() },
    )
  })

  return (
    <div className={styles.console}>
      <h1 className="visually-hidden">Football scorer console</h1>
      <div className={styles.topBar}>
        <p
          className={boardConnected ? styles.connected : styles.disconnected}
          role="status"
        >
          <span className={styles.dot} aria-hidden="true" />
          {boardConnected ? 'Board connected' : 'No board connected'}
        </p>
        <div className={styles.topActions}>
          <Link
            to={boardPath}
            target="_blank"
            rel="noopener"
            className={styles.topButton}
          >
            Open scoreboard
          </Link>
          <button type="button" className={styles.topButton} disabled>
            Settings
          </button>
          <button type="button" className={styles.topButton} disabled>
            Undo
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        <TeamColumn
          side="visitor"
          state={state}
          dispatch={dispatch}
          onGoal={addGoal}
          goalSheet={goalSheetFor('visitor')}
          onCard={setCardSide}
          cardSheet={cardSheetFor('visitor')}
        />
        <CentrePanel
          state={state}
          dispatch={dispatch}
          toast={toast}
          onToast={setToast}
        />
        <TeamColumn
          side="home"
          state={state}
          dispatch={dispatch}
          onGoal={addGoal}
          goalSheet={goalSheetFor('home')}
          onCard={setCardSide}
          cardSheet={cardSheetFor('home')}
        />
      </div>
    </div>
  )
}
