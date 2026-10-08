import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { engineRegistry, type EngineRegistry } from '../engines/registry'
import styles from './MatchSession.module.css'
import { MatchStore } from './MatchStore'
import { clearBackup, loadBackup, saveBackup } from './storage'
import { monotonicNow } from './useNow'

/** A running clock is re-saved this often, so a crash loses at most this much. */
const RESAVE_MS = 5_000

const mmss = (totalSeconds: number) =>
  `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`

interface Props<State, Action, Message, Config> {
  sportId: string
  /** Starting config for a new match (e.g. from Settings). */
  config?: Config
  registry?: EngineRegistry
  children: (store: MatchStore<State, Action, Message>) => ReactNode
}

/**
 * Owns the match for a sport: the store around its engine, backed up to
 * localStorage after every change (and every few seconds while a clock runs).
 * If a backup exists it offers to resume it or (after confirmation) discard it
 * and start fresh, before rendering children.
 *
 * A running clock can't be restored as running: its anchor was a monotonic
 * reading of the closed document. It comes back stopped and the scorer chooses
 * whether to add the (wall-clock estimated) time since the last save.
 */
export function MatchSession<State, Action, Message, Config = unknown>({
  sportId,
  config,
  registry = engineRegistry,
  children,
}: Props<State, Action, Message, Config>) {
  const engine = registry.get<State, Action, Message, Config>(sportId)
  const [backup] = useState(() => {
    const isState = engine?.isState
    const found = isState
      ? loadBackup(sportId, (v): v is State => isState(v))
      : null
    if (!found) return null
    // Seconds the clock ran after the last save, by the wall clock (a rough guess).
    const timing = engine?.clockTiming
    const running = timing?.isRunning(found.state) ?? false
    const since =
      found.savedAt ?? timing?.legacyEpochRunningSince?.(found.state)
    const gapSeconds =
      running && since != null
        ? Math.max(0, Math.round((Date.now() - since) / 1000))
        : 0
    return { state: found.state, wasRunning: running, gapSeconds }
  })
  const timing = engine?.clockTiming
  const persist = (s: State) =>
    saveBackup(sportId, timing ? timing.fold(s, monotonicNow()) : s)
  const createStore = (state: State) => new MatchStore(engine!, state, persist)
  const [store, setStore] = useState(() =>
    engine && backup === null
      ? createStore(engine.initialState(config as Config))
      : null,
  )
  const [confirmingNew, setConfirmingNew] = useState(false)

  useEffect(() => {
    if (!store || !timing) return
    const save = () => persist(store.getState())
    const id = setInterval(() => {
      if (timing.isRunning(store.getState())) save()
    }, RESAVE_MS)
    window.addEventListener('pagehide', save)
    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', save)
    }
    // `persist` only closes over stable inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  if (!engine) {
    return (
      <div className="page">
        <h1>Match not available</h1>
        <p>
          <Link to="/">Back to sport selection</Link>
        </p>
      </div>
    )
  }

  if (store) return children(store)

  const { wasRunning, gapSeconds } = backup!
  const resume = (addGap: boolean) => {
    const now = monotonicNow()
    const state =
      timing && wasRunning
        ? timing.pause(
            timing.anchor(
              backup!.state,
              now - (addGap ? gapSeconds * 1000 : 0),
            ),
            now,
          )
        : backup!.state
    setStore(createStore(state))
  }
  const startNew = () => {
    clearBackup(sportId)
    setStore(createStore(engine.initialState(config as Config)))
  }

  return (
    <div className="page">
      <h1>{confirmingNew ? 'Discard saved match?' : 'Resume match?'}</h1>
      <p className="eyebrow">
        {confirmingNew
          ? 'The saved score, clock and events will be deleted'
          : 'A match from earlier is still saved on this device'}
      </p>
      {!confirmingNew && wasRunning && (
        <p>
          The clock was running when it was saved, so it will resume stopped.
          About {mmss(gapSeconds)} may have passed since; add it if the match
          kept going.
        </p>
      )}
      <div className={styles.actions}>
        {confirmingNew ? (
          <>
            <button type="button" className="primary" onClick={startNew}>
              Discard and start new match
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setConfirmingNew(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="primary"
              onClick={() => resume(false)}
            >
              Resume match
            </button>
            {wasRunning && gapSeconds > 0 && (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => resume(true)}
              >
                Resume and add {mmss(gapSeconds)}
              </button>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setConfirmingNew(true)}
            >
              New match
            </button>
          </>
        )}
      </div>
    </div>
  )
}
