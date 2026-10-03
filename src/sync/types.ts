/**
 * Wire protocol between the scorer console (master) and scoreboards (views).
 * Everything is plain JSON so any transport can carry it. `from` is the
 * sender's window id; receivers ignore their own messages.
 *
 * Boards only ever send `hello` and `ping`: they never write game state.
 */
export type SyncMessage<State, Notice> =
  /** Board loaded: asks the console for a snapshot. */
  | { type: 'hello'; from: string }
  /** Liveness. The console's tells boards it is there; a board's tells the console a board is. */
  | { type: 'ping'; from: string; role: 'console' | 'board' }
  /** Full game state; sent on every console change and in reply to `hello`. */
  | { type: 'snapshot'; from: string; state: State }
  /** A transient engine notice (e.g. `goal-scored`), forwarded for banners. */
  | { type: 'notice'; from: string; message: Notice }
  /** A console starting up asks whether another console already owns the match. */
  | { type: 'probe'; from: string }
  /** The active console's answer to `probe`. */
  | { type: 'present'; from: string }
  /** A console claims the match. The previous one stands down. */
  | { type: 'takeover'; from: string }
  /** The previous console's final state, so the new one can continue from it. */
  | { type: 'handover'; from: string; state: State }

export type ChannelStatus = 'open' | 'closed'

/**
 * A broadcast channel between windows. Same-browser sync uses
 * `BroadcastChannel`; a cross-device transport (#23) can implement the same
 * interface. Delivery is best effort and a sender never receives its own
 * messages.
 */
export interface SyncChannel<State = unknown, Notice = unknown> {
  send(message: SyncMessage<State, Notice>): void
  /** Returns an unsubscribe function. */
  subscribe(listener: (message: SyncMessage<State, Notice>) => void): () => void
  readonly status: ChannelStatus
  close(): void
}

/**
 * Opens a channel for a link's lifetime (`start()` to `stop()`). Null means no
 * transport is available; the links then run unsynced.
 */
export type ChannelOpener<State, Notice> = () => SyncChannel<
  State,
  Notice
> | null

/** Heartbeat period, and how long without one before a peer counts as gone. */
export const HEARTBEAT_MS = 2_000
export const PEER_TIMEOUT_MS = 6_000
/** How long a starting console waits for another console to answer its probe. */
export const PROBE_MS = 300
