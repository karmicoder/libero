import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { defaultVolleyballConfig } from '../config'
import type { ClosedSet, VolleyballState } from '../state'
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
