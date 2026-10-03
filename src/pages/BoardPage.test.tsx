import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { registerBuiltinBoards } from '../boards/builtin'
import { registerBuiltinSports } from '../sports/builtin'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Board page', () => {
  beforeEach(() => {
    registerBuiltinSports()
    registerBuiltinBoards()
  })
  afterEach(() => document.documentElement.removeAttribute('data-theme'))

  it('waits for the console when nothing has been published', () => {
    renderAt('/match/football/board')
    expect(
      screen.getByText('Waiting for the scorer console'),
    ).toBeInTheDocument()
  })

  it('has no app header: the board fills the window', () => {
    renderAt('/match/football/board')
    expect(screen.queryByRole('banner')).toBeNull()
  })

  it('says so for a sport with no scoreboard', () => {
    renderAt('/match/volleyball/board')
    expect(
      screen.getByRole('heading', { name: 'Scoreboard not available' }),
    ).toBeInTheDocument()
  })

  it('applies ?theme=light|dark to the document, and removes it on leave', () => {
    const { unmount } = renderAt('/match/football/board?theme=light')
    expect(document.documentElement.dataset.theme).toBe('light')
    unmount()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('ignores an unknown theme value', () => {
    renderAt('/match/football/board?theme=neon')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})
