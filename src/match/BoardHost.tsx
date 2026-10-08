import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import type { BoardProps } from '../boards/registry'
import { engineRegistry } from '../engines/registry'
import type { ClockTiming } from '../engines/types'
import { BoardLink } from '../sync/BoardLink'
import { openBroadcastChannel } from '../sync/broadcastChannel'
import type { ChannelOpener } from '../sync/types'
import styles from './BoardHost.module.css'
import { monotonicNow } from './useNow'

interface Props<State, Notice> {
  sportId: string
  Board: ComponentType<BoardProps<State, Notice>>
  /** Defaults to a `BroadcastChannel` named for the sport. */
  openChannel?: ChannelOpener<State, Notice>
  /** Defaults to the sport's engine's `clockTiming`. */
  timing?: ClockTiming<State>
}

/**
 * Runs a sport's scoreboard as a view of the console: it keeps the last
 * snapshot received over the sync channel and never writes game state. Until
 * the first snapshot there is nothing to show but a waiting message.
 */
export function BoardHost<State, Notice>({
  sportId,
  Board,
  openChannel = () => openBroadcastChannel<State, Notice>(sportId),
  timing = engineRegistry.get<State, unknown, Notice>(sportId)?.clockTiming,
}: Props<State, Notice>) {
  // A running clock is re-anchored to our own monotonic clock on arrival, so
  // the console's timestamps never matter here.
  const [link] = useState(
    () =>
      new BoardLink<State, Notice>(openChannel, {
        adopt: (state) =>
          timing ? timing.anchor(state, monotonicNow()) : state,
      }),
  )

  useEffect(() => {
    link.start()
    return () => link.stop()
  }, [link])

  const state = useSyncExternalStore(link.subscribe, link.getState)
  const { connected } = useSyncExternalStore(link.subscribe, link.getStatus)

  if (state === null) {
    return (
      <div className={styles.waiting} role="status">
        <p className="eyebrow">Waiting for the scorer console</p>
        <p>Open the console for this match in another window.</p>
      </div>
    )
  }

  return (
    <Board
      state={state}
      connected={connected}
      subscribeNotices={link.subscribeNotices}
    />
  )
}
