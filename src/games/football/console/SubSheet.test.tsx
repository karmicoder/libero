import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SubSheet } from './SubSheet'

function setup(remaining: number | undefined) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <SubSheet
      teamName="United"
      remaining={remaining}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel, user: userEvent.setup() }
}

const key = (name: string | RegExp) => screen.getByRole('button', { name })
const confirm = () => key(/^Confirm/)

describe('SubSheet', () => {
  it('tabs from the Off field to the On field, then on to Add pair', async () => {
    const { user } = setup(5)
    await user.tab()
    const off = screen.getByRole('button', { name: /^Off/ })
    expect(off).toHaveFocus()
    await user.keyboard('4')
    await user.tab()
    expect(screen.getByRole('button', { name: /^On/ })).toHaveFocus()
    // Next is disabled once On is the active field.
    await user.tab()
    expect(key(/^\+ Add pair/)).toHaveFocus()
  })

  it('keeps focus on the On field after pressing it with the keyboard', async () => {
    const { user } = setup(5)
    await user.tab()
    await user.tab()
    await user.keyboard('{Enter}')
    const on = screen.getByRole('button', { name: /^On/ })
    expect(on).toHaveAttribute('aria-pressed', 'true')
    expect(on).toHaveFocus()
    await user.keyboard('7')
    expect(on).toHaveTextContent('7')
    await user.tab()
    expect(key('Next ›')).toBeDisabled()
    expect(key(/^\+ Add pair/)).toHaveFocus()
  })

  it('types into the On field after tabbing to it, without pressing it', async () => {
    const { user } = setup(5)
    await user.tab()
    await user.keyboard('4')
    await user.tab()
    await user.keyboard('7')
    expect(screen.getByRole('button', { name: /^Off/ })).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /^On/ })).toHaveTextContent('7')
  })

  it('moves focus to the On field after Next, so Tab carries on from there', async () => {
    const { user } = setup(5)
    await user.keyboard('4{Enter}')
    const on = screen.getByRole('button', { name: /^On/ })
    expect(on).toHaveAttribute('aria-pressed', 'true')
    expect(on).toHaveFocus()
    await user.keyboard('7')
    expect(on).toHaveTextContent('7')
    await user.tab()
    expect(key(/^\+ Add pair/)).toHaveFocus()
  })

  it('moves focus back to the Off field after adding a pair', async () => {
    const { user } = setup(5)
    await user.keyboard('4{Enter}7{Enter}')
    expect(screen.getByRole('button', { name: /^Off/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /^On/ })).toHaveFocus()
  })

  it('selects a field by clicking it, and digits still type into it', async () => {
    const { user } = setup(5)
    const on = screen.getByRole('button', { name: /^On/ })
    await user.click(on)
    expect(on).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Off/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await user.keyboard('7')
    expect(on).toHaveTextContent('7')
  })

  it('is a labelled dialog that takes focus and names the team', () => {
    setup(5)
    const dialog = screen.getByRole('dialog', { name: 'Make a substitution' })
    expect(dialog).toHaveFocus()
    expect(dialog).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByText('Substitution · United')).toBeInTheDocument()
    expect(screen.getByText('No pairs yet')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('5 left · off first')
    expect(confirm()).toBeDisabled()
  })

  it('confirms a single pair, off first then on', async () => {
    const { user, onConfirm } = setup(5)
    await user.click(key('7'))
    await user.click(key('Next ›'))
    expect(screen.getByRole('status')).toHaveTextContent('5 left · then on')
    await user.click(key('1'))
    await user.click(key('2'))
    expect(confirm()).toHaveTextContent('Confirm 1 substitution')
    await user.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith([{ off: 7, on: 12 }])
  })

  it('queues several pairs and removes one', async () => {
    const { user, onConfirm } = setup(5)
    for (const [off, on] of [
      ['7', '12'],
      ['4', '15'],
      ['9', '20'],
    ]) {
      await user.keyboard(off)
      await user.click(key('Next ›'))
      await user.keyboard(on)
      await user.click(key('+ Add pair'))
    }
    const list = screen.getByRole('list', { name: 'Queued pairs' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(confirm()).toHaveTextContent('Confirm 3 substitutions')
    await user.click(key('Remove pair 2'))
    await user.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith([
      { off: 7, on: 12 },
      { off: 9, on: 20 },
    ])
  })

  it('includes a typed pair that was not added', async () => {
    const { user, onConfirm } = setup(5)
    await user.keyboard('3{Enter}8{Enter}9{Enter}1')
    await user.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith([
      { off: 3, on: 8 },
      { off: 9, on: 1 },
    ])
  })

  describe('over the limit', () => {
    it('warns but still allows confirming', async () => {
      const { user, onConfirm } = setup(1)
      await user.keyboard('3{Enter}8{Enter}')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await user.keyboard('9{Enter}1')
      expect(screen.getByRole('alert')).toHaveTextContent(
        '1 left — this will exceed the limit',
      )
      expect(confirm()).toBeEnabled()
      await user.click(confirm())
      expect(onConfirm).toHaveBeenCalledWith([
        { off: 3, on: 8 },
        { off: 9, on: 1 },
      ])
    })

    it('warns when none are left', async () => {
      const { user } = setup(0)
      await user.click(key('5'))
      expect(screen.getByRole('alert')).toHaveTextContent(
        '0 left — this will exceed the limit',
      )
      expect(confirm()).toBeEnabled()
    })

    it('never warns without a limit', async () => {
      const { user } = setup(undefined)
      expect(screen.getByRole('status')).toHaveTextContent(/^off first$/)
      await user.keyboard('3{Enter}8{Enter}9{Enter}1{Enter}')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('cancels with the button and with Escape', async () => {
    const { user, onCancel } = setup(5)
    await user.click(key('Cancel'))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
