import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BoardStage } from './BoardStage'

function renderStage(connected: boolean) {
  render(
    <BoardStage
      title="Test scoreboard"
      connected={connected}
      gridClassName="grid"
      banner={<p>Goal!</p>}
    >
      <p>Sport content</p>
    </BoardStage>,
  )
}

describe('BoardStage', () => {
  it('names the page and renders the stage, content and banner', () => {
    renderStage(true)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Test scoreboard' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('board-stage')).toHaveTextContent('Sport content')
    expect(screen.getByText('Goal!')).toBeInTheDocument()
  })

  it('applies the sport grid class to the board', () => {
    renderStage(true)
    expect(screen.getByText('Sport content').parentElement).toHaveClass('grid')
  })

  it('shows the disconnected status only when disconnected', () => {
    renderStage(true)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('announces a lost connection', () => {
    renderStage(false)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Disconnected from console',
    )
  })
})
