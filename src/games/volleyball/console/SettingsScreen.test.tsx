import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defaultVolleyballConfig } from '../config'
import type { VolleyballConfig } from '../state'
import { SettingsScreen } from './SettingsScreen'

function setup(config: VolleyballConfig = defaultVolleyballConfig()) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<SettingsScreen config={config} onSave={onSave} onCancel={onCancel} />)
  const saved = (): VolleyballConfig => onSave.mock.calls.at(-1)![0]
  return { onSave, onCancel, saved, user: userEvent.setup() }
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const field = (name: string) =>
  screen.getByRole('spinbutton', { name: new RegExp(`^${name}`) })

describe('volleyball SettingsScreen', () => {
  it('shows the current config', () => {
    setup({ ...defaultVolleyballConfig(), cap: 30 })
    expect(field('Sets to win')).toHaveValue(3)
    expect(field('Points per set')).toHaveValue(25)
    expect(field('Decider points')).toHaveValue(15)
    expect(field('Win by')).toHaveValue(2)
    expect(screen.getByRole('switch', { name: /Cap/ })).toBeChecked()
    expect(field('Cap')).toHaveValue(30)
  })

  it('saves edited values', async () => {
    const { user, saved } = setup()
    await user.clear(field('Sets to win'))
    await user.type(field('Sets to win'), '2')
    await user.clear(field('Points per set'))
    await user.type(field('Points per set'), '21')
    await user.click(button('Save'))
    expect(saved()).toEqual({
      setsToWin: 2,
      pointsPerSet: 21,
      deciderPoints: 15,
      winBy: 2,
    })
  })

  it('warns about an invalid field and blocks Save', async () => {
    const { user, onSave } = setup()
    await user.clear(field('Win by'))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Win by must be a whole number of at least 1.',
    )
    expect(field('Win by')).toBeInvalid()
    expect(button('Save')).toBeDisabled()
    await user.type(field('Win by'), '1')
    expect(button('Save')).toBeEnabled()
    await user.click(button('Save'))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('rejects a fractional value', async () => {
    const { user } = setup()
    await user.clear(field('Points per set'))
    await user.type(field('Points per set'), '2.5')
    expect(button('Save')).toBeDisabled()
  })

  describe('cap', () => {
    it('is off by default and its field disabled', () => {
      setup()
      expect(screen.getByRole('switch', { name: /Cap/ })).not.toBeChecked()
      expect(field('Cap')).toBeDisabled()
    })

    it('turns on with a suggestion above the targets and saves it', async () => {
      const { user, saved } = setup()
      await user.click(screen.getByRole('switch', { name: /Cap/ }))
      expect(field('Cap')).toHaveValue(35)
      await user.click(button('Save'))
      expect(saved().cap).toBe(35)
    })

    it('warns when smaller than the larger target', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('switch', { name: /Cap/ }))
      await user.clear(field('Cap'))
      await user.type(field('Cap'), '20')
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The cap must be a whole number no smaller than the larger set target.',
      )
      expect(button('Save')).toBeDisabled()
    })

    it('turning it off drops it from the saved config', async () => {
      const { user, saved } = setup({ ...defaultVolleyballConfig(), cap: 30 })
      await user.click(screen.getByRole('switch', { name: /Cap/ }))
      await user.click(button('Save'))
      expect(saved()).not.toHaveProperty('cap')
    })
  })

  it('resets the form to defaults without saving', async () => {
    const { user, onSave, saved } = setup({
      setsToWin: 2,
      pointsPerSet: 21,
      deciderPoints: 15,
      winBy: 1,
      cap: 30,
    })
    await user.click(button('Reset to defaults'))
    expect(onSave).not.toHaveBeenCalled()
    expect(field('Sets to win')).toHaveValue(3)
    expect(field('Cap')).toBeDisabled()
    await user.click(button('Save'))
    expect(saved()).toEqual(defaultVolleyballConfig())
  })

  it('cancels with the button and with Esc', async () => {
    const { user, onCancel } = setup()
    await user.click(button('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await user.click(field('Win by'))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
