import type { ChannelStatus, SyncChannel, SyncMessage } from './types'

/**
 * In-memory stand-in for a transport: every channel opened on one bus receives
 * what the others send (never its own), cloned like a real structured-clone
 * transport. Delivery is synchronous but queued, so a listener that sends in
 * reply doesn't re-enter another listener mid-delivery.
 */
export class MemoryBus<State = unknown, Notice = unknown> {
  #channels = new Set<MemoryChannel<State, Notice>>()
  #queue: (() => void)[] = []
  #draining = false

  open(): MemoryChannel<State, Notice> {
    const channel = new MemoryChannel<State, Notice>(this)
    this.#channels.add(channel)
    return channel
  }

  /** @internal */
  _send(from: MemoryChannel<State, Notice>, message: unknown) {
    for (const to of this.#channels) {
      if (to === from) continue
      const copy = structuredClone(message) as SyncMessage<State, Notice>
      this.#queue.push(() => to._deliver(copy))
    }
    if (this.#draining) return
    this.#draining = true
    try {
      while (this.#queue.length > 0) this.#queue.shift()!()
    } finally {
      this.#draining = false
    }
  }

  /** @internal */
  _remove(channel: MemoryChannel<State, Notice>) {
    this.#channels.delete(channel)
  }
}

export class MemoryChannel<State, Notice> implements SyncChannel<
  State,
  Notice
> {
  #bus: MemoryBus<State, Notice>
  #listeners = new Set<(message: SyncMessage<State, Notice>) => void>()
  status: ChannelStatus = 'open'

  constructor(bus: MemoryBus<State, Notice>) {
    this.#bus = bus
  }

  send(message: SyncMessage<State, Notice>): void {
    if (this.status === 'open') this.#bus._send(this, message)
  }

  subscribe(listener: (message: SyncMessage<State, Notice>) => void) {
    this.#listeners.add(listener)
    return () => void this.#listeners.delete(listener)
  }

  close(): void {
    this.status = 'closed'
    this.#listeners.clear()
    this.#bus._remove(this)
  }

  /** @internal */
  _deliver(message: SyncMessage<State, Notice>) {
    this.#listeners.forEach((l) => l(message))
  }
}
