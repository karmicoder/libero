import { act, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardProps } from '../boards/registry'
import { ConsoleLink } from '../sync/ConsoleLink'
import { MemoryBus } from '../sync/memoryChannel'
import { HEARTBEAT_MS, PEER_TIMEOUT_MS, PROBE_MS } from '../sync/types'
import { BoardHost } from './BoardHost'

type State = { n: number }
type Notice = { type: 'tick' }

function FakeBoard({
  state,
  connected,
  subscribeNotices,
}: BoardProps<State, Notice>) {
  const [notices, setNotices] = useState(0)
  useEffect(
    () => subscribeNotices(() => setNotices((c) => c + 1)),
    [subscribeNotices],
  )
  return (
    <div>
      <output aria-label="count">{state.n}</output>
      <p>{connected ? 'live' : 'frozen'}</p>
      <p aria-label="notices">{notices}</p>
    </div>
  )
}

const mountBoard = (bus: MemoryBus<State, Notice>) =>
  render(
    <BoardHost sportId="t" Board={FakeBoard} openChannel={() => bus.open()} />,
  )

function startConsole(bus: MemoryBus<State, Notice>, state = { n: 1 }) {
  const link = new ConsoleLink<State, Notice>(() => bus.open(), {
    getState: () => state,
  })
  link.start()
  act(() => void vi.advanceTimersByTime(PROBE_MS))
  return link
}

describe('BoardHost', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for the console, then shows its state', () => {
    const bus = new MemoryBus<State, Notice>()
    mountBoard(bus)
    expect(
      screen.getByText('Waiting for the scorer console'),
    ).toBeInTheDocument()

    act(() => void startConsole(bus, { n: 7 }))
    expect(screen.getByLabelText('count')).toHaveTextContent('7')
    expect(screen.getByText('live')).toBeInTheDocument()
  })

  it('follows published snapshots and forwards notices', () => {
    const bus = new MemoryBus<State, Notice>()
    const console_ = startConsole(bus)
    mountBoard(bus)
    expect(screen.getByLabelText('count')).toHaveTextContent('1')

    act(() => console_.publish({ n: 2 }))
    expect(screen.getByLabelText('count')).toHaveTextContent('2')

    act(() => console_.notice({ type: 'tick' }))
    expect(screen.getByLabelText('notices')).toHaveTextContent('1')
  })

  it('freezes on the last state when the console goes quiet', () => {
    const bus = new MemoryBus<State, Notice>()
    const console_ = startConsole(bus, { n: 9 })
    mountBoard(bus)
    expect(screen.getByText('live')).toBeInTheDocument()

    act(() => {
      console_.stop()
      vi.advanceTimersByTime(PEER_TIMEOUT_MS + HEARTBEAT_MS)
    })
    expect(screen.getByText('frozen')).toBeInTheDocument()
    expect(screen.getByLabelText('count')).toHaveTextContent('9')
  })
})
