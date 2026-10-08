import { act, render, screen } from '@testing-library/react'
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

interface SavedBackup {
  version: number
  savedAt?: number
  state: { clock: { baseSeconds: number; runningSince: number | null } }
}
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
    expect(saved.version).toBe(2)
    expect(typeof saved.savedAt).toBe('number')
    expect(saved.state.teams.home.score).toBe(1)
    expect(saved.state.clock.runningSince).not.toBeNull()
  })

  it('resumes score and events, with a running clock stopped', async () => {
    await playAndLeave()
    const user = userEvent.setup()
    renderSession()
    expect(
      screen.getByRole('heading', { name: 'Resume match?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume match' }))
    expect(screen.getByLabelText('score')).toHaveTextContent('0-1')
    expect(screen.getByLabelText('events')).toHaveTextContent('1')
    // The old anchor belonged to a closed document, so the clock is stopped.
    expect(screen.getByLabelText('clock')).toHaveTextContent(/\/null$/)
  })

  /** Rewrites the saved backup, as if it had been written a while ago. */
  function ageBackup(patch: (saved: SavedBackup) => void) {
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    patch(saved)
    localStorage.setItem(KEY, JSON.stringify(saved))
  }

  it('offers to add the wall-clock time since the last save', async () => {
    await playAndLeave()
    ageBackup((saved) => {
      saved.savedAt = Date.now() - 125_000
      saved.state.clock.baseSeconds = 600
    })
    const user = userEvent.setup()
    renderSession()
    expect(screen.getByText(/clock was running/i)).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Resume and add 02:05' }),
    )
    const [base, since] = screen.getByLabelText('clock').textContent!.split('/')
    expect(since).toBe('null')
    expect(Number(base)).toBeGreaterThanOrEqual(725)
    expect(Number(base)).toBeLessThan(727)
  })

  it('resumes without adding the gap when asked', async () => {
    await playAndLeave()
    ageBackup((saved) => {
      saved.savedAt = Date.now() - 125_000
      saved.state.clock.baseSeconds = 600
    })
    const user = userEvent.setup()
    renderSession()
    await user.click(screen.getByRole('button', { name: 'Resume match' }))
    expect(screen.getByLabelText('clock')).toHaveTextContent('600/null')
  })

  it('migrates a version 1 backup, whose clock anchor is a wall-clock time', async () => {
    await playAndLeave()
    ageBackup((saved) => {
      saved.version = 1
      delete saved.savedAt
      saved.state.clock = {
        baseSeconds: 300,
        runningSince: Date.now() - 90_000,
      }
    })
    const user = userEvent.setup()
    renderSession()
    await user.click(
      screen.getByRole('button', { name: 'Resume and add 01:30' }),
    )
    const [base, since] = screen.getByLabelText('clock').textContent!.split('/')
    expect(since).toBe('null')
    expect(Number(base)).toBeGreaterThanOrEqual(390)
    expect(Number(base)).toBeLessThan(392)
  })

  it('re-saves a running clock periodically', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderSession()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      const first = JSON.parse(localStorage.getItem(KEY)!).savedAt
      await act(async () => void vi.advanceTimersByTime(5_000))
      expect(JSON.parse(localStorage.getItem(KEY)!).savedAt).toBeGreaterThan(
        first,
      )
    } finally {
      vi.useRealTimers()
    }
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
    localStorage.setItem(KEY, '{"version":2,"savedAt":1,"state":{"oops":true}}')
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
