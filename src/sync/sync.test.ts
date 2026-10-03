import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardLink } from './BoardLink'
import { ConsoleLink } from './ConsoleLink'
import { MemoryBus } from './memoryChannel'
import {
  HEARTBEAT_MS,
  PEER_TIMEOUT_MS,
  PROBE_MS,
  type SyncMessage,
} from './types'

type State = { score: number }
type Notice = { type: 'goal' }

let t = 0
/** Advances the injected monotonic clock and the fake timers together. */
const advance = (ms: number) => {
  t += ms
  vi.advanceTimersByTime(ms)
}
const now = () => t

function setup() {
  const bus = new MemoryBus<State, Notice>()
  const state = { current: { score: 0 } as State }
  const makeConsole = (id: string, onHandover?: (s: State) => void) =>
    new ConsoleLink<State, Notice>(bus.open(), {
      id,
      now,
      getState: () => state.current,
      onHandover,
    })
  const makeBoard = (id: string) =>
    new BoardLink<State, Notice>(bus.open(), { id, now })
  return { bus, state, makeConsole, makeBoard }
}

beforeEach(() => {
  t = 0
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('console startup', () => {
  it('probes, then becomes active when no other console answers', () => {
    const { makeConsole } = setup()
    const c = makeConsole('c1')
    c.start()
    expect(c.getStatus().role).toBe('probing')
    advance(PROBE_MS)
    expect(c.getStatus().role).toBe('active')
  })
})

describe('snapshots and handshake', () => {
  it('replies to a board hello with a snapshot', () => {
    const { makeConsole, makeBoard, state } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    state.current = { score: 3 }

    const b = makeBoard('b1')
    expect(b.getState()).toBeNull()
    b.start()
    expect(b.getState()).toEqual({ score: 3 })
    expect(b.getStatus().connected).toBe(true)
  })

  it('gives a board opened before the console its state once the console is up', () => {
    const { makeConsole, makeBoard, state } = setup()
    const b = makeBoard('b1')
    b.start()
    expect(b.getState()).toBeNull()

    state.current = { score: 1 }
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    expect(b.getState()).toEqual({ score: 1 })
  })

  it('sends a snapshot to every board on each published change', () => {
    const { makeConsole, makeBoard } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    const b1 = makeBoard('b1')
    const b2 = makeBoard('b2')
    b1.start()
    b2.start()

    c.publish({ score: 2 })
    expect(b1.getState()).toEqual({ score: 2 })
    expect(b2.getState()).toEqual({ score: 2 })
  })

  it('forwards notices to boards, not into their state', () => {
    const { makeConsole, makeBoard } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    const b = makeBoard('b1')
    b.start()
    const seen = vi.fn()
    b.subscribeNotices(seen)

    c.notice({ type: 'goal' })
    expect(seen).toHaveBeenCalledWith({ type: 'goal' })
    expect(b.getState()).toEqual({ score: 0 })
  })

  it('notifies board subscribers when a snapshot arrives', () => {
    const { makeConsole, makeBoard } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    const b = makeBoard('b1')
    b.start()
    const listener = vi.fn()
    b.subscribe(listener)
    c.publish({ score: 5 })
    expect(listener).toHaveBeenCalled()
  })

  it('never lets a board write: it only sends hello and ping', () => {
    const { bus, makeConsole, makeBoard } = setup()
    const spy = bus.open()
    const sent: SyncMessage<State, Notice>['type'][] = []
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    spy.subscribe((m) => {
      if (m.from === 'b1') sent.push(m.type)
    })
    const b = makeBoard('b1')
    b.start()
    advance(HEARTBEAT_MS * 2)
    expect(new Set(sent)).toEqual(new Set(['hello', 'ping']))
  })
})

describe('connection status', () => {
  it('shows the board connected after hello, and gone after it goes quiet', () => {
    const { makeConsole, makeBoard } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    expect(c.getStatus().boardConnected).toBe(false)

    const b = makeBoard('b1')
    b.start()
    expect(c.getStatus().boardConnected).toBe(true)

    b.dispose()
    advance(PEER_TIMEOUT_MS + HEARTBEAT_MS)
    expect(c.getStatus().boardConnected).toBe(false)
  })

  it('keeps a pinging board connected indefinitely', () => {
    const { makeConsole, makeBoard } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    makeBoard('b1').start()
    advance(PEER_TIMEOUT_MS * 5)
    expect(c.getStatus().boardConnected).toBe(true)
  })

  it('keeps the last state and reports disconnected when the console goes quiet', () => {
    const { makeConsole, makeBoard, state } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    state.current = { score: 4 }
    const b = makeBoard('b1')
    b.start()
    expect(b.getStatus().connected).toBe(true)

    c.dispose()
    advance(PEER_TIMEOUT_MS + HEARTBEAT_MS)
    expect(b.getStatus().connected).toBe(false)
    expect(b.getState()).toEqual({ score: 4 })
  })

  it('reconnects a board when the console comes back', () => {
    const { makeConsole, makeBoard } = setup()
    const c1 = makeConsole('c1')
    c1.start()
    advance(PROBE_MS)
    const b = makeBoard('b1')
    b.start()
    c1.dispose()
    advance(PEER_TIMEOUT_MS + HEARTBEAT_MS)
    expect(b.getStatus().connected).toBe(false)

    const c2 = makeConsole('c2')
    c2.start()
    advance(PROBE_MS)
    expect(b.getStatus().connected).toBe(true)
  })

  it('is driven by the monotonic clock, not wall-clock time', () => {
    const { makeConsole, makeBoard } = setup()
    const c = makeConsole('c1')
    c.start()
    advance(PROBE_MS)
    makeBoard('b1').start()
    // A wall-clock jump of a day changes nothing: liveness never reads it.
    vi.setSystemTime(Date.now() + 86_400_000)
    advance(HEARTBEAT_MS)
    expect(c.getStatus().boardConnected).toBe(true)
  })
})

describe('second console and takeover', () => {
  function twoConsoles() {
    const ctx = setup()
    const c1 = ctx.makeConsole('c1')
    c1.start()
    advance(PROBE_MS)
    const handover = vi.fn()
    const c2 = ctx.makeConsole('c2', handover)
    c2.start()
    advance(PROBE_MS)
    return { ...ctx, c1, c2, handover }
  }

  it('is blocked while another console is active', () => {
    const { c1, c2 } = twoConsoles()
    expect(c1.getStatus().role).toBe('active')
    expect(c2.getStatus().role).toBe('blocked')
  })

  it('does not publish while blocked', () => {
    const { c2, makeBoard } = twoConsoles()
    const b = makeBoard('b1')
    b.start()
    c2.publish({ score: 99 })
    expect(b.getState()).not.toEqual({ score: 99 })
  })

  it('takeover makes the new console active and the old one inactive', () => {
    const { c1, c2 } = twoConsoles()
    c2.takeOver()
    expect(c2.getStatus().role).toBe('active')
    expect(c1.getStatus().role).toBe('inactive')
  })

  it("hands the previous console's state to the new one", () => {
    const { c2, state, handover } = twoConsoles()
    state.current = { score: 7 }
    c2.takeOver()
    expect(handover).toHaveBeenCalledWith({ score: 7 })
  })

  it('moves boards to the new console and silences the old one', () => {
    const { c1, c2, makeBoard } = twoConsoles()
    const b = makeBoard('b1')
    b.start()
    c2.takeOver()

    c2.publish({ score: 1 })
    c1.publish({ score: 50 })
    expect(b.getState()).toEqual({ score: 1 })
  })

  it('lets the previous console take the match back (last takeover wins)', () => {
    const { c1, c2 } = twoConsoles()
    c2.takeOver()
    c1.takeOver()
    expect(c1.getStatus().role).toBe('active')
    expect(c2.getStatus().role).toBe('inactive')
  })

  it('ignores takeOver when already active', () => {
    const { c1 } = twoConsoles()
    c1.takeOver()
    expect(c1.getStatus().role).toBe('active')
  })

  it('notifies status subscribers on role changes', () => {
    const { c1, c2 } = twoConsoles()
    const listener = vi.fn()
    c1.subscribe(listener)
    c2.takeOver()
    expect(listener).toHaveBeenCalled()
  })
})
