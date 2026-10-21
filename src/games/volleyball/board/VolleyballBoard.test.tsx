import { act, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BoardProps } from '../../../boards/registry'
import { defaultVolleyballConfig } from '../config'
import type { ClosedSet, VolleyballMessage, VolleyballState } from '../state'
import { VolleyballBoard } from './VolleyballBoard'

const state = (patch: Partial<VolleyballState> = {}): VolleyballState => ({
  config: defaultVolleyballConfig(),
  teams: { visitor: { name: 'Rovers' }, home: { name: 'United' } },
  completed: [],
  current: { visitor: 12, home: 14 },
  firstServer: 'home',
  serving: 'home',
  status: 'in-play',
  ...patch,
})

const closed = (visitor: number, home: number): ClosedSet => ({
  visitor,
  home,
  firstServer: 'visitor',
})

function renderBoard(s: VolleyballState, connected = true) {
  return render(
    <VolleyballBoard
      state={s}
      connected={connected}
      subscribeNotices={() => () => {}}
    />,
  )
}

describe('VolleyballBoard', () => {
  it('shows team names and the live set score', () => {
    renderBoard(state())
    expect(screen.getByRole('heading', { name: 'Rovers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'United' })).toBeInTheDocument()
    expect(screen.getByLabelText('Visitor score')).toHaveTextContent('12')
    expect(screen.getByLabelText('Home score')).toHaveTextContent('14')
  })

  it('falls back to Visitor/Home for a blank name', () => {
    renderBoard(state({ teams: { visitor: { name: '' }, home: { name: '' } } }))
    expect(screen.getByRole('heading', { name: 'Visitor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('shows one pip per set needed, filled for sets won', () => {
    renderBoard(
      state({ completed: [closed(25, 21), closed(22, 25), closed(25, 20)] }),
    )
    const visitor = screen.getByRole('region', { name: 'Visitor team' })
    const home = screen.getByRole('region', { name: 'Home team' })
    expect(within(visitor).getByText('2 of 3 sets won')).toBeInTheDocument()
    expect(within(home).getByText('1 of 3 sets won')).toBeInTheDocument()
  })

  it('follows the configured sets to win', () => {
    renderBoard(
      state({ config: { ...defaultVolleyballConfig(), setsToWin: 2 } }),
    )
    expect(screen.getAllByText('0 of 2 sets won')).toHaveLength(2)
  })

  it('numbers the live set and lists the completed ones', () => {
    renderBoard(state({ completed: [closed(25, 21), closed(22, 25)] }))
    expect(screen.getByRole('region', { name: 'Set' })).toHaveTextContent('3')
    const results = within(
      screen.getByRole('list', { name: 'Completed sets' }),
    ).getAllByRole('listitem')
    expect(results).toHaveLength(2)
    expect(results[0]).toHaveTextContent('Set 1')
    expect(results[0]).toHaveTextContent('25 – 21')
    expect(results[1]).toHaveTextContent('22 – 25')
  })

  it('has no results list before a set is closed', () => {
    renderBoard(state())
    expect(screen.queryByRole('list', { name: 'Completed sets' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Set' })).toHaveTextContent('1')
  })

  it('shows the serve indicator on the serving side only', () => {
    renderBoard(state({ serving: 'visitor' }))
    const visitor = screen.getByRole('region', { name: 'Visitor team' })
    const home = screen.getByRole('region', { name: 'Home team' })
    expect(within(visitor).getByText('Serving')).toBeInTheDocument()
    expect(within(home).queryByText('Serving')).toBeNull()
  })

  it('keeps the deciding set number once the match is finished', () => {
    renderBoard(
      state({
        status: 'finished',
        current: { visitor: 0, home: 0 },
        completed: [closed(25, 21), closed(25, 22), closed(25, 20)],
      }),
    )
    const set = screen.getByRole('region', { name: 'Set' })
    expect(set.querySelector('p')).toHaveTextContent(/^3$/)
  })

  it('says when the console is disconnected', () => {
    renderBoard(state(), false)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Disconnected from console',
    )
  })
})

const board = (
  s: VolleyballState,
  subscribe: BoardProps<
    VolleyballState,
    VolleyballMessage
  >['subscribeNotices'] = () => () => {},
) => <VolleyballBoard state={s} connected subscribeNotices={subscribe} />

const rolling = (label: string) =>
  Array.from(screen.getByLabelText(label).querySelectorAll('[data-prev]')).map(
    (el) => el.getAttribute('data-prev'),
  )

describe('VolleyballBoard motion', () => {
  it('a board attaching mid-set shows everything static', () => {
    const { container } = render(board(state({ serving: 'visitor' })))
    expect(rolling('Visitor score')).toEqual([])
    expect(container.querySelector('[class*="serveIn"]')).toBeNull()
    expect(container.querySelector('[class*="ghost"]')).toBeNull()
  })

  it('rolls the digit of the side that scored', () => {
    const view = render(board(state()))
    view.rerender(board(state({ current: { visitor: 13, home: 14 } })))
    expect(rolling('Visitor score')).toEqual(['2'])
    expect(rolling('Home score')).toEqual([])
  })

  it('moves the serve dot: old one out, new one in', () => {
    const view = render(board(state({ serving: 'home' })))
    view.rerender(
      board(state({ serving: 'visitor', current: { visitor: 13, home: 14 } })),
    )
    const visitor = screen.getByRole('region', { name: 'Visitor team' })
    const home = screen.getByRole('region', { name: 'Home team' })
    expect(visitor.querySelector('[class*="serveIn"]')).not.toBeNull()
    expect(home.querySelector('[class*="serveOut"]')).not.toBeNull()
    // The leaving dot is not announced.
    expect(within(home).queryByText('Serving')).toBeNull()
  })

  const closing = state({
    current: { visitor: 0, home: 0 },
    completed: [closed(25, 21)],
    serving: 'home',
    firstServer: 'home',
  })
  const closingFrom = state({ current: { visitor: 25, home: 21 } })

  it('draws a closed set over the truthful 0-0 and pops the new pip', () => {
    const view = render(board(closingFrom))
    view.rerender(board(closing))
    // The live digits are 0 at once.
    expect(screen.getByLabelText('Visitor score')).toHaveTextContent('0')
    const visitor = screen.getByRole('region', { name: 'Visitor team' })
    const ghost = visitor.querySelector('[class*="ghost"]')
    expect(ghost).toHaveTextContent('25')
    expect(ghost).toHaveAttribute('aria-hidden', 'true')
    expect(
      screen
        .getByRole('region', { name: 'Home team' })
        .querySelector('[class*="ghost"]'),
    ).toHaveTextContent('21')
    expect(visitor.querySelector('[class*="pipPop"]')).not.toBeNull()
    // The score is not misread as 25 by assistive technology.
    expect(screen.getByLabelText('Visitor score').textContent).toBe('025')
  })

  it('a newer change cancels the set-win overlay (retarget, never queue)', () => {
    const view = render(board(closingFrom))
    view.rerender(board(closing))
    view.rerender(board({ ...closing, current: { visitor: 1, home: 0 } }))
    expect(document.querySelector('[class*="ghost"]')).toBeNull()
  })

  it('keeps the overlay through a rename', () => {
    const view = render(board(closingFrom))
    view.rerender(board(closing))
    view.rerender(
      board({ ...closing, teams: { ...closing.teams, home: { name: 'Utd' } } }),
    )
    expect(document.querySelector('[class*="ghost"]')).not.toBeNull()
  })

  it('shows a reconnect mid-sequence as plain 0-0 with the pip', () => {
    renderBoard(closing)
    expect(screen.getByLabelText('Visitor score')).toHaveTextContent('0')
    expect(document.querySelector('[class*="ghost"]')).toBeNull()
    expect(document.querySelector('[class*="pipPop"]')).toBeNull()
  })
})

describe('VolleyballBoard set-won banner', () => {
  const notice = (
    patch: Partial<Extract<VolleyballMessage, { type: 'set-won' }>> = {},
  ): VolleyballMessage => ({
    type: 'set-won',
    id: 'set-won@1',
    at: 1,
    team: 'visitor',
    setNumber: 1,
    score: { visitor: 25, home: 21 },
    setsWon: { visitor: 1, home: 0 },
    matchWon: false,
    ...patch,
  })

  function withFeed() {
    let listener: (n: VolleyballMessage) => void = () => {}
    const subscribe = (l: (n: VolleyballMessage) => void) => {
      listener = l
      return () => {}
    }
    render(board(state(), subscribe))
    return (n: VolleyballMessage) => act(() => listener(n))
  }

  it('shows the set and its score under the winner', () => {
    const send = withFeed()
    send(notice())
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Set 1')
    expect(banner).toHaveTextContent('Rovers')
    expect(banner).toHaveTextContent('25 – 21')
    expect(banner).toHaveAttribute('data-team', 'visitor')
  })

  it('shows the match result for the match-winning set', () => {
    const send = withFeed()
    send(
      notice({
        team: 'home',
        matchWon: true,
        setsWon: { visitor: 1, home: 3 },
      }),
    )
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Match')
    expect(banner).toHaveTextContent('United')
    expect(banner).toHaveTextContent('1 – 3')
  })

  it('does not banner a point', () => {
    const send = withFeed()
    send({
      type: 'point-scored',
      id: 'point-scored@1',
      at: 1,
      team: 'home',
      serveChanged: false,
      score: { visitor: 12, home: 15 },
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('VolleyballBoard match over', () => {
  const over = state({
    status: 'finished',
    current: { visitor: 0, home: 0 },
    completed: [closed(25, 21), closed(22, 25), closed(25, 20), closed(25, 23)],
  })

  it('shows the winner and the sets won in place of the live score', () => {
    renderBoard(over)
    expect(screen.getByText('Match over')).toBeInTheDocument()
    expect(screen.getByText('Rovers wins')).toBeInTheDocument()
    expect(screen.getByLabelText('Visitor sets won')).toHaveTextContent('3')
    expect(screen.getByLabelText('Home sets won')).toHaveTextContent('1')
    expect(screen.queryByLabelText('Visitor score')).toBeNull()
  })

  it('no longer shows a serve indicator', () => {
    renderBoard(over)
    expect(screen.queryByText('Serving')).toBeNull()
  })
})
