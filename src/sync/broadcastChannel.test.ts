// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BroadcastSyncChannel, openBroadcastChannel } from './broadcastChannel'
import type { SyncMessage } from './types'

type State = { score: number }

describe('BroadcastSyncChannel', () => {
  it('delivers messages to other channels with the same name, not to the sender', async () => {
    const a = new BroadcastSyncChannel<State, never>('libero:test')
    const b = new BroadcastSyncChannel<State, never>('libero:test')
    const fromA: SyncMessage<State, never>[] = []
    a.subscribe((m) => fromA.push(m))

    const received = new Promise<SyncMessage<State, never>>((resolve) =>
      b.subscribe(resolve),
    )
    a.send({ type: 'snapshot', from: 'a', state: { score: 2 } })

    expect(await received).toEqual({
      type: 'snapshot',
      from: 'a',
      state: { score: 2 },
    })
    expect(fromA).toEqual([])
    a.close()
    b.close()
  })

  it('stops sending and reports closed after close()', () => {
    const a = new BroadcastSyncChannel<State, never>('libero:test-close')
    a.close()
    expect(a.status).toBe('closed')
    expect(() => a.send({ type: 'hello', from: 'a' })).not.toThrow()
  })

  it('openBroadcastChannel names the channel per sport', () => {
    const channel = openBroadcastChannel<State, never>('football')
    expect(channel).not.toBeNull()
    channel?.close()
  })
})
