import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { defaultMatchConfig } from '../config'
import type { FootballState } from '../state'
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
    it('shows remaining subs for the period', () => {
      renderBoard(
        state({
          events: [
            {
              id: 'e1',
              type: 'substitution',
              team: 'home',
              periodId: 'h1',
              clockSeconds: 60,
            },
          ],
        }),
      )
      expect(screen.getByText('2 of 3 left this period')).toBeInTheDocument()
      expect(screen.getByText('3 of 3 left this period')).toBeInTheDocument()
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
})
