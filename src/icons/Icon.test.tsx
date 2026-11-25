import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon'
import { settings } from './paths'

describe('Icon', () => {
  it('is a named image when given a label', () => {
    render(<Icon path={settings} label="Settings" />)
    expect(screen.getByRole('img', { name: 'Settings' })).toBeInTheDocument()
  })

  it('is hidden from assistive tech when decorative', () => {
    const { container } = render(<Icon path={settings} decorative />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('draws the path in the current colour', () => {
    const { container } = render(<Icon path={settings} decorative />)
    expect(container.querySelector('svg')).toHaveAttribute(
      'fill',
      'currentColor',
    )
    expect(container.querySelector('path')).toHaveAttribute('d', settings)
  })

  it('requires exactly one of label or decorative', () => {
    // @ts-expect-error neither a name nor decorative
    void (<Icon path={settings} />)
    // @ts-expect-error both a name and decorative
    void (<Icon path={settings} label="Settings" decorative />)
  })
})
