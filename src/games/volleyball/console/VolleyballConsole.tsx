import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { InHeader } from '../../../components/HeaderSlot'
import type { ConsoleProps } from '../../../consoles/registry'
import { useDebouncedCommit } from '../../../match/useDebouncedCommit'
import { useMatchState } from '../../../match/useMatchState'
import { monotonicNow } from '../../../match/useNow'
import { isDecider, matchWinner, setReady, setsWon, setTarget } from '../rules'
import type {
  TeamSide,
  VolleyballAction,
  VolleyballMessage,
  VolleyballState,
} from '../state'
import { SetPrompt } from './SetPrompt'
import { SettingsScreen } from './SettingsScreen'
import { TeamColumn } from './TeamColumn'
import styles from './VolleyballConsole.module.css'

const TOAST_MS = 3000

const SIDE_LABEL: Record<TeamSide, string> = {
  visitor: 'Visitor',
  home: 'Home',
}

/**
 * Ctrl/Cmd+Z undoes, unless it already means something: in a text field (the
 * browser's own undo) or while a dialog is open.
 */
function useUndoHotkey(onUndo: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || e.shiftKey || e.altKey) return
      if (!(e.ctrlKey || e.metaKey)) return
      // Holding the keys must not walk back through the whole history.
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        document.querySelector('[role="dialog"]')
      ) {
        return
      }
      e.preventDefault()
      onUndo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onUndo, enabled])
}

function statusLine(state: VolleyballState): string {
  const won = setsWon(state)
  const sets = `Sets ${won.visitor}–${won.home}`
  const winner = matchWinner(state)
  if (state.status === 'finished' && winner) {
    return `Match over · ${state.teams[winner].name || SIDE_LABEL[winner]} wins · ${sets}`
  }
  return [
    `Set ${state.completed.length + 1}`,
    ...(isDecider(state) ? ['Decider'] : []),
    `First to ${setTarget(state)}`,
    sets,
  ].join(' · ')
}

export function VolleyballConsole({
  store,
  boardConnected,
  boardPath,
}: ConsoleProps<VolleyballState, VolleyballAction, VolleyballMessage>) {
  const state = useMatchState(store)
  const { dispatch } = store

  // −1 is a repeated-press nudge, so it is debounced; everything else is a
  // discrete event and dispatches at once, after flushing any pending −1.
  const setScore = (team: TeamSide) => (score: number) =>
    dispatch({ type: 'set-score', team, score, at: monotonicNow() })
  const scores = {
    visitor: useDebouncedCommit(state.current.visitor, setScore('visitor')),
    home: useDebouncedCommit(state.current.home, setScore('home')),
  }
  const flushScores = () => {
    scores.visitor.flush()
    scores.home.flush()
  }

  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  const showToast = (text: string) =>
    setToast((t) => ({ text, key: (t?.key ?? 0) + 1 }))
  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // A pending −1 is flushed before undoing, so it is the step Undo reverts.
  const pendingSide = (['visitor', 'home'] as const).find(
    (side) => scores[side].pending,
  )
  const lastStep = pendingSide
    ? {
        label: `Score correction for ${state.teams[pendingSide].name || SIDE_LABEL[pendingSide]}`,
      }
    : state.history?.at(-1)
  const undo = () => {
    flushScores()
    const step = store.getState().history?.at(-1)
    if (!step) return
    dispatch({ type: 'undo', at: monotonicNow() })
    showToast(`Undid ${step.label.toLowerCase()}`)
  }

  // The settings screen replaces the columns; closing it refocuses its button.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const settingsWasOpen = useRef(false)
  useEffect(() => {
    if (settingsWasOpen.current && !settingsOpen) {
      settingsButton.current?.focus()
    }
    settingsWasOpen.current = settingsOpen
  }, [settingsOpen])
  const openSettings = () => {
    flushScores()
    setSettingsOpen(true)
  }
  useUndoHotkey(undo, !settingsOpen)

  const finished = state.status === 'finished'
  const displayName = (side: TeamSide) =>
    state.teams[side].name || SIDE_LABEL[side]
  const winner = finished ? matchWinner(state) : null
  // The prompt follows what the columns show, pending −1 included.
  const shown = { visitor: scores.visitor.value, home: scores.home.value }
  const { visitor: v, home: h } = shown
  const leader =
    finished || v === h ? undefined : displayName(v > h ? 'visitor' : 'home')
  const freshSet = scores.visitor.value === 0 && scores.home.value === 0

  const column = (side: TeamSide) => (
    <TeamColumn
      side={side}
      name={displayName(side)}
      rawName={state.teams[side].name}
      onRename={(name) => dispatch({ type: 'set-team-name', team: side, name })}
      score={scores[side].value}
      pending={scores[side].pending}
      serving={state.serving === side}
      freshSet={freshSet}
      finished={finished}
      onPoint={() => {
        flushScores()
        dispatch({ type: 'point', team: side, at: monotonicNow() })
      }}
      onServe={() => {
        flushScores()
        dispatch({ type: 'set-server', team: side })
      }}
      onSetScore={(next) => {
        flushScores()
        setScore(side)(next)
      }}
      onMinus={() => scores[side].set(Math.max(0, scores[side].value - 1))}
    />
  )

  return (
    <div className={styles.console}>
      <h1 className="visually-hidden">Volleyball scorer console</h1>
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
            disabled={!lastStep || settingsOpen}
            onClick={undo}
          >
            {lastStep ? `Undo · ${lastStep.label}` : 'Nothing to undo'}
          </button>
        </div>
      </InHeader>

      <p className={styles.status}>{statusLine(state)}</p>

      {settingsOpen ? (
        <SettingsScreen
          config={state.config}
          onSave={(config) => {
            dispatch({ type: 'update-config', config })
            setSettingsOpen(false)
            showToast('Settings saved')
          }}
          onCancel={() => setSettingsOpen(false)}
        />
      ) : (
        <>
          <div className={styles.columns}>
            {column('visitor')}
            {column('home')}
          </div>

          <SetPrompt
            leader={leader}
            setNumber={state.completed.length + 1}
            ready={setReady({ ...state, current: shown })}
            matchWinner={winner ? displayName(winner) : undefined}
            onEndSet={() => {
              flushScores()
              dispatch({ type: 'end-set', at: monotonicNow() })
            }}
          />
        </>
      )}

      {toast && (
        <p className={styles.toast} role="status">
          {toast.text}
        </p>
      )}
    </div>
  )
}
