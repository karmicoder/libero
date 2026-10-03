import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { engineRegistry, type EngineRegistry } from '../engines/registry'
import styles from './MatchSession.module.css'
import { MatchStore } from './MatchStore'
import { clearBackup, loadBackup, saveBackup } from './storage'

interface Props<State, Action, Message, Config> {
  sportId: string
  /** Starting config for a new match (e.g. from Settings). */
  config?: Config
  registry?: EngineRegistry
  children: (store: MatchStore<State, Action, Message>) => ReactNode
}

/**
 * Owns the match for a sport: the store around its engine, backed up to
 * localStorage after every change. If a backup exists it offers to resume it or
 * (after confirmation) discard it and start fresh, before rendering children.
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
    return isState ? loadBackup(sportId, (v): v is State => isState(v)) : null
  })
  const createStore = (state: State) =>
    new MatchStore(engine!, state, (s) => saveBackup(sportId, s))
  const [store, setStore] = useState(() =>
    engine && backup === null
      ? createStore(engine.initialState(config as Config))
      : null,
  )
  const [confirmingNew, setConfirmingNew] = useState(false)

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

  const resume = () => setStore(createStore(backup!))
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
            <button type="button" className="primary" onClick={resume}>
              Resume match
            </button>
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
