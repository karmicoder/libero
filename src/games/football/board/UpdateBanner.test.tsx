import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FootballMessage } from '../state'
import { UpdateBanner } from './UpdateBanner'

const base = { id: 'e1@0', at: 0, team: 'home' as const, minute: 78 }

function renderBanner(notice: FootballMessage, phase: 'in' | 'out' = 'in') {
  render(<UpdateBanner notice={notice} phase={phase} />)
  return screen.getByRole('status')
}

describe('UpdateBanner', () => {
  describe('goal', () => {
    it('shows the minute, a named ball icon, the scorer and the assist', () => {
      const banner = renderBanner({
        ...base,
        type: 'goal-scored',
        scorer: 9,
        assist: 10,
      })
      expect(within(banner).getByText('78′')).toBeInTheDocument()
      expect(within(banner).getByRole('img', { name: 'Goal' })).toBeVisible()
      expect(banner).toHaveTextContent('9')
      expect(banner).toHaveTextContent('Assist 10')
    })

    it('omits the assist when there is none ("No assist")', () => {
      const banner = renderBanner({ ...base, type: 'goal-scored', scorer: 9 })
      expect(banner).toHaveTextContent('9')
      expect(banner).not.toHaveTextContent('Assist')
    })

    it('shows a dash for an unknown scorer', () => {
      const banner = renderBanner({ ...base, type: 'goal-scored' })
      expect(banner).toHaveTextContent('–')
      expect(banner).toHaveTextContent('scorer unknown')
    })
  })

  describe('card', () => {
    it('shows a yellow card glyph and the number', () => {
      const banner = renderBanner({
        ...base,
        type: 'card-issued',
        groups: [{ kind: 'yellow', numbers: [4] }],
      })
      expect(
        within(banner).getByRole('img', { name: 'Yellow card' }),
      ).toBeVisible()
      expect(banner).toHaveTextContent('4')
    })

    it('shows several numbers in one banner', () => {
      const banner = renderBanner({
        ...base,
        type: 'card-issued',
        groups: [{ kind: 'yellow', numbers: [4, 7, 9] }],
      })
      expect(banner).toHaveTextContent('4 7 9')
    })

    it('names a red card and a second yellow', () => {
      renderBanner({
        ...base,
        type: 'card-issued',
        groups: [{ kind: 'red', numbers: [2] }],
      })
      expect(screen.getByRole('img', { name: 'Red card' })).toBeVisible()
    })

    it('shows a yellow and a second yellow together in one banner', () => {
      const banner = renderBanner({
        ...base,
        type: 'card-issued',
        groups: [
          { kind: 'yellow', numbers: [7] },
          { kind: 'second', numbers: [4] },
        ],
      })
      expect(
        within(banner).getByRole('img', { name: 'Yellow card' }),
      ).toBeVisible()
      expect(
        within(banner).getByRole('img', { name: 'Second yellow' }),
      ).toBeVisible()
      expect(banner).toHaveTextContent('7')
      expect(banner).toHaveTextContent('4')
    })

    it('shows a card for an unidentified player without a number', () => {
      const banner = renderBanner({
        ...base,
        type: 'card-issued',
        groups: [{ kind: 'yellow', numbers: [] }],
      })
      expect(
        within(banner).getByRole('img', { name: 'Yellow card' }),
      ).toBeVisible()
    })
  })

  describe('substitution', () => {
    it('shows off and on numbers with named arrows', () => {
      const banner = renderBanner({
        ...base,
        type: 'substitution-made',
        pairs: [{ off: 3, on: 12 }],
      })
      expect(within(banner).getByRole('img', { name: 'Off' })).toBeVisible()
      expect(within(banner).getByRole('img', { name: 'On' })).toBeVisible()
      expect(banner).toHaveTextContent('3')
      expect(banner).toHaveTextContent('12')
    })

    it('shows up to three pairs (triple substitution)', () => {
      const banner = renderBanner({
        ...base,
        type: 'substitution-made',
        pairs: [
          { off: 1, on: 13 },
          { off: 2, on: 14 },
          { off: 3, on: 15 },
        ],
      })
      expect(within(banner).getAllByRole('img', { name: 'Off' })).toHaveLength(
        3,
      )
      expect(banner).not.toHaveTextContent('+')
    })

    it('counts pairs beyond three', () => {
      const banner = renderBanner({
        ...base,
        type: 'substitution-made',
        pairs: [{}, {}, {}, {}, {}],
      })
      expect(within(banner).getAllByRole('img', { name: 'Off' })).toHaveLength(
        3,
      )
      expect(banner).toHaveTextContent('+2')
    })

    it('shows a dash for a missing number', () => {
      const banner = renderBanner({
        ...base,
        type: 'substitution-made',
        pairs: [{ off: 5 }],
      })
      expect(banner).toHaveTextContent('5')
      expect(banner).toHaveTextContent('–')
    })
  })

  it('goes in the scoring team’s corner and reports its phase', () => {
    const { rerender } = render(
      <UpdateBanner
        notice={{ ...base, type: 'goal-scored', team: 'visitor' }}
        phase="in"
      />,
    )
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('data-team', 'visitor')
    expect(banner).toHaveAttribute('data-phase', 'in')
    rerender(
      <UpdateBanner
        notice={{ ...base, type: 'goal-scored', team: 'visitor' }}
        phase="out"
      />,
    )
    expect(screen.getByRole('status')).toHaveAttribute('data-phase', 'out')
  })
})
