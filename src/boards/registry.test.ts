import { describe, expect, it, vi } from 'vitest'
import { BoardRegistry, resolveLayout, type BoardLayouts } from './registry'

const A = () => null
const B = () => null

const entry: BoardLayouts = {
  layouts: [
    { id: 'full', label: 'Full', Board: A },
    { id: 'minimal', label: 'Minimal', Board: B },
  ],
  defaultId: 'full',
}

describe('BoardRegistry', () => {
  it('holds a sport layouts as registered', () => {
    const r = new BoardRegistry()
    expect(r.has('v')).toBe(false)
    expect(r.layouts('v')).toBeUndefined()
    r.register('v', entry)
    expect(r.has('v')).toBe(true)
    expect(r.layouts('v')).toBe(entry)
  })

  it('notifies subscribers on register until they unsubscribe', () => {
    const r = new BoardRegistry()
    const listener = vi.fn()
    const unsubscribe = r.subscribe(listener)
    r.register('v', entry)
    unsubscribe()
    r.register('w', entry)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('resolveLayout', () => {
  it('picks the layout asked for', () => {
    expect(resolveLayout(entry, 'minimal')?.Board).toBe(B)
  })

  it('falls back to the default for a missing or unknown id', () => {
    expect(resolveLayout(entry)?.Board).toBe(A)
    expect(resolveLayout(entry, null)?.Board).toBe(A)
    expect(resolveLayout(entry, 'neon')?.Board).toBe(A)
  })

  it('falls back to the first layout when the default is unknown too', () => {
    expect(resolveLayout({ ...entry, defaultId: 'x' }, 'y')?.Board).toBe(A)
  })

  it('is undefined without an entry', () => {
    expect(resolveLayout(undefined, 'full')).toBeUndefined()
  })
})
