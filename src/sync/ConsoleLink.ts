import {
  HEARTBEAT_MS,
  PEER_TIMEOUT_MS,
  PROBE_MS,
  type SyncChannel,
  type SyncMessage,
} from './types'

/**
 * - `probing`: just started, checking whether another console owns the match.
 * - `active`: this console is the master and publishes state.
 * - `blocked`: another console owns the match; offer `takeOver()`.
 * - `inactive`: was active, then another console took over.
 */
export type ConsoleRole = 'probing' | 'active' | 'blocked' | 'inactive'

export interface ConsoleStatus {
  role: ConsoleRole
  /** At least one board has been heard from recently. */
  boardConnected: boolean
}

export interface ConsoleLinkOptions<State> {
  /** Current game state, for replies to boards and for handing over. */
  getState: () => State
  /** Called on the new console with the previous one's final state after a takeover. */
  onHandover?: (state: State) => void
  /** Window id; defaults to a random UUID. */
  id?: string
  /** Monotonic millisecond clock; defaults to `performance.now()`. */
  now?: () => number
}

/**
 * The console's end of the sync protocol. The console is the master: it
 * publishes a snapshot on every state change and forwards engine notices;
 * boards never write. Only one console is active per match: a second one is
 * `blocked` until its user takes over (last takeover wins).
 *
 * Liveness uses `performance.now()` so a system clock change can't flip the
 * "board connected" indicator.
 */
export class ConsoleLink<State, Notice> {
  readonly id: string
  #channel: SyncChannel<State, Notice>
  #options: ConsoleLinkOptions<State>
  #now: () => number
  #status: ConsoleStatus = { role: 'probing', boardConnected: false }
  #listeners = new Set<() => void>()
  #boards = new Map<string, number>()
  #awaitingHandover = false
  #unsubscribe?: () => void
  #probeTimer?: ReturnType<typeof setTimeout>
  #heartbeat?: ReturnType<typeof setInterval>

  constructor(
    channel: SyncChannel<State, Notice>,
    options: ConsoleLinkOptions<State>,
  ) {
    this.#channel = channel
    this.#options = options
    this.id = options.id ?? crypto.randomUUID()
    this.#now = options.now ?? (() => performance.now())
  }

  getStatus = (): ConsoleStatus => this.#status

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /** Begins listening and checks for another console. */
  start(): void {
    this.#unsubscribe = this.#channel.subscribe(this.#onMessage)
    this.#send({ type: 'probe', from: this.id })
    this.#probeTimer = setTimeout(() => {
      if (this.#status.role === 'probing') this.#becomeActive()
    }, PROBE_MS)
  }

  /** Sends the new state to boards. Call after every state change. */
  publish(state: State): void {
    if (this.#status.role !== 'active') return
    this.#send({ type: 'snapshot', from: this.id, state })
  }

  /** Forwards an engine notice to boards. */
  notice(message: Notice): void {
    if (this.#status.role !== 'active') return
    this.#send({ type: 'notice', from: this.id, message })
  }

  /** Claims the match from `blocked` or `inactive`. The other console stands down. */
  takeOver(): void {
    const { role } = this.#status
    if (role !== 'blocked' && role !== 'inactive') return
    this.#awaitingHandover = true
    this.#send({ type: 'takeover', from: this.id })
    this.#becomeActive()
  }

  dispose(): void {
    this.#unsubscribe?.()
    clearTimeout(this.#probeTimer)
    clearInterval(this.#heartbeat)
    this.#listeners.clear()
  }

  #send(message: SyncMessage<State, Notice>) {
    this.#channel.send(message)
  }

  #setStatus(patch: Partial<ConsoleStatus>) {
    const next = { ...this.#status, ...patch }
    if (
      next.role === this.#status.role &&
      next.boardConnected === this.#status.boardConnected
    ) {
      return
    }
    this.#status = next
    this.#listeners.forEach((l) => l())
  }

  #becomeActive() {
    clearTimeout(this.#probeTimer)
    this.#setStatus({ role: 'active' })
    this.#send({
      type: 'snapshot',
      from: this.id,
      state: this.#options.getState(),
    })
    this.#send({ type: 'ping', from: this.id, role: 'console' })
    clearInterval(this.#heartbeat)
    this.#heartbeat = setInterval(() => {
      this.#send({ type: 'ping', from: this.id, role: 'console' })
      this.#refreshBoards()
    }, HEARTBEAT_MS)
  }

  #standDown() {
    clearInterval(this.#heartbeat)
    this.#boards.clear()
    this.#setStatus({ role: 'inactive', boardConnected: false })
  }

  /** Drops boards not heard from within the timeout and updates the indicator. */
  #refreshBoards() {
    const now = this.#now()
    for (const [id, seen] of this.#boards) {
      if (now - seen > PEER_TIMEOUT_MS) this.#boards.delete(id)
    }
    this.#setStatus({ boardConnected: this.#boards.size > 0 })
  }

  /** Records a board; true if it is new or had gone stale. */
  #seeBoard(id: string): boolean {
    const now = this.#now()
    const seen = this.#boards.get(id)
    const fresh = seen === undefined || now - seen > PEER_TIMEOUT_MS
    this.#boards.set(id, now)
    this.#setStatus({ boardConnected: true })
    return fresh
  }

  #sendSnapshot() {
    this.#send({
      type: 'snapshot',
      from: this.id,
      state: this.#options.getState(),
    })
  }

  #onMessage = (message: SyncMessage<State, Notice>) => {
    if (message.from === this.id) return
    const { role } = this.#status
    switch (message.type) {
      case 'probe':
        if (role === 'active') this.#send({ type: 'present', from: this.id })
        break
      case 'present':
        if (role === 'probing') {
          clearTimeout(this.#probeTimer)
          this.#setStatus({ role: 'blocked' })
        }
        break
      case 'takeover':
        if (role === 'active') {
          this.#send({
            type: 'handover',
            from: this.id,
            state: this.#options.getState(),
          })
          this.#standDown()
        }
        break
      case 'handover':
        if (this.#awaitingHandover) {
          this.#awaitingHandover = false
          this.#options.onHandover?.(message.state)
        }
        break
      case 'hello':
        if (role === 'active') {
          this.#seeBoard(message.from)
          this.#sendSnapshot()
        }
        break
      case 'ping':
        // A board we don't know yet (loaded before us, or back after a gap)
        // gets a snapshot without having to say hello again.
        if (role === 'active' && message.role === 'board') {
          if (this.#seeBoard(message.from)) this.#sendSnapshot()
        }
        break
    }
  }
}
