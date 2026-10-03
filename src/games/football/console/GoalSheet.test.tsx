import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GoalSheet } from './GoalSheet'

function setup() {
  const onDone = vi.fn()
  const onSkip = vi.fn()
  render(<GoalSheet teamName="United" onDone={onDone} onSkip={onSkip} />)
  return { onDone, onSkip, user: userEvent.setup() }
}

const key = (name: string) => screen.getByRole('button', { name })
const field = (label: 'Scorer' | 'Assist') =>
  screen.getByRole('button', { name: new RegExp(`^${label}`) })

describe('GoalSheet', () => {
  describe('semantics and focus', () => {
    it('is a labelled dialog that takes focus when it opens', () => {
      setup()
      const dialog = screen.getByRole('dialog', {
        name: 'Step 1 of 2 · Scorer',
      })
      expect(dialog).toHaveFocus()
      expect(dialog).toHaveAttribute('aria-modal', 'false')
      expect(screen.getByText('Goal · United')).toBeInTheDocument()
    })

    it('labels every key', () => {
      setup()
      for (const name of [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '0',
        'Backspace',
        'Next ›',
        'Skip details',
      ]) {
        expect(key(name)).toBeInTheDocument()
      }
      expect(screen.getByRole('group', { name: 'Keypad' })).toBeInTheDocument()
    })

    it('marks the current step on its field', () => {
      setup()
      expect(field('Scorer')).toHaveAttribute('aria-current', 'step')
      expect(field('Assist')).not.toHaveAttribute('aria-current')
    })
  })

  describe('entering a number', () => {
    it('shows digits in the current field, two at most', async () => {
      const { user } = setup()
      await user.click(key('4'))
      await user.click(key('2'))
      await user.click(key('7'))
      expect(field('Scorer')).toHaveTextContent('42')
    })

    it('ignores a leading zero but takes a zero after a digit', async () => {
      const { user } = setup()
      await user.click(key('0'))
      expect(field('Scorer')).toHaveTextContent('–')
      await user.click(key('1'))
      await user.click(key('0'))
      expect(field('Scorer')).toHaveTextContent('10')
    })

    it('backspace removes the last digit', async () => {
      const { user } = setup()
      await user.click(key('1'))
      await user.click(key('2'))
      await user.click(key('Backspace'))
      expect(field('Scorer')).toHaveTextContent('1')
      await user.click(key('Backspace'))
      await user.click(key('Backspace'))
      expect(field('Scorer')).toHaveTextContent('–')
    })
  })

  describe('steps', () => {
    it('Next moves to the assist step, which then offers Done and No assist', async () => {
      const { user } = setup()
      await user.click(key('9'))
      await user.click(key('Next ›'))
      expect(
        screen.getByRole('dialog', { name: 'Step 2 of 2 · Assist' }),
      ).toBeInTheDocument()
      expect(field('Assist')).toHaveAttribute('aria-current', 'step')
      expect(key('Done')).toBeInTheDocument()
      expect(key('No assist')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Skip details' })).toBeNull()
    })

    it('tapping a field jumps to its step, keeping what was entered', async () => {
      const { user } = setup()
      await user.click(key('9'))
      await user.click(key('Next ›'))
      await user.click(key('1'))
      await user.click(field('Scorer'))
      expect(
        screen.getByRole('dialog', { name: 'Step 1 of 2 · Scorer' }),
      ).toBeInTheDocument()
      expect(field('Scorer')).toHaveTextContent('9')
      expect(field('Assist')).toHaveTextContent('1')

      await user.click(key('Backspace'))
      await user.click(field('Assist'))
      expect(field('Scorer')).toHaveTextContent('–')
      expect(field('Assist')).toHaveTextContent('1')
    })
  })

  describe('finishing', () => {
    it('Done commits the scorer and the assist', async () => {
      const { user, onDone, onSkip } = setup()
      await user.click(key('9'))
      await user.click(key('Next ›'))
      await user.click(key('1'))
      await user.click(key('0'))
      await user.click(key('Done'))
      expect(onDone).toHaveBeenCalledWith(9, 10)
      expect(onSkip).not.toHaveBeenCalled()
    })

    it('No assist commits the scorer only, dropping any assist typed', async () => {
      const { user, onDone } = setup()
      await user.click(key('9'))
      await user.click(key('Next ›'))
      await user.click(key('4'))
      await user.click(key('No assist'))
      expect(onDone).toHaveBeenCalledWith(9, undefined)
    })

    it('Skip details closes without committing', async () => {
      const { user, onDone, onSkip } = setup()
      await user.click(key('Skip details'))
      expect(onSkip).toHaveBeenCalledTimes(1)
      expect(onDone).not.toHaveBeenCalled()
    })

    it('Done with nothing entered commits no numbers (a dash on the board)', async () => {
      const { user, onDone } = setup()
      await user.click(key('Next ›'))
      await user.click(key('Done'))
      expect(onDone).toHaveBeenCalledWith(undefined, undefined)
    })
  })

  describe('physical keyboard', () => {
    it('types digits and backspaces without clicking keys', async () => {
      const { user } = setup()
      await user.keyboard('42')
      expect(field('Scorer')).toHaveTextContent('42')
      await user.keyboard('{Backspace}')
      expect(field('Scorer')).toHaveTextContent('4')
    })

    it('Enter on the sheet advances, then finishes', async () => {
      const { user, onDone } = setup()
      await user.keyboard('9{Enter}')
      expect(
        screen.getByRole('dialog', { name: 'Step 2 of 2 · Assist' }),
      ).toBeInTheDocument()
      await user.keyboard('1{Enter}')
      expect(onDone).toHaveBeenCalledWith(9, 1)
    })

    it('Escape skips the details', async () => {
      const { user, onSkip, onDone } = setup()
      await user.keyboard('9{Escape}')
      expect(onSkip).toHaveBeenCalledTimes(1)
      expect(onDone).not.toHaveBeenCalled()
    })

    it('Enter on a focused key presses that key, not the sheet action', async () => {
      const { user, onDone } = setup()
      await user.tab()
      expect(field('Scorer')).toHaveFocus()
      await user.keyboard('{Enter}')
      // Pressing the Scorer field again just stays on step 1.
      expect(
        screen.getByRole('dialog', { name: 'Step 1 of 2 · Scorer' }),
      ).toBeInTheDocument()
      expect(onDone).not.toHaveBeenCalled()
    })
  })
})
