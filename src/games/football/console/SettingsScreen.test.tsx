import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defaultMatchConfig } from '../config'
import type { MatchConfig } from '../state'
import { SettingsScreen } from './SettingsScreen'

function setup(config: MatchConfig = defaultMatchConfig(), current = 'h1') {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <SettingsScreen
      config={config}
      currentPeriodId={current}
      reservedIds={[]}
      onSave={onSave}
      onCancel={onCancel}
    />,
  )
  const saved = (): MatchConfig => onSave.mock.calls.at(-1)![0]
  return { onSave, onCancel, saved, user: userEvent.setup() }
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const periodRows = () =>
  within(screen.getByRole('list')).getAllByRole('listitem')
const periodNames = () =>
  periodRows().map(
    (row) => (within(row).getByLabelText('Name') as HTMLInputElement).value,
  )

describe('SettingsScreen', () => {
  it('shows the current config', () => {
    setup()
    expect(
      screen.getByRole('switch', { name: 'Track substitutions' }),
    ).toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'Show added time' }),
    ).toBeChecked()
    expect(
      screen.getByRole('status', { name: 'Per period' }),
    ).toHaveTextContent('5')
    expect(periodNames()).toEqual([
      '1st half',
      'Half time',
      '2nd half',
      'Extra time 1',
      'Extra time 2',
      'Penalties',
    ])
  })

  describe('switches', () => {
    it('turns substitutions off, which disables the stepper', async () => {
      const { user, saved } = setup()
      await user.click(
        screen.getByRole('switch', { name: 'Track substitutions' }),
      )
      expect(button('Fewer substitutions')).toBeDisabled()
      expect(button('More substitutions')).toBeDisabled()
      await user.click(button('Save'))
      expect(saved().substitutions.enabled).toBe(false)
    })

    it('turns stoppage time off', async () => {
      const { user, saved } = setup()
      await user.click(screen.getByRole('switch', { name: 'Show added time' }))
      await user.click(button('Save'))
      expect(saved().stoppageTime.enabled).toBe(false)
    })
  })

  describe('substitutions stepper', () => {
    it('stays within 1 to 9', async () => {
      const { user, saved } = setup()
      for (let i = 0; i < 12; i++)
        await user.click(button('More substitutions'))
      expect(button('More substitutions')).toBeDisabled()
      await user.click(button('Save'))
      expect(saved().substitutions.perPeriod).toBe(9)

      for (let i = 0; i < 12; i++)
        await user.click(button('Fewer substitutions'))
      expect(button('Fewer substitutions')).toBeDisabled()
      await user.click(button('Save'))
      expect(saved().substitutions.perPeriod).toBe(1)
    })
  })

  describe('periods', () => {
    it('uppercases and limits the abbreviation to 4 characters', async () => {
      const { user, saved } = setup()
      const abbr = within(periodRows()[0]).getByLabelText('Abbr.')
      await user.clear(abbr)
      await user.type(abbr, 'abcdef')
      expect(abbr).toHaveValue('ABCD')
      await user.click(button('Save'))
      expect(saved().periods[0].abbreviation).toBe('ABCD')
    })

    it('renames a period but keeps its id', async () => {
      const { user, saved } = setup()
      const name = within(periodRows()[0]).getByLabelText('Name')
      await user.clear(name)
      await user.type(name, 'First')
      await user.click(button('Save'))
      expect(saved().periods[0]).toMatchObject({ id: 'h1', name: 'First' })
    })

    it('changes the kind', async () => {
      const { user, saved } = setup()
      await user.selectOptions(
        within(periodRows()[3]).getByLabelText('Kind'),
        'break',
      )
      await user.click(button('Save'))
      expect(saved().periods[3].kind).toBe('break')
    })

    it('moves a period up and down', async () => {
      const { user, saved } = setup()
      await user.click(button('Move 2nd half up'))
      expect(periodNames().slice(0, 3)).toEqual([
        '1st half',
        '2nd half',
        'Half time',
      ])
      await user.click(button('Move 1st half down'))
      expect(periodNames().slice(0, 3)).toEqual([
        '2nd half',
        '1st half',
        'Half time',
      ])
      await user.click(button('Save'))
      expect(
        saved()
          .periods.map((p) => p.id)
          .slice(0, 3),
      ).toEqual(['h2', 'h1', 'ht'])
    })

    it('cannot move the first period up or the last down', () => {
      setup()
      expect(button('Move 1st half up')).toBeDisabled()
      expect(button('Move Penalties down')).toBeDisabled()
    })

    it('adds a period with a fresh id and focuses its name', async () => {
      const { user, saved } = setup()
      await user.click(button('Add period'))
      expect(periodRows()).toHaveLength(7)
      const name = within(periodRows()[6]).getByLabelText('Name')
      expect(name).toHaveFocus()
      await user.click(button('Save'))
      const ids = saved().periods.map((p) => p.id)
      expect(new Set(ids).size).toBe(7)
    })

    it('never reuses an id the match log refers to', async () => {
      const config = defaultMatchConfig()
      config.periods = config.periods.slice(0, 5)
      const onSave = vi.fn()
      render(
        <SettingsScreen
          config={config}
          currentPeriodId="h1"
          reservedIds={['p6']}
          onSave={onSave}
          onCancel={() => {}}
        />,
      )
      await userEvent.click(button('Add period'))
      await userEvent.click(button('Save'))
      expect(onSave.mock.calls[0][0].periods.at(-1).id).not.toBe('p6')
    })

    it('removes a period', async () => {
      const { user, saved } = setup()
      await user.click(button('Remove Penalties'))
      expect(periodRows()).toHaveLength(5)
      await user.click(button('Save'))
      expect(saved().periods.map((p) => p.id)).not.toContain('pen')
    })
  })

  describe('length', () => {
    const open = async (
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) => user.click(button(new RegExp(`^${name} length`)))

    it('sets the length from the keypad', async () => {
      const { user, saved } = setup()
      await open(user, '1st half')
      const keypad = screen.getByRole('dialog')
      expect(within(keypad).getByLabelText('New length')).toHaveTextContent(
        '45 min',
      )
      await user.click(
        within(keypad).getByRole('button', { name: 'Backspace' }),
      )
      await user.click(
        within(keypad).getByRole('button', { name: 'Backspace' }),
      )
      await user.click(within(keypad).getByRole('button', { name: '9' }))
      await user.click(within(keypad).getByRole('button', { name: '0' }))
      await user.click(within(keypad).getByRole('button', { name: 'Apply' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(button(/^1st half length: 90 min/)).toHaveFocus()
      await user.click(button('Save'))
      expect(saved().periods[0].lengthMinutes).toBe(90)
    })

    it('caps the length at 999 minutes', async () => {
      const { user, saved } = setup()
      await open(user, '1st half')
      await user.keyboard('{Backspace}{Backspace}99999{Enter}')
      await user.click(button('Save'))
      expect(saved().periods[0].lengthMinutes).toBe(999)
    })

    it('an empty entry means no timer', async () => {
      const { user, saved } = setup()
      await open(user, '1st half')
      await user.click(screen.getByRole('button', { name: 'No timer' }))
      await user.click(screen.getByRole('button', { name: 'Apply' }))
      expect(button(/^1st half length: No timer/)).toBeInTheDocument()
      await user.click(button('Save'))
      expect(saved().periods[0]).not.toHaveProperty('lengthMinutes')
    })

    it('Esc closes the keypad only, keeping the old length', async () => {
      const { user, onCancel } = setup()
      await open(user, '1st half')
      await user.keyboard('{Backspace}7{Escape}')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onCancel).not.toHaveBeenCalled()
      expect(button(/^1st half length: 45 min/)).toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('blocks removing the current period with a message', async () => {
      const { user } = setup()
      await user.click(button('Remove 1st half'))
      expect(screen.getByRole('alert')).toHaveTextContent(
        "The current period can't be removed",
      )
      expect(periodRows()).toHaveLength(6)
      expect(button('Save')).toBeEnabled()
    })

    it('marks the current period', () => {
      setup(defaultMatchConfig(), 'h2')
      expect(within(periodRows()[2]).getByText('Current')).toBeInTheDocument()
    })

    it('blocks removing the last play period', async () => {
      const config = defaultMatchConfig()
      config.periods = [config.periods[0], config.periods[1]]
      const { user } = setup(config, 'ht')
      await user.click(button('Remove 1st half'))
      expect(screen.getByRole('alert')).toHaveTextContent(
        'At least one period must be a play period',
      )
      expect(periodRows()).toHaveLength(2)
    })

    it('disables Save while no period is a play period', async () => {
      const config = defaultMatchConfig()
      config.periods = [config.periods[0], config.periods[1]]
      const { user } = setup(config, 'ht')
      await user.selectOptions(
        within(periodRows()[0]).getByLabelText('Kind'),
        'break',
      )
      expect(screen.getByRole('alert')).toHaveTextContent(
        'At least one period must be a play period',
      )
      expect(button('Save')).toBeDisabled()
    })
  })

  describe('header', () => {
    it('Reset to defaults resets the form without saving', async () => {
      const { user, onSave } = setup()
      await user.click(button('More substitutions'))
      await user.click(button('Remove Penalties'))
      await user.click(button('Reset to defaults'))
      expect(
        screen.getByRole('status', { name: 'Per period' }),
      ).toHaveTextContent('5')
      expect(periodRows()).toHaveLength(6)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('Cancel discards the edits', async () => {
      const { user, onSave, onCancel } = setup()
      await user.click(button('More substitutions'))
      await user.click(button('Cancel'))
      expect(onCancel).toHaveBeenCalled()
      expect(onSave).not.toHaveBeenCalled()
    })

    it('Esc cancels', async () => {
      const { user, onCancel } = setup()
      await user.keyboard('{Escape}')
      expect(onCancel).toHaveBeenCalled()
    })

    it('Save passes the edited config', async () => {
      const { user, saved } = setup()
      await user.click(button('More substitutions'))
      await user.click(button('Save'))
      expect(saved().substitutions.perPeriod).toBe(6)
    })
  })
})
