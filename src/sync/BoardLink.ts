import {
  HEARTBEAT_MS,
  PEER_TIMEOUT_MS,
  type ChannelOpener,
  type SyncChannel,
  type SyncMessage,
} from './types'

export interface BoardStatus {
  /** The console has been heard from recently. */
  connected: boolean
}

export interface BoardLinkOptions {
  /** Window id; defaults to a random UUID. */
  id?: string
  /** Monotonic millisecond clock; defaults to `performance.now()`. */
  now?: () => number
}

/**
 * A scoreboard's end of the sync protocol. View-only: it keeps the last
 * snapshot received and the forwarded notices, and never writes game state.
 * When the console goes quiet it keeps showing the last snapshot and reports
 * `connected: false`.
 */
export class BoardLink<State, Notice> {
  readonly id: string
  #openChannel: ChannelOpener<State, Notice>
  #channel: SyncChannel<State, Notice> | null = null
  #now: () => number
  #state: State | null = null
  #status: BoardStatus = { connected: false }
  #consoleSeen: number | null = null
  #listeners = new Set<() => void>()
  #noticeListeners = new Set<(message: Notice) => void>()
  #unsubscribe?: () => void
  #heartbeat?: ReturnType<typeof setInterval>

  /** `openChannel` runs on every `start()`; the channel is closed on `stop()`. */
  constructor(
    openChannel: ChannelOpener<State, Notice>,
    options: BoardLinkOptions = {},
  ) {
    this.#openChannel = openChannel
    this.id = options.id ?? crypto.randomUUID()
    this.#now = options.now ?? (() => performance.now())
  }

  /** The last snapshot, or null before the first one arrives. */
  getState = (): State | null => this.#state

  getStatus = (): BoardStatus => this.#status

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  subscribeNotices = (listener: (message: Notice) => void): (() => void) => {
    this.#noticeListeners.add(listener)
    return () => this.#noticeListeners.delete(listener)
  }

  /** Begins listening and asks the console for a snapshot. */
  start(): void {
    this.#channel = this.#openChannel()
    if (!this.#channel) return
    this.#unsubscribe = this.#channel.subscribe(this.#onMessage)
    this.#channel.send({ type: 'hello', from: this.id })
    this.#heartbeat = setInterval(() => {
      this.#channel?.send({ type: 'ping', from: this.id, role: 'board' })
      this.#refresh()
    }, HEARTBEAT_MS)
  }

  /** Stops and closes the channel. Subscribers stay subscribed. */
  stop(): void {
    this.#unsubscribe?.()
    clearInterval(this.#heartbeat)
    this.#channel?.close()
    this.#channel = null
  }

  #refresh() {
    const connected =
      this.#consoleSeen !== null &&
      this.#now() - this.#consoleSeen <= PEER_TIMEOUT_MS
    if (connected === this.#status.connected) return
    this.#status = { connected }
    this.#listeners.forEach((l) => l())
  }

  #onMessage = (message: SyncMessage<State, Notice>) => {
    if (message.from === this.id) return
    switch (message.type) {
      case 'snapshot':
        this.#consoleSeen = this.#now()
        this.#state = message.state
        this.#status = { connected: true }
        this.#listeners.forEach((l) => l())
        break
      case 'notice':
        this.#consoleSeen = this.#now()
        this.#refresh()
        this.#noticeListeners.forEach((l) => l(message.message))
        break
      case 'ping':
        if (message.role === 'console') {
          this.#consoleSeen = this.#now()
          this.#refresh()
        }
        break
    }
  }
}
