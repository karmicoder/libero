import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { defaultMatchConfig } from '../config'
import type { FootballState } from '../state'
import { FootballBoard } from './FootballBoard'

const withScores = (visitor: number, home: number): FootballState => ({
  config: defaultMatchConfig(),
  clock: { baseSeconds: 0, runningSince: null },
  periodId: 'h1',
  stoppageMinutes: null,
  teams: {
    visitor: { name: 'Rovers', score: visitor },
    home: { name: 'United', score: home },
  },
  subsRemaining: { visitor: 3, home: 3 },
  events: [],
  nextEventId: 1,
})

const board = (s: FootballState) => (
  <FootballBoard state={s} connected subscribeNotices={() => () => {}} />
)

const rolling = (label: string) =>
  Array.from(screen.getByLabelText(label).querySelectorAll('[data-prev]')).map(
    (el) => el.getAttribute('data-prev'),
  )

describe('FootballBoard score motion', () => {
  it('a board attaching mid-match shows the scores with nothing rolling', () => {
    render(board(withScores(3, 12)))
    expect(screen.getByLabelText('Visitor score')).toHaveTextContent('3')
    expect(screen.getByLabelText('Home score')).toHaveTextContent('12')
    expect(rolling('Visitor score')).toEqual([])
    expect(rolling('Home score')).toEqual([])
  })

  it('rolls the score of the team that scored, and only that team', () => {
    const view = render(board(withScores(0, 0)))
    view.rerender(board(withScores(0, 1)))
    expect(rolling('Home score')).toEqual(['0'])
    expect(rolling('Visitor score')).toEqual([])
    view.rerender(board(withScores(1, 1)))
    expect(rolling('Visitor score')).toEqual(['0'])
  })

  it('handles a score reaching double digits', () => {
    const view = render(board(withScores(0, 9)))
    view.rerender(board(withScores(0, 10)))
    expect(screen.getByLabelText('Home score')).toHaveTextContent('10')
    expect(rolling('Home score')).toEqual(['', '9'])
  })

  it('coalesces rapid goals to the latest score', () => {
    const view = render(board(withScores(0, 0)))
    for (const n of [1, 2, 3, 4]) view.rerender(board(withScores(0, n)))
    expect(screen.getByLabelText('Home score')).toHaveTextContent('4')
    expect(rolling('Home score')).toEqual(['3'])
  })
})
