import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import type { BoardProps } from '../boards/registry'
import { BoardLink } from '../sync/BoardLink'
import { openBroadcastChannel } from '../sync/broadcastChannel'
import type { ChannelOpener } from '../sync/types'
import styles from './BoardHost.module.css'

interface Props<State, Notice> {
  sportId: string
  Board: ComponentType<BoardProps<State, Notice>>
  /** Defaults to a `BroadcastChannel` named for the sport. */
  openChannel?: ChannelOpener<State, Notice>
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
}: Props<State, Notice>) {
  const [link] = useState(() => new BoardLink<State, Notice>(openChannel))

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
