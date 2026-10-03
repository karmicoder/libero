import { describe, expect, it, vi } from 'vitest'
import type { GameEngine } from '../engines/types'
import { MatchStore } from './MatchStore'

type State = { n: number }
type Action = { type: 'inc' } | { type: 'noop' }
type Message = { type: 'incremented' }

const counter: GameEngine<State, Action, Message, { start: number }> = {
  initialState: ({ start }) => ({ n: start }),
  reduce: (state, action) =>
    action.type === 'inc'
      ? { state: { n: state.n + 1 }, messages: [{ type: 'incremented' }] }
      : { state, messages: [] },
}

describe('MatchStore', () => {
  it('reduces actions into state and notifies subscribers', () => {
    const store = new MatchStore(counter, { n: 0 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.dispatch({ type: 'inc' })
    expect(store.getState()).toEqual({ n: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not notify when the state is unchanged', () => {
    const store = new MatchStore(counter, { n: 0 })
    const listener = vi.fn()
    const onChange = vi.fn()
    store.subscribe(listener)
    const persisted = new MatchStore(counter, { n: 0 }, onChange)
    persisted.dispatch({ type: 'noop' })
    store.dispatch({ type: 'noop' })
    expect(listener).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('delivers messages to notice subscribers, not as state', () => {
    const store = new MatchStore(counter, { n: 0 })
    const notices = vi.fn()
    store.subscribeNotices(notices)
    store.dispatch({ type: 'inc' })
    expect(notices).toHaveBeenCalledWith({ type: 'incremented' })
    expect(store.getState()).toEqual({ n: 1 })
  })

  it('reports each changed state for persistence', () => {
    const onChange = vi.fn()
    const store = new MatchStore(counter, { n: 0 }, onChange)
    store.dispatch({ type: 'inc' })
    store.dispatch({ type: 'inc' })
    expect(onChange).toHaveBeenLastCalledWith({ n: 2 })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('stops notifying after unsubscribe', () => {
    const store = new MatchStore(counter, { n: 0 })
    const listener = vi.fn()
    store.subscribe(listener)()
    store.dispatch({ type: 'inc' })
    expect(listener).not.toHaveBeenCalled()
  })
})
