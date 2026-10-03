import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useSyncExternalStore } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineRegistry } from '../engines/registry'
import type { FootballAction, FootballState } from '../games/football/state'
import { footballEngine } from '../games/football/engine/football'
import { MatchSession } from './MatchSession'
import type { MatchStore } from './MatchStore'

const KEY = 'libero:match:football'
const T0 = 1_000_000

type Store = MatchStore<FootballState, FootballAction, never>

function Probe({ store }: { store: Store }) {
  const s = useSyncExternalStore(store.subscribe, store.getState)
  return (
    <div>
      <output aria-label="score">
        {s.teams.visitor.score}-{s.teams.home.score}
      </output>
      <output aria-label="clock">
        {s.clock.baseSeconds}/{String(s.clock.runningSince)}
      </output>
      <output aria-label="events">{s.events.length}</output>
      <button
        type="button"
        onClick={() => store.dispatch({ type: 'goal', team: 'home', at: T0 })}
      >
        Home goal
      </button>
      <button
        type="button"
        onClick={() => store.dispatch({ type: 'start-clock', at: T0 })}
      >
        Start
      </button>
    </div>
  )
}

function renderSession() {
  const registry = new EngineRegistry()
  registry.register('football', footballEngine)
  return render(
    <MemoryRouter>
      <MatchSession<FootballState, FootballAction, never>
        sportId="football"
        registry={registry}
      >
        {(store) => <Probe store={store} />}
      </MatchSession>
    </MemoryRouter>,
  )
}

/** Plays a match, then unmounts, leaving a backup in localStorage. */
async function playAndLeave() {
  const user = userEvent.setup()
  const view = renderSession()
  await user.click(screen.getByRole('button', { name: 'Home goal' }))
  await user.click(screen.getByRole('button', { name: 'Start' }))
  view.unmount()
}

describe('MatchSession', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('starts a fresh match straight away when there is no backup', () => {
    renderSession()
    expect(screen.getByLabelText('score')).toHaveTextContent('0-0')
    expect(screen.queryByRole('heading', { name: /resume/i })).toBeNull()
  })

  it('backs up each change to localStorage', async () => {
    await playAndLeave()
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    expect(saved.version).toBe(1)
    expect(saved.state.teams.home.score).toBe(1)
    expect(saved.state.clock.runningSince).toBe(T0)
  })

  it('resumes score, running clock and events from the backup', async () => {
    await playAndLeave()
    const user = userEvent.setup()
    renderSession()
    expect(
      screen.getByRole('heading', { name: 'Resume match?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume match' }))
    expect(screen.getByLabelText('score')).toHaveTextContent('0-1')
    expect(screen.getByLabelText('events')).toHaveTextContent('1')
    // The running clock keeps its start timestamp, so it keeps counting.
    expect(screen.getByLabelText('clock')).toHaveTextContent(`0/${T0}`)
  })

  it('discards the backup only after confirmation', async () => {
    await playAndLeave()
    const user = userEvent.setup()
    renderSession()

    await user.click(screen.getByRole('button', { name: 'New match' }))
    expect(
      screen.getByRole('heading', { name: 'Discard saved match?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(localStorage.getItem(KEY)).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'New match' }))
    await user.click(
      screen.getByRole('button', { name: 'Discard and start new match' }),
    )
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(screen.getByLabelText('score')).toHaveTextContent('0-0')
    expect(screen.getByLabelText('events')).toHaveTextContent('0')
  })

  it('falls back to a fresh match on a version mismatch', async () => {
    await playAndLeave()
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    localStorage.setItem(KEY, JSON.stringify({ ...saved, version: 0 }))
    renderSession()
    expect(screen.getByLabelText('score')).toHaveTextContent('0-0')
  })

  it('falls back to a fresh match on a corrupt backup', () => {
    localStorage.setItem(KEY, '{"version":1,"state":{"oops":true}}')
    renderSession()
    expect(screen.getByLabelText('score')).toHaveTextContent('0-0')
  })

  it('works when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const user = userEvent.setup()
    renderSession()
    await user.click(screen.getByRole('button', { name: 'Home goal' }))
    expect(screen.getByLabelText('score')).toHaveTextContent('0-1')
  })

  it('shows a message when the sport has no engine', () => {
    const empty = new EngineRegistry()
    render(
      <MemoryRouter>
        <MatchSession sportId="football" registry={empty}>
          {() => null}
        </MatchSession>
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Match not available' }),
    ).toBeInTheDocument()
  })
})
