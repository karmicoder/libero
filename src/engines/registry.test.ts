import { describe, expect, it, vi } from 'vitest'
import { EngineRegistry } from './registry'
import type { GameEngine } from './types'

type State = { n: number }
type Action = { type: 'inc' }
type Message = { type: 'incremented' }
type Config = { start: number }

const counter: GameEngine<State, Action, Message, Config> = {
  initialState: ({ start }) => ({ n: start }),
  reduce: (state) => ({
    state: { n: state.n + 1 },
    messages: [{ type: 'incremented' }],
  }),
}

describe('EngineRegistry', () => {
  it('looks up an engine by sport id', () => {
    const r = new EngineRegistry()
    expect(r.get('a')).toBeUndefined()
    r.register('a', counter)
    expect(r.has('a')).toBe(true)
    expect(r.get('a')).toBe(counter)
  })

  it('returns a usable typed engine with serialisable state', () => {
    const r = new EngineRegistry()
    r.register('a', counter)
    const engine = r.get<State, Action, Message, Config>('a')!
    const { state, messages } = engine.reduce(
      engine.initialState({ start: 1 }),
      {
        type: 'inc',
      },
    )
    expect(state).toEqual({ n: 2 })
    expect(messages).toEqual([{ type: 'incremented' }])
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })

  it('injects, replaces and removes engines at runtime, notifying subscribers', () => {
    const r = new EngineRegistry()
    const other = { ...counter }
    const listener = vi.fn()
    const unsubscribe = r.subscribe(listener)

    r.register('a', counter)
    r.register('a', other)
    expect(r.get('a')).toBe(other)
    expect(listener).toHaveBeenCalledTimes(2)

    r.unregister('missing')
    expect(listener).toHaveBeenCalledTimes(2)
    r.unregister('a')
    expect(r.has('a')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    r.register('b', counter)
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
