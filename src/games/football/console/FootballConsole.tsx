import { useEffect } from 'react'
import { Link } from 'react-router'
import type { ConsoleProps } from '../../../consoles/registry'
import { useMatchState } from '../../../match/useMatchState'
import type { FootballAction, FootballMessage, FootballState } from '../state'
import { CentrePanel } from './CentrePanel'
import styles from './FootballConsole.module.css'
import { TeamColumn } from './TeamColumn'

/** Space toggles the clock, unless focus is somewhere it already means something. */
function useSpaceToggle(onToggle: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, button, a, [contenteditable="true"]',
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
        <TeamColumn side="visitor" state={state} dispatch={dispatch} />
        <CentrePanel state={state} dispatch={dispatch} />
        <TeamColumn side="home" state={state} dispatch={dispatch} />
      </div>
    </div>
  )
}
