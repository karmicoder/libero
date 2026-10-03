import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import type { ConsoleProps } from '../consoles/registry'
import { openBroadcastChannel } from '../sync/broadcastChannel'
import { ConsoleLink } from '../sync/ConsoleLink'
import type { ChannelOpener } from '../sync/types'
import styles from './ConsoleHost.module.css'
import type { MatchStore } from './MatchStore'

interface Props<State, Action, Message> {
  sportId: string
  store: MatchStore<State, Action, Message>
  Console: ComponentType<ConsoleProps<State, Action, Message>>
  /** Defaults to a `BroadcastChannel` named for the sport. */
  openChannel?: ChannelOpener<State, Message>
}

/**
 * Runs a sport's console as the master of the sync channel: publishes every
 * state change and notice to scoreboards, and guards against a second console
 * window for the same match (it can take over; the previous one stands down).
 */
export function ConsoleHost<State, Action, Message>({
  sportId,
  store,
  Console,
  openChannel = () => openBroadcastChannel<State, Message>(sportId),
}: Props<State, Action, Message>) {
  const [link] = useState(
    () =>
      new ConsoleLink<State, Message>(openChannel, {
        getState: store.getState,
        onHandover: store.replaceState,
      }),
  )

  useEffect(() => {
    link.start()
    const stops = [
      store.subscribe(() => link.publish(store.getState())),
      store.subscribeNotices(link.notice.bind(link)),
    ]
    return () => {
      stops.forEach((stop) => stop())
      link.stop()
    }
  }, [link, store])

  const { role, boardConnected } = useSyncExternalStore(
    link.subscribe,
    link.getStatus,
  )

  if (role === 'active') {
    return (
      <Console
        store={store}
        boardConnected={boardConnected}
        boardPath={`/match/${sportId}/board`}
      />
    )
  }

  if (role === 'probing') {
    return (
      <div className="page" role="status">
        <p className="eyebrow">Connecting</p>
      </div>
    )
  }

  const blocked = role === 'blocked'
  return (
    <div className="page">
      <h1>
        {blocked
          ? 'Match already open in another window'
          : 'Another window took over this match'}
      </h1>
      <p className="eyebrow">
        {blocked
          ? 'Take over to score from this window instead'
          : 'Take it back to score from this window'}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className="primary"
          onClick={() => link.takeOver()}
        >
          {blocked ? 'Take over' : 'Take back'}
        </button>
      </div>
    </div>
  )
}
