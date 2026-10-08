import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clockSeconds } from '../games/football/clock'
import { defaultMatchConfig } from '../games/football/config'
import { footballEngine } from '../games/football/engine/football'
import type { FootballMessage, FootballState } from '../games/football/state'
import { BoardLink } from '../sync/BoardLink'
import { ConsoleLink } from '../sync/ConsoleLink'
import { MemoryBus } from '../sync/memoryChannel'
import { PROBE_MS } from '../sync/types'

const timing = footballEngine.clockTiming!

// Each document has its own monotonic origin: the console has been open for
// hours, the board and a second console just loaded.
const origin = { console: 10_800_000, board: 40, console2: 7 }
const mono = { ...origin }
const advance = (ms: number) => {
  for (const k of Object.keys(mono) as (keyof typeof mono)[]) mono[k] += ms
  vi.advanceTimersByTime(ms)
}

beforeEach(() => {
  Object.assign(mono, origin)
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

function runningState(): FootballState {
  const s = footballEngine.initialState(defaultMatchConfig())
  return footballEngine.reduce(s, { type: 'start-clock', at: mono.console })
    .state
}

describe('a running clock across documents with different monotonic origins', () => {
  const bus = () => new MemoryBus<FootballState, FootballMessage>()

  function link(
    b: MemoryBus<FootballState, FootballMessage>,
    store: { s: FootballState },
  ) {
    const c = new ConsoleLink<FootballState, FootballMessage>(() => b.open(), {
      id: 'c1',
      now: () => mono.console,
      getState: () => timing.fold(store.s, mono.console),
    })
    const board = new BoardLink<FootballState, FootballMessage>(
      () => b.open(),
      {
        id: 'b1',
        now: () => mono.board,
        adopt: (state) => timing.anchor(state, mono.board),
      },
    )
    return { c, board }
  }

  it('shows the board the same time as the console, then keeps pace', () => {
    const store = { s: runningState() }
    const { c, board } = link(bus(), store)
    c.start()
    advance(PROBE_MS)
    advance(30_000) // 30s of play before the board opens
    board.start()

    const shown = (at: number) => clockSeconds(board.getState()!.clock, at)
    expect(shown(mono.board)).toBeCloseTo(30.3, 0)
    advance(10_000)
    expect(shown(mono.board)).toBeCloseTo(40.3, 0)
    expect(clockSeconds(store.s.clock, mono.console)).toBeCloseTo(40.3, 0)
  })

  it('re-anchors on every snapshot, not just the first', () => {
    const store = { s: runningState() }
    const { c, board } = link(bus(), store)
    c.start()
    advance(PROBE_MS)
    board.start()
    advance(20_000)
    // The console pauses and publishes; the board must stop at the same time.
    store.s = footballEngine.reduce(store.s, {
      type: 'stop-clock',
      at: mono.console,
    }).state
    c.publish(timing.fold(store.s, mono.console))
    const seen = board.getState()!
    expect(seen.clock.runningSince).toBeNull()
    expect(seen.clock.baseSeconds).toBeCloseTo(20.3, 0)
  })

  it('carries the time over when another console takes over', () => {
    const store = { s: runningState() }
    const b = bus()
    const { c } = link(b, store)
    c.start()
    advance(PROBE_MS)
    advance(15_000)

    let adopted: FootballState | null = null
    const c2 = new ConsoleLink<FootballState, FootballMessage>(() => b.open(), {
      id: 'c2',
      now: () => mono.console2,
      getState: () => store.s,
      onHandover: (state) => (adopted = timing.anchor(state, mono.console2)),
    })
    c2.start()
    advance(PROBE_MS)
    c2.takeOver()
    expect(clockSeconds(adopted!.clock, mono.console2)).toBeCloseTo(15.3, 0)
    advance(5_000)
    expect(clockSeconds(adopted!.clock, mono.console2)).toBeCloseTo(20.3, 0)
  })
})
