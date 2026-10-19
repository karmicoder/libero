import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { boardRegistry, type BoardProps } from '../boards/registry'
import { registerBuiltinSports } from '../sports/builtin'

// Skip the sync layer: render whichever board the page resolved.
vi.mock('../match/BoardHost', () => ({
  BoardHost: ({ Board }: { Board: ComponentType<BoardProps<null, null>> }) => (
    <Board state={null} connected subscribeNotices={() => () => {}} />
  ),
}))

const Full = () => <p>full layout</p>
const Compact = () => <p>compact layout</p>

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Board page ?layout=', () => {
  beforeEach(() => {
    registerBuiltinSports()
    boardRegistry.register('football', {
      layouts: [
        { id: 'full', label: 'Full', Board: Full },
        { id: 'compact', label: 'Compact', Board: Compact },
      ],
      defaultId: 'full',
    })
  })

  it('shows the layout asked for', () => {
    renderAt('/match/football/board?layout=compact')
    expect(screen.getByText('compact layout')).toBeInTheDocument()
  })

  it('shows the default layout without a param', () => {
    renderAt('/match/football/board')
    expect(screen.getByText('full layout')).toBeInTheDocument()
  })

  it('falls back to the default for an unknown layout', () => {
    renderAt('/match/football/board?layout=neon')
    expect(screen.getByText('full layout')).toBeInTheDocument()
    expect(screen.queryByText('compact layout')).toBeNull()
  })
})
