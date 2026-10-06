import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MatchEvent } from '../state'
import { CardSheet } from './CardSheet'

const yellowFor17: MatchEvent = {
  id: 'e0',
  type: 'card',
  team: 'home',
  periodId: 'h1',
  clockSeconds: 600,
  color: 'yellow',
  numbers: [17],
}

function setup(events: MatchEvent[] = []) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <CardSheet
      initialTeam="home"
      teamNames={{ visitor: 'Rovers', home: 'United' }}
      events={events}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel, user: userEvent.setup() }
}

const key = (name: string) => screen.getByRole('button', { name })
const confirm = () => key('Confirm')
const hint = () => screen.getByRole('status')

describe('CardSheet', () => {
  it('is a labelled dialog that takes focus and names the team', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Show a card' })
    expect(dialog).toHaveFocus()
    expect(dialog).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByText('Card · United')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Yellow' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Home' })).toBeChecked()
  })

  it('disables Confirm until a number is entered, with a prompt', async () => {
    const { user } = setup()
    expect(confirm()).toBeDisabled()
    expect(hint()).toHaveTextContent('Enter jersey #')
    await user.click(key('7'))
    expect(confirm()).toBeEnabled()
  })

  it('confirms a single yellow', async () => {
    const { user, onConfirm } = setup()
    await user.click(key('7'))
    await user.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith('yellow', 'home', [7])
  })

  it('queues several numbers with removable chips', async () => {
    const { user, onConfirm } = setup()
    await user.click(key('7'))
    await user.click(key('+ Add'))
    await user.click(key('1'))
    await user.click(key('0'))
    await user.click(key('+ Add'))
    await user.click(key('4'))
    await user.click(key('+ Add'))
    const chips = screen.getByRole('list', { name: 'Queued numbers' })
    expect(within(chips).getAllByRole('listitem')).toHaveLength(3)
    expect(hint()).toHaveTextContent('Add more or confirm')
    await user.click(key('Remove #4'))
    await user.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith('yellow', 'home', [7, 10])
  })

  it('includes a typed number that was not added', async () => {
    const { user, onConfirm } = setup()
    await user.click(key('7'))
    await user.click(key('+ Add'))
    await user.click(key('9'))
    await user.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith('yellow', 'home', [7, 9])
  })

  it('sends a red for the chosen team', async () => {
    const { user, onConfirm } = setup()
    await user.click(screen.getByRole('radio', { name: 'Red' }))
    await user.click(screen.getByRole('radio', { name: 'Visitor' }))
    expect(screen.getByText('Card · Rovers')).toBeInTheDocument()
    await user.click(key('5'))
    await user.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith('red', 'visitor', [5])
  })

  describe('second yellow', () => {
    it('hints when the typed number already has a yellow', async () => {
      const { user } = setup([yellowFor17])
      await user.click(key('1'))
      await user.click(key('7'))
      expect(hint()).toHaveTextContent('2nd yellow → RED')
    })

    it('flags a queued second yellow, but not on the other team', async () => {
      const { user } = setup([yellowFor17])
      await user.click(key('1'))
      await user.click(key('7'))
      await user.click(key('+ Add'))
      const chips = screen.getByRole('list', { name: 'Queued numbers' })
      expect(within(chips).getByText('2nd yellow')).toBeInTheDocument()
      await user.click(screen.getByRole('radio', { name: 'Visitor' }))
      expect(within(chips).queryByText('2nd yellow')).not.toBeInTheDocument()
    })

    it('does not flag a red', async () => {
      const { user } = setup([yellowFor17])
      await user.click(screen.getByRole('radio', { name: 'Red' }))
      await user.click(key('1'))
      await user.click(key('7'))
      expect(hint()).toHaveTextContent('Add more or confirm')
    })
  })

  describe('keyboard and cancelling', () => {
    it('types digits, adds with Enter, confirms with Enter', async () => {
      const { user, onConfirm } = setup()
      await user.keyboard('12{Enter}3{Backspace}8{Enter}')
      expect(screen.getByText('#12')).toBeInTheDocument()
      await user.keyboard('{Enter}')
      expect(onConfirm).toHaveBeenCalledWith('yellow', 'home', [12, 8])
    })

    it('cancels with the button and with Escape', async () => {
      const { user, onCancel } = setup()
      await user.click(key('Cancel'))
      await user.keyboard('{Escape}')
      expect(onCancel).toHaveBeenCalledTimes(2)
    })
  })
})
