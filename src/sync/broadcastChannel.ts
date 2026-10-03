import type { ChannelStatus, SyncChannel, SyncMessage } from './types'

/** Same-browser transport over the `BroadcastChannel` API. */
export class BroadcastSyncChannel<
  State = unknown,
  Notice = unknown,
> implements SyncChannel<State, Notice> {
  #channel: BroadcastChannel
  #listeners = new Set<(message: SyncMessage<State, Notice>) => void>()
  status: ChannelStatus = 'open'

  constructor(name: string) {
    this.#channel = new BroadcastChannel(name)
    this.#channel.onmessage = (
      event: MessageEvent<SyncMessage<State, Notice>>,
    ) => this.#listeners.forEach((l) => l(event.data))
  }

  send(message: SyncMessage<State, Notice>): void {
    if (this.status !== 'open') return
    try {
      this.#channel.postMessage(message)
    } catch {
      // Closed or unserialisable: sync is best effort.
    }
  }

  subscribe(listener: (message: SyncMessage<State, Notice>) => void) {
    this.#listeners.add(listener)
    return () => void this.#listeners.delete(listener)
  }

  close(): void {
    this.status = 'closed'
    this.#listeners.clear()
    this.#channel.close()
  }
}

/** One channel name per sport, shared by its console and boards. */
export function openBroadcastChannel<State, Notice>(
  sportId: string,
): SyncChannel<State, Notice> | null {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastSyncChannel<State, Notice>(`libero:sync:${sportId}`)
}
