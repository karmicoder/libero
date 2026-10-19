import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { InHeader } from './HeaderSlot'
import { Layout } from './Layout'

describe('InHeader', () => {
  it('renders into the app header, beside the wordmark', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route
              index
              element={
                <InHeader>
                  <button type="button">Header action</button>
                </InHeader>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('button', { name: 'Header action' }),
    ).toBeInTheDocument()
    expect(within(header).getByRole('img', { name: 'Libero' })).toBeVisible()
  })

  it('renders in place when there is no app header', () => {
    render(
      <InHeader>
        <button type="button">Header action</button>
      </InHeader>,
    )
    expect(
      screen.getByRole('button', { name: 'Header action' }),
    ).toBeInTheDocument()
  })
})
