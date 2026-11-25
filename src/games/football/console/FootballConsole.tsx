import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router'
import type { ConsoleProps } from '../../../consoles/registry'
import { useDebouncedCommit } from '../../../match/useDebouncedCommit'
import { useMatchState } from '../../../match/useMatchState'
import { useUndoHotkeys } from '../../../match/useUndoHotkeys'
import { monotonicNow } from '../../../match/useNow'
import { useWallClockJump } from '../../../match/useWallClockJump'
import type {
  CardColor,
  FootballAction,
  FootballMessage,
  FootballState,
  SubstitutionPair,
  TeamSide,
} from '../state'
import { cardToast } from './cardToast'
import { CentrePanel } from './CentrePanel'
import styles from './FootballConsole.module.css'
import { InHeader } from '../../../components/HeaderSlot'
import { SettingsScreen } from './SettingsScreen'
import { TeamColumn } from './TeamColumn'

const TOAST_MS = 3000

/** Space toggles the clock, unless focus is somewhere it already means something. */
function useSpaceToggle(onToggle: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
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
  }, [onToggle, enabled])
}

export function FootballConsole({
  store,
  boardConnected,
  boardPath,
}: ConsoleProps<FootballState, FootballAction, FootballMessage>) {
  const state = useMatchState(store)
  const { dispatch } = store

  // The scorer's hand corrections to subs left settle before they dispatch.
  // They live here, not in the columns, so the console can settle them
  // before anything that depends on the count: a period change, an undo or
  // redo, the settings screen.
  const subsLeft = {
    visitor: useDebouncedCommit(state.subsRemaining.visitor, (remaining) =>
      dispatch({ type: 'set-subs-remaining', team: 'visitor', remaining }),
    ),
    home: useDebouncedCommit(state.subsRemaining.home, (remaining) =>
      dispatch({ type: 'set-subs-remaining', team: 'home', remaining }),
    ),
  }
  // Likewise stoppage time, whose repeated presses settle into one dispatch so
  // the board shows +4′ rather than +1′, +2′, +3′, +4′.
  const stoppage = useDebouncedCommit(state.stoppageMinutes ?? 0, (minutes) =>
    dispatch({ type: 'set-stoppage', minutes }),
  )
  const adjustmentPending =
    subsLeft.visitor.pending || subsLeft.home.pending || stoppage.pending
  const flushAdjustments = () => {
    subsLeft.visitor.flush()
    subsLeft.home.flush()
    stoppage.flush()
  }

  // Which team's column the card sheet covers, if open.
  const [cardSide, setCardSide] = useState<TeamSide | null>(null)
  // Likewise for the substitution sheet.
  const [subSide, setSubSide] = useState<TeamSide | null>(null)

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
    setCardSide(null)
    setSubSide(null)
    dispatch({ type: 'goal', team: side, announce: false, at: monotonicNow() })
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
              at: monotonicNow(),
            })
            setSheet(null)
          },
          onSkip: () => setSheet(null),
        }
      : undefined

  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // One sheet at a time: opening one drops whichever other is open.
  const openCardSheet = (side: TeamSide) => {
    setSheet(null)
    setSubSide(null)
    setCardSide(side)
  }
  const openSubSheet = (side: TeamSide) => {
    setSheet(null)
    setCardSide(null)
    setSubSide(side)
  }

  const cardSheetFor = (side: TeamSide) =>
    cardSide === side
      ? {
          onConfirm: (color: CardColor, team: TeamSide, numbers: number[]) => {
            const before = store.getState().events.length
            dispatch({ type: 'card', team, color, numbers, at: monotonicNow() })
            const message = cardToast(store.getState().events.slice(before))
            if (message) setToast(message)
            setCardSide(null)
          },
          onCancel: () => setCardSide(null),
        }
      : undefined

  const subSheetFor = (side: TeamSide) =>
    subSide === side
      ? {
          onConfirm: (pairs: SubstitutionPair[]) => {
            dispatch({
              type: 'substitution',
              team: side,
              pairs,
              at: monotonicNow(),
            })
            setSubSide(null)
          },
          onCancel: () => setSubSide(null),
        }
      : undefined

  // The settings screen replaces the columns; closing it refocuses its button.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const undoButton = useRef<HTMLButtonElement>(null)
  const settingsWasOpen = useRef(false)
  useEffect(() => {
    if (settingsWasOpen.current && !settingsOpen) {
      settingsButton.current?.focus()
    }
    settingsWasOpen.current = settingsOpen
  }, [settingsOpen])
  const openSettings = () => {
    flushAdjustments()
    setSheet(null)
    setCardSide(null)
    setSubSide(null)
    setSettingsOpen(true)
  }

  const { jump, dismiss: dismissJump } = useWallClockJump(
    state.clock.runningSince !== null,
  )

  const lastStep = state.history?.at(-1)
  // A pending correction is the scorer's latest step: undo takes it back,
  // and it clears redo once it commits.
  const nextStep = adjustmentPending ? undefined : state.future?.at(-1)
  const step = (type: 'undo' | 'redo') => {
    flushAdjustments()
    const [from, to] =
      type === 'undo'
        ? (['history', 'future'] as const)
        : (['future', 'history'] as const)
    const before = store.getState()
    const entry = before[from]?.at(-1)
    if (!entry) return
    dispatch({ type, at: monotonicNow() })
    // A step that applied leaves its inverse on the other stack; one that no
    // longer applies (say its period was removed) is only dropped.
    const label = entry.label.toLowerCase()
    setToast(
      store.getState()[to]?.at(-1) === before[to]?.at(-1)
        ? `Could not ${type} ${label}: it no longer applies`
        : `${type === 'undo' ? 'Undid' : 'Redid'} ${label}`,
    )
  }
  const undo = () => step('undo')
  const redo = () => step('redo')
  useUndoHotkeys({ onUndo: undo, onRedo: redo }, !settingsOpen)

  useSpaceToggle(() => {
    const current = store.getState()
    dispatch(
      current.clock.runningSince !== null
        ? { type: 'stop-clock', at: monotonicNow() }
        : { type: 'start-clock', at: monotonicNow() },
    )
  }, !settingsOpen)

  return (
    <div className={styles.console}>
      <h1 className="assistive-only">Football scorer console</h1>
      <InHeader>
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
          <button
            type="button"
            ref={settingsButton}
            className={styles.topButton}
            disabled={settingsOpen}
            onClick={openSettings}
          >
            Settings
          </button>
          <button
            type="button"
            className={styles.topButton}
            ref={undoButton}
            disabled={!lastStep || settingsOpen}
            onClick={undo}
          >
            {lastStep ? `Undo · ${lastStep.label}` : 'Nothing to undo'}
          </button>
          {nextStep && !settingsOpen && (
            <button
              type="button"
              className={styles.topButton}
              onClick={() => {
                // Render now, so Undo is enabled before it takes focus.
                flushSync(redo)
                // The last redo removes this button: keep focus nearby.
                if (!store.getState().future) undoButton.current?.focus()
              }}
            >
              Redo · {nextStep.label}
            </button>
          )}
        </div>
      </InHeader>

      {jump && (
        <div className={styles.warning} role="alert">
          <p>
            {jump.seconds > 0
              ? `The computer's clock jumped forward ${jump.seconds}s, or it went to sleep. The match clock may be behind: check it and use Set clock if needed.`
              : `The computer's clock moved back ${-jump.seconds}s. The match clock is not affected.`}
          </p>
          <button
            type="button"
            className={styles.topButton}
            onClick={dismissJump}
          >
            Dismiss
          </button>
        </div>
      )}

      {settingsOpen ? (
        <SettingsScreen
          config={state.config}
          currentPeriodId={state.periodId}
          reservedIds={[
            ...state.events.map((e) => e.periodId),
            ...(state.history ?? []).flatMap((h) =>
              h.kind === 'period' ? [h.periodId] : [],
            ),
          ]}
          onSave={(config) => {
            dispatch({ type: 'update-config', config })
            setSettingsOpen(false)
            setToast('Settings saved')
          }}
          onCancel={() => setSettingsOpen(false)}
        />
      ) : (
        <div className={styles.columns}>
          <TeamColumn
            side="visitor"
            state={state}
            dispatch={dispatch}
            onGoal={addGoal}
            goalSheet={goalSheetFor('visitor')}
            onCard={openCardSheet}
            cardSheet={cardSheetFor('visitor')}
            onSub={openSubSheet}
            subSheet={subSheetFor('visitor')}
            subsLeft={subsLeft.visitor}
          />
          <CentrePanel
            state={state}
            dispatch={dispatch}
            stoppage={stoppage}
            beforePeriodChange={flushAdjustments}
            toast={toast}
            onToast={setToast}
          />
          <TeamColumn
            side="home"
            state={state}
            dispatch={dispatch}
            onGoal={addGoal}
            goalSheet={goalSheetFor('home')}
            onCard={openCardSheet}
            cardSheet={cardSheetFor('home')}
            onSub={openSubSheet}
            subSheet={subSheetFor('home')}
            subsLeft={subsLeft.home}
          />
        </div>
      )}
    </div>
  )
}
