import { describe, expect, it, vi } from 'vitest'
import { SportRegistry } from './registry'
import type { SportDefinition } from './types'

const sport = (id: string, name = id): SportDefinition => ({
  id,
  name,
  status: 'ready',
  iconPath: '',
})

describe('SportRegistry', () => {
  it('lists sports in registration order', () => {
    const r = new SportRegistry()
    r.register(sport('a'))
    r.register(sport('b'))
    expect(r.list().map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('replaces a sport with the same id in place', () => {
    const r = new SportRegistry()
    r.register(sport('a', 'Old'))
    r.register(sport('b'))
    r.register(sport('a', 'New'))
    expect(r.list().map((s) => s.name)).toEqual(['New', 'b'])
  })

  it('unregisters a sport, ignoring unknown ids', () => {
    const r = new SportRegistry()
    const listener = vi.fn()
    r.register(sport('a'))
    r.subscribe(listener)

    r.unregister('missing')
    expect(listener).not.toHaveBeenCalled()

    r.unregister('a')
    expect(r.list()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies subscribers and returns a new list reference on change', () => {
    const r = new SportRegistry()
    const listener = vi.fn()
    const before = r.list()
    const unsubscribe = r.subscribe(listener)

    r.register(sport('a'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(r.list()).not.toBe(before)

    unsubscribe()
    r.register(sport('b'))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
