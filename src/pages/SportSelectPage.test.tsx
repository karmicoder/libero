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

  it('selects the first ready sport by default', () => {
    renderApp()
    expect(screen.getByRole('radio', { name: /football/i })).toBeChecked()
    expect(
      screen.getByRole('status', { name: 'Selected sport' }),
    ).toHaveTextContent('Football')
  })

  it('disables coming-soon sports', () => {
    renderApp()
    expect(screen.getByRole('radio', { name: /basketball/i })).toBeDisabled()
  })

  it('changes the selection and starts the match for it', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('radio', { name: /volleyball/i }))
    expect(screen.getByRole('radio', { name: /volleyball/i })).toBeChecked()

    await user.click(screen.getByRole('button', { name: /start match/i }))
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

  it('supports arrow-key selection between ready sports', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('radio', { name: /football/i }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: /volleyball/i })).toBeChecked()
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
    expect(screen.getByRole('radio', { name: /futsal/i })).toBeEnabled()
  })
})
