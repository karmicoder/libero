import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { registerBuiltinSports } from '../sports/builtin'
import { sportRegistry } from '../sports/registry'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Sport selection page', () => {
  beforeEach(() => registerBuiltinSports())
  afterEach(() => sportRegistry.unregister('futsal'))

  it('disables coming-soon sports', () => {
    renderApp()
    expect(screen.getByRole('button', { name: /basketball/i })).toBeDisabled()
  })

  it('starts the match as soon as a ready sport is chosen', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(
      screen.queryByRole('button', { name: /start match/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /volleyball/i }))
    expect(
      screen.getByRole('heading', { name: /volleyball match/i }),
    ).toBeInTheDocument()
  })

  it('does not open a match for a coming-soon sport', () => {
    renderApp('/match/basketball')
    expect(
      screen.getByRole('heading', { name: /sport not available/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/basketball is coming soon/i)).toBeInTheDocument()
  })

  it('starts a match from the keyboard', async () => {
    const user = userEvent.setup()
    renderApp()

    screen.getByRole('button', { name: /football/i }).focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('heading', { name: /football match/i }),
    ).toBeInTheDocument()
  })

  it('shows sports registered at runtime', () => {
    renderApp()
    act(() =>
      sportRegistry.register({
        id: 'futsal',
        name: 'Futsal',
        status: 'ready',
        iconPath: '',
      }),
    )
    expect(screen.getByRole('button', { name: /futsal/i })).toBeEnabled()
  })
})
