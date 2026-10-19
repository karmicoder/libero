import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerBuiltinEngines } from '../../../engines/builtin'
import { EngineRegistry } from '../../../engines/registry'
import { MatchStore } from '../../../match/MatchStore'
import { defaultVolleyballConfig } from '../config'
import type {
  VolleyballAction,
  VolleyballConfig,
  VolleyballMessage,
  VolleyballState,
} from '../state'
import { VolleyballConsole } from './VolleyballConsole'

type Store = MatchStore<VolleyballState, VolleyballAction, VolleyballMessage>

const registry = new EngineRegistry()
registerBuiltinEngines(registry)
const engine = registry.get<
  VolleyballState,
  VolleyballAction,
  VolleyballMessage,
  VolleyballConfig
>('volleyball')!

function setup(prepare?: (state: VolleyballState) => VolleyballState) {
  const initial = engine.initialState(defaultVolleyballConfig())
  const store: Store = new MatchStore(
    engine,
    prepare ? prepare(initial) : initial,
  )
  render(
    <MemoryRouter>
      <VolleyballConsole
        store={store}
        boardConnected={false}
        boardPath="/match/volleyball/board"
      />
    </MemoryRouter>,
  )
  return { store }
}

const score = (side: 'Visitor' | 'Home') =>
  screen.getByLabelText(`${side} score`)
const point = (side: 'Visitor' | 'Home') =>
  screen.getByRole('button', { name: `Point for ${side}` })
const minus = (side: 'Visitor' | 'Home') =>
  screen.getByRole('button', { name: `Subtract one from ${side}` })
const serve = (i: number) =>
  screen.getAllByRole('button', { name: /^Serve/ })[i]

describe('VolleyballConsole', () => {
  afterEach(() => vi.useRealTimers())

  describe('scoring', () => {
    it('scores a point for the tapped team at once', async () => {
      const { store } = setup()
      const user = userEvent.setup()
      await user.click(point('Home'))
      await user.click(point('Home'))
      await user.click(point('Visitor'))
      expect(score('Home')).toHaveTextContent('2')
      expect(score('Visitor')).toHaveTextContent('1')
      expect(store.getState().current).toEqual({ visitor: 1, home: 2 })
    })

    it('disables point, serve and −1 once the match is finished', () => {
      setup((s) => ({
        ...s,
        status: 'finished',
        current: { visitor: 3, home: 3 },
        completed: [
          { visitor: 0, home: 25, firstServer: 'home' },
          { visitor: 0, home: 25, firstServer: 'visitor' },
          { visitor: 0, home: 25, firstServer: 'home' },
        ],
      }))
      expect(point('Home')).toBeDisabled()
      expect(point('Visitor')).toBeDisabled()
      expect(serve(0)).toBeDisabled()
      expect(minus('Home')).toBeDisabled()
      expect(screen.getByText(/Match over · Home wins/)).toBeInTheDocument()
    })
  })

  describe('serve', () => {
    it('picks the first server at 0-0, then follows the point', async () => {
      const { store } = setup()
      const user = userEvent.setup()
      // Visitor is the left column; home serves first by default.
      expect(serve(0)).toHaveAttribute('aria-pressed', 'false')
      expect(serve(1)).toHaveAttribute('aria-pressed', 'true')
      expect(serve(0)).toHaveTextContent('Serve first')

      await user.click(serve(0))
      expect(store.getState().serving).toBe('visitor')
      expect(store.getState().firstServer).toBe('visitor')
      expect(serve(0)).toHaveAttribute('aria-pressed', 'true')

      await user.click(point('Home'))
      expect(serve(1)).toHaveAttribute('aria-pressed', 'true')
      expect(serve(1)).toHaveTextContent(/^Serve$/)
      expect(store.getState().firstServer).toBe('visitor')
    })
  })

  describe('−1', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))

    it('shows the lower score at once and commits once after 1s', () => {
      const { store } = setup((s) => ({
        ...s,
        current: { visitor: 0, home: 5 },
      }))
      act(() => minus('Home').click())
      act(() => minus('Home').click())
      expect(score('Home')).toHaveTextContent('3')
      expect(store.getState().current.home).toBe(5)

      act(() => vi.advanceTimersByTime(1000))
      expect(store.getState().current.home).toBe(3)
      expect(store.getState().history).toHaveLength(1)
    })

    it('is disabled at 0', () => {
      setup()
      expect(minus('Home')).toBeDisabled()
    })

    it('commits a pending −1 before a point', async () => {
      const { store } = setup((s) => ({
        ...s,
        current: { visitor: 0, home: 5 },
      }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(minus('Home'))
      await user.click(point('Home'))
      expect(store.getState().current.home).toBe(5)
      expect(store.getState().history?.map((h) => h.label)).toEqual([
        'Score correction for Home',
        'Point for Home',
      ])
    })
  })

  describe('status line', () => {
    it('shows set number, target and sets won', () => {
      setup((s) => ({
        ...s,
        completed: [{ visitor: 25, home: 20, firstServer: 'home' }],
      }))
      expect(
        screen.getByText('Set 2 · First to 25 · Sets 1–0'),
      ).toBeInTheDocument()
    })

    it('tags the decider with its target', () => {
      setup((s) => ({
        ...s,
        completed: [
          { visitor: 25, home: 20, firstServer: 'home' },
          { visitor: 20, home: 25, firstServer: 'visitor' },
          { visitor: 25, home: 20, firstServer: 'home' },
          { visitor: 20, home: 25, firstServer: 'visitor' },
        ],
      }))
      expect(
        screen.getByText('Set 5 · Decider · First to 15 · Sets 2–2'),
      ).toBeInTheDocument()
    })
  })

  describe('undo', () => {
    it('names the last step, undoes it from the button and with Ctrl+Z', async () => {
      const { store } = setup()
      const user = userEvent.setup()
      expect(
        screen.getByRole('button', { name: 'Nothing to undo' }),
      ).toBeDisabled()

      await user.click(point('Home'))
      await user.click(point('Visitor'))
      await user.click(
        screen.getByRole('button', { name: 'Undo · Point for Visitor' }),
      )
      expect(store.getState().current).toEqual({ visitor: 0, home: 1 })
      expect(screen.getByText('Undid point for visitor')).toBeInTheDocument()

      await user.keyboard('{Control>}z{/Control}')
      expect(store.getState().current).toEqual({ visitor: 0, home: 0 })
    })

    it('leaves Ctrl+Z alone in a text field', async () => {
      const { store } = setup()
      const user = userEvent.setup()
      await user.click(point('Home'))
      const input = document.createElement('input')
      document.body.append(input)
      input.focus()
      await user.keyboard('{Control>}z{/Control}')
      expect(store.getState().current.home).toBe(1)
      input.remove()
    })
  })

  it('shows board status and links to the scoreboard', () => {
    setup()
    expect(screen.getByText('No board connected')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open scoreboard' }),
    ).toHaveAttribute('href', '/match/volleyball/board')
  })
})
