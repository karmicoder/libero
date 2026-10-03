import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConsoleProps } from '../consoles/registry'
import type { GameEngine } from '../engines/types'
import { BoardLink } from '../sync/BoardLink'
import { MemoryBus } from '../sync/memoryChannel'
import { PROBE_MS } from '../sync/types'
import { ConsoleHost } from './ConsoleHost'
import { MatchStore } from './MatchStore'
import { useMatchState } from './useMatchState'

type State = { n: number }
type Action = { type: 'inc' }
type Message = { type: 'incremented' }

const counter: GameEngine<State, Action, Message, never> = {
  initialState: () => ({ n: 0 }),
  reduce: (s) => ({
    state: { n: s.n + 1 },
    messages: [{ type: 'incremented' }],
  }),
}

function FakeConsole({
  store,
  boardConnected,
}: ConsoleProps<State, Action, Message>) {
  const state = useMatchState(store)
  return (
    <div>
      <output aria-label="count">{state.n}</output>
      <p>{boardConnected ? 'board on' : 'board off'}</p>
      <button type="button" onClick={() => store.dispatch({ type: 'inc' })}>
        inc
      </button>
    </div>
  )
}

function mount(bus: MemoryBus<State, Message>, initial = 0) {
  const store = new MatchStore(counter, { n: initial })
  const view = render(
    <ConsoleHost
      sportId="test"
      store={store}
      Console={FakeConsole}
      openChannel={() => bus.open()}
    />,
  )
  return { store, ...view }
}

const settle = () => act(() => void vi.advanceTimersByTime(PROBE_MS))

describe('ConsoleHost', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('connects, then shows the console', () => {
    mount(new MemoryBus())
    expect(screen.getByText('Connecting')).toBeInTheDocument()
    settle()
    expect(screen.getByLabelText('count')).toHaveTextContent('0')
  })

  // fireEvent rather than user-event: with fake timers user-event's internal
  // waits never resolve under Vitest.
  it('publishes state changes and notices to a scoreboard', () => {
    const bus = new MemoryBus<State, Message>()
    mount(bus)
    settle()

    const board = new BoardLink<State, Message>(() => bus.open())
    const notices = vi.fn()
    board.subscribeNotices(notices)
    act(() => board.start())
    expect(board.getState()).toEqual({ n: 0 })
    expect(screen.getByText('board on')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'inc' }))
    expect(board.getState()).toEqual({ n: 1 })
    expect(notices).toHaveBeenCalledWith({ type: 'incremented' })
    board.stop()
  })

  it('blocks a second window until the user takes over, then hands state over', () => {
    const bus = new MemoryBus<State, Message>()
    const first = mount(bus, 5)
    settle()
    const second = mount(bus, 0)
    settle()

    expect(
      screen.getByRole('heading', {
        name: 'Match already open in another window',
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Take over' }))
    // The second window continues from the first one's state.
    expect(second.store.getState()).toEqual({ n: 5 })
    expect(
      screen.getByRole('heading', {
        name: 'Another window took over this match',
      }),
    ).toBeInTheDocument()
    expect(first.store.getState()).toEqual({ n: 5 })

    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    expect(screen.getAllByLabelText('count')).toHaveLength(1)
  })

  it('runs unsynced when there is no transport', () => {
    const store = new MatchStore(counter, { n: 0 })
    render(
      <ConsoleHost
        sportId="test"
        store={store}
        Console={FakeConsole}
        openChannel={() => null}
      />,
    )
    expect(screen.getByLabelText('count')).toBeInTheDocument()
  })
})
