import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BANNER_EXIT_MS, BANNER_VISIBLE_MS } from '../../../boards/banner'
import { defaultMatchConfig } from '../config'
import type { FootballMessage, FootballState } from '../state'
import { FootballBoard } from './FootballBoard'

const state = (patch: Partial<FootballState> = {}): FootballState => ({
  config: defaultMatchConfig(),
  clock: { baseSeconds: 0, runningSince: null },
  periodId: 'h1',
  stoppageMinutes: null,
  teams: {
    visitor: { name: 'Rovers', score: 2 },
    home: { name: 'United', score: 11 },
  },
  subsRemaining: { visitor: 3, home: 3 },
  events: [],
  nextEventId: 1,
  ...patch,
})

function renderBoard(s: FootballState, connected = true) {
  return render(
    <FootballBoard
      state={s}
      connected={connected}
      subscribeNotices={() => () => {}}
    />,
  )
}

describe('FootballBoard', () => {
  it('shows team names and scores', () => {
    renderBoard(state())
    expect(screen.getByRole('heading', { name: 'Rovers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'United' })).toBeInTheDocument()
    expect(screen.getByLabelText('Visitor score')).toHaveTextContent('2')
    expect(screen.getByLabelText('Home score')).toHaveTextContent('11')
  })

  it('falls back to Visitor/Home for a blank name', () => {
    renderBoard(
      state({
        teams: {
          visitor: { name: '', score: 0 },
          home: { name: '', score: 0 },
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'Visitor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('shows the clock and period label', () => {
    renderBoard(
      state({
        periodId: 'h2',
        clock: { baseSeconds: 45 * 60 + 7, runningSince: null },
      }),
    )
    expect(screen.getByText('45:07')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '2nd half' }),
    ).toBeInTheDocument()
  })

  it('lets the clock run past 99 minutes', () => {
    renderBoard(
      state({
        periodId: 'et2',
        clock: { baseSeconds: 105 * 60 + 37, runningSince: null },
      }),
    )
    expect(screen.getByText('105:37')).toBeInTheDocument()
  })

  it('derives a running clock from its start timestamp', () => {
    renderBoard(
      state({ clock: { baseSeconds: 60, runningSince: Date.now() - 5_000 } }),
    )
    expect(screen.getByText(/^01:0[4-9]$/)).toBeInTheDocument()
  })

  it('hides the clock in a shootout', () => {
    renderBoard(state({ periodId: 'pen' }))
    expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Penalties' }),
    ).toBeInTheDocument()
  })

  describe('stoppage pill', () => {
    it('shows added minutes in a play period', () => {
      renderBoard(state({ stoppageMinutes: 4 }))
      expect(screen.getByText('+4′')).toBeInTheDocument()
    })

    it('is hidden at 0, when null, outside play, or when disabled', () => {
      const { unmount } = renderBoard(state({ stoppageMinutes: 0 }))
      expect(screen.queryByText(/^\+\d/)).toBeNull()
      unmount()

      const { unmount: u2 } = renderBoard(
        state({ periodId: 'ht', stoppageMinutes: 3 }),
      )
      expect(screen.queryByText(/^\+\d/)).toBeNull()
      u2()

      renderBoard(
        state({
          stoppageMinutes: 3,
          config: { ...defaultMatchConfig(), stoppageTime: { enabled: false } },
        }),
      )
      expect(screen.queryByText(/^\+\d/)).toBeNull()
    })
  })

  describe('substitution pips', () => {
    it('shows each team’s remaining subs from state', () => {
      renderBoard(state({ subsRemaining: { visitor: 3, home: 1 } }))
      expect(screen.getByText('1 of 3 left this period')).toBeInTheDocument()
      expect(screen.getByText('3 of 3 left this period')).toBeInTheDocument()
    })

    it('shows extra pips when remaining was raised above the limit', () => {
      renderBoard(state({ subsRemaining: { visitor: 3, home: 5 } }))
      expect(screen.getByText('5 of 5 left this period')).toBeInTheDocument()
    })

    it('is hidden when substitutions are disabled', () => {
      renderBoard(
        state({
          config: {
            ...defaultMatchConfig(),
            substitutions: { enabled: false },
          },
        }),
      )
      expect(screen.queryByText('Subs')).toBeNull()
    })
  })

  describe('connection', () => {
    it('shows nothing extra while connected', () => {
      renderBoard(state())
      expect(screen.queryByText(/disconnected/i)).toBeNull()
    })

    it('keeps showing the last state and flags a lost console', () => {
      renderBoard(state(), false)
      expect(screen.getByText('Disconnected from console')).toBeInTheDocument()
      expect(screen.getByLabelText('Home score')).toHaveTextContent('11')
    })
  })

  describe('update banners', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    /** A board whose notice feed the test controls. */
    function boardWithFeed() {
      const listeners = new Set<(m: FootballMessage) => void>()
      render(
        <FootballBoard
          state={state()}
          connected
          subscribeNotices={(l) => {
            listeners.add(l)
            return () => void listeners.delete(l)
          }}
        />,
      )
      return (m: FootballMessage) => act(() => listeners.forEach((l) => l(m)))
    }

    const goal = (id: string, team: 'home' | 'visitor'): FootballMessage => ({
      type: 'goal-scored',
      id,
      at: 0,
      team,
      minute: 12,
      scorer: 9,
    })

    it('shows no banner until a notice arrives', () => {
      boardWithFeed()
      expect(screen.queryByText('12′')).toBeNull()
    })

    it('shows a notice in the scoring team’s banner and then removes it', () => {
      const announce = boardWithFeed()
      announce(goal('e1@0', 'visitor'))
      const banner = screen.getByText('12′').closest('[data-team]')
      expect(banner).toHaveAttribute('data-team', 'visitor')

      act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS))
      expect(banner).toHaveAttribute('data-phase', 'out')
      act(() => void vi.advanceTimersByTime(BANNER_EXIT_MS))
      expect(screen.queryByText('12′')).toBeNull()
    })

    it('replaces the banner with a newer notice, in the other corner', () => {
      const announce = boardWithFeed()
      announce(goal('e1@0', 'visitor'))
      announce(goal('e2@1', 'home'))
      const banners = screen.getAllByText('12′')
      expect(banners).toHaveLength(1)
      expect(banners[0].closest('[data-team]')).toHaveAttribute(
        'data-team',
        'home',
      )
    })
  })
})
