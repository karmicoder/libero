import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Wordmark } from './Wordmark'

describe('Wordmark', () => {
  it('is named "Libero" for assistive tech', () => {
    render(<Wordmark />)
    expect(screen.getByRole('img', { name: 'Libero' })).toBeInTheDocument()
  })

  it('hides the visible "IBERO" text so the L is not read twice', () => {
    render(<Wordmark />)
    expect(screen.queryByText('IBERO')).toHaveAttribute('aria-hidden', 'true')
  })

  it('passes a className through for placement', () => {
    render(<Wordmark className="placed" />)
    expect(screen.getByRole('img', { name: 'Libero' })).toHaveClass('placed')
  })
})
