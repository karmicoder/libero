import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import type { ConsoleProps } from '../consoles/registry'
import { engineRegistry } from '../engines/registry'
import type { ClockTiming } from '../engines/types'
import { openBroadcastChannel } from '../sync/broadcastChannel'
import { ConsoleLink } from '../sync/ConsoleLink'
import type { ChannelOpener } from '../sync/types'
import styles from './ConsoleHost.module.css'
import type { MatchStore } from './MatchStore'
import { monotonicNow } from './useNow'

interface Props<State, Action, Message> {
  sportId: string
  store: MatchStore<State, Action, Message>
  Console: ComponentType<ConsoleProps<State, Action, Message>>
  /** Defaults to a `BroadcastChannel` named for the sport. */
  openChannel?: ChannelOpener<State, Message>
  /** Defaults to the sport's engine's `clockTiming`. */
  timing?: ClockTiming<State>
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
  timing = engineRegistry.get<State, unknown, Message>(sportId)?.clockTiming,
}: Props<State, Action, Message>) {
  // State leaves this window with its elapsed time folded in and comes back
  // anchored to our own monotonic clock; see `ClockTiming`.
  const outgoing = useCallback(
    (state: State) => (timing ? timing.fold(state, monotonicNow()) : state),
    [timing],
  )
  const [link] = useState(
    () =>
      new ConsoleLink<State, Message>(openChannel, {
        getState: () => outgoing(store.getState()),
        onHandover: (state) =>
          store.replaceState(
            timing ? timing.anchor(state, monotonicNow()) : state,
          ),
      }),
  )

  useEffect(() => {
    link.start()
    const stops = [
      store.subscribe(() => link.publish(outgoing(store.getState()))),
      store.subscribeNotices(link.notice.bind(link)),
    ]
    return () => {
      stops.forEach((stop) => stop())
      link.stop()
    }
  }, [link, store, outgoing])

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
