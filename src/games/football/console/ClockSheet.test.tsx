import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ClockSheet } from './ClockSheet'

function setup(presets = [0, 45 * 60, 90 * 60, 105 * 60], current = 754) {
  const onApply = vi.fn()
  const onCancel = vi.fn()
  render(
    <ClockSheet
      currentSeconds={current}
      presets={presets}
      onApply={onApply}
      onCancel={onCancel}
    />,
  )
  return { onApply, onCancel, user: userEvent.setup() }
}

const key = (name: string) => screen.getByRole('button', { name })
const readout = () => screen.getByLabelText('New clock time')

describe('ClockSheet', () => {
  it('shows the current time until something is entered', () => {
    setup()
    expect(readout()).toHaveTextContent('12:34')
  })

  it('shifts digits in from the right', async () => {
    const { user } = setup()
    await user.click(key('4'))
    expect(readout()).toHaveTextContent('00:04')
    await user.click(key('5'))
    await user.click(key('0'))
    expect(readout()).toHaveTextContent('04:50')
  })

  it('has a 00 key and a backspace', async () => {
    const { user } = setup()
    await user.click(key('4'))
    await user.click(key('5'))
    await user.click(key('00'))
    expect(readout()).toHaveTextContent('45:00')
    await user.click(key('Backspace'))
    expect(readout()).toHaveTextContent('04:50')
  })

  it('takes typed digits from the keyboard', async () => {
    const { onApply, user } = setup()
    await user.keyboard('1030')
    expect(readout()).toHaveTextContent('10:30')
    await user.keyboard('{Backspace}')
    expect(readout()).toHaveTextContent('01:03')
    await user.keyboard('{Enter}')
    expect(onApply).toHaveBeenCalledWith({ minutes: 1, seconds: 3 })
  })

  it('fills the entry from a preset', async () => {
    const { onApply, user } = setup()
    await user.click(key('90:00'))
    expect(readout()).toHaveTextContent('90:00')
    await user.click(key('Apply'))
    expect(onApply).toHaveBeenCalledWith({ minutes: 90, seconds: 0 })
  })

  it('offers presets from a custom config', () => {
    setup([0, 20 * 60, 40 * 60])
    expect(
      screen
        .getAllByRole('button', { name: /^\d\d:\d\d$/ })
        .map((b) => b.textContent),
    ).toEqual(['00:00', '20:00', '40:00'])
  })

  it('clamps seconds to 59', async () => {
    const { onApply, user } = setup()
    await user.keyboard('4575')
    expect(readout()).toHaveTextContent('45:59')
    await user.click(key('Apply'))
    expect(onApply).toHaveBeenCalledWith({ minutes: 45, seconds: 59 })
  })

  it('applies nothing for an empty entry', async () => {
    const { onApply, user } = setup()
    await user.click(key('Apply'))
    expect(onApply).toHaveBeenCalledWith(undefined)
  })

  it('can apply 00:00', async () => {
    const { onApply, user } = setup()
    await user.click(key('0'))
    await user.click(key('Apply'))
    expect(onApply).toHaveBeenCalledWith({ minutes: 0, seconds: 0 })
  })

  it('cancels from the button and from Escape', async () => {
    const { onApply, onCancel, user } = setup()
    await user.click(key('Cancel'))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onApply).not.toHaveBeenCalled()
  })
})
