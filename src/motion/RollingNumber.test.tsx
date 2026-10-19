import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RollingNumber } from './RollingNumber'

const rolling = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-prev]')).map((el) => ({
    prev: el.getAttribute('data-prev'),
    text: el.textContent,
  }))

describe('RollingNumber', () => {
  it('shows the value from a snapshot with nothing animating', () => {
    const { container } = render(<RollingNumber value={11} />)
    expect(container).toHaveTextContent('11')
    expect(rolling(container)).toEqual([])
  })

  it('rolls only the digit that changed', () => {
    const { container, rerender } = render(<RollingNumber value={10} />)
    rerender(<RollingNumber value={11} />)
    expect(container).toHaveTextContent('11')
    expect(rolling(container)).toEqual([{ prev: '0', text: '1' }])
  })

  it('handles the digit count changing (9 to 10)', () => {
    const { container, rerender } = render(<RollingNumber value={9} />)
    rerender(<RollingNumber value={10} />)
    expect(container).toHaveTextContent('10')
    expect(rolling(container)).toEqual([
      { prev: '', text: '1' },
      { prev: '9', text: '0' },
    ])
  })

  it('handles the digit count shrinking (a correction, 10 to 9)', () => {
    const { container, rerender } = render(<RollingNumber value={10} />)
    rerender(<RollingNumber value={9} />)
    expect(container).toHaveTextContent('9')
    expect(rolling(container)).toEqual([
      { prev: '1', text: '' },
      { prev: '0', text: '9' },
    ])
  })

  it('retargets on rapid changes: latest value, one roll, no queue', () => {
    const { container, rerender } = render(<RollingNumber value={1} />)
    rerender(<RollingNumber value={2} />)
    rerender(<RollingNumber value={3} />)
    rerender(<RollingNumber value={4} />)
    // The true value is shown at once, and there is a single roll, from the
    // digit last shown to the newest value, not one per intermediate score.
    expect(container).toHaveTextContent('4')
    expect(rolling(container)).toEqual([{ prev: '3', text: '4' }])
  })

  it('restarts the animation on each change by remounting the digit', () => {
    const { container, rerender } = render(<RollingNumber value={1} />)
    rerender(<RollingNumber value={2} />)
    const first = container.querySelector('[data-prev]')
    rerender(<RollingNumber value={3} />)
    const second = container.querySelector('[data-prev]')
    expect(second).not.toBe(first)
  })

  it('does not restart when re-rendered with the same value', () => {
    const { container, rerender } = render(<RollingNumber value={1} />)
    rerender(<RollingNumber value={2} />)
    const first = container.querySelector('[data-prev]')
    rerender(<RollingNumber value={2} />)
    expect(container.querySelector('[data-prev]')).toBe(first)
  })

  it('keeps the outgoing digit out of the text content', () => {
    const { container, rerender } = render(<RollingNumber value={7} />)
    rerender(<RollingNumber value={8} />)
    expect(container.textContent).toBe('8')
  })
})
