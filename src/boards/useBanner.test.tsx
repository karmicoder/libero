import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BANNER_ENTER_DELAY_MS,
  BANNER_ENTER_MS,
  BANNER_EXIT_MS,
  BANNER_FOLLOW_UP_MS,
  BANNER_HOLD_MS,
  BANNER_VISIBLE_MS,
} from './banner'
import { useBanner } from './useBanner'

type Notice = { id: number }

/** A notice feed the test can push into. */
function feed() {
  const listeners = new Set<(n: Notice) => void>()
  return {
    subscribe: (l: (n: Notice) => void) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    push: (n: Notice) => act(() => listeners.forEach((l) => l(n))),
    count: () => listeners.size,
  }
}

describe('useBanner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('has no banner until a notice arrives', () => {
    const f = feed()
    const { result } = renderHook(() => useBanner(f.subscribe))
    expect(result.current).toBeNull()
  })

  it('shows a notice, holds it, then leaves and is removed on schedule', () => {
    const f = feed()
    const { result } = renderHook(() => useBanner(f.subscribe))

    f.push({ id: 1 })
    expect(result.current).toEqual({ notice: { id: 1 }, phase: 'in' })

    // Still on show just before the hold ends.
    act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS - 1))
    expect(result.current?.phase).toBe('in')

    act(() => void vi.advanceTimersByTime(1))
    expect(result.current?.phase).toBe('out')

    act(() => void vi.advanceTimersByTime(BANNER_EXIT_MS - 1))
    expect(result.current).not.toBeNull()
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBeNull()
  })

  it('stays ~9s after sliding in (300ms delay + 560ms in + 9s)', () => {
    expect(BANNER_VISIBLE_MS).toBe(
      BANNER_ENTER_DELAY_MS + BANNER_ENTER_MS + BANNER_HOLD_MS,
    )
    expect(BANNER_HOLD_MS).toBe(9_000)
  })

  it('replaces the current banner at once, restarting the hold', () => {
    const f = feed()
    const { result } = renderHook(() => useBanner(f.subscribe))

    f.push({ id: 1 })
    act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS - 100))
    f.push({ id: 2 })
    expect(result.current).toEqual({ notice: { id: 2 }, phase: 'in' })

    // The first notice's timer would have fired by now; it must not.
    act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS - 1))
    expect(result.current).toEqual({ notice: { id: 2 }, phase: 'in' })
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current?.phase).toBe('out')
  })

  it('replaces a banner that is leaving', () => {
    const f = feed()
    const { result } = renderHook(() => useBanner(f.subscribe))
    f.push({ id: 1 })
    act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS))
    expect(result.current?.phase).toBe('out')

    f.push({ id: 2 })
    expect(result.current).toEqual({ notice: { id: 2 }, phase: 'in' })
    // The old exit timer must not remove the new banner.
    act(() => void vi.advanceTimersByTime(BANNER_EXIT_MS))
    expect(result.current?.notice).toEqual({ id: 2 })
  })

  describe('follow-up', () => {
    // Notice 10 is followed by 11, which is followed by nothing.
    const followUp = (n: Notice): Notice | undefined =>
      n.id === 10 ? { id: 11 } : undefined

    it('replaces the notice after 4.5s, then holds and leaves as usual', () => {
      expect(BANNER_FOLLOW_UP_MS).toBe(4_500)
      const f = feed()
      const { result } = renderHook(() => useBanner(f.subscribe, followUp))

      f.push({ id: 10 })
      act(() => void vi.advanceTimersByTime(BANNER_FOLLOW_UP_MS - 1))
      expect(result.current).toEqual({ notice: { id: 10 }, phase: 'in' })
      act(() => void vi.advanceTimersByTime(1))
      expect(result.current).toEqual({ notice: { id: 11 }, phase: 'in' })

      act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS))
      expect(result.current?.phase).toBe('out')
      act(() => void vi.advanceTimersByTime(BANNER_EXIT_MS))
      expect(result.current).toBeNull()
    })

    it('is cancelled by a newer notice', () => {
      const f = feed()
      const { result } = renderHook(() => useBanner(f.subscribe, followUp))
      f.push({ id: 10 })
      act(() => void vi.advanceTimersByTime(BANNER_FOLLOW_UP_MS - 100))
      f.push({ id: 1 })
      act(() => void vi.advanceTimersByTime(200))
      expect(result.current?.notice).toEqual({ id: 1 })
    })
  })

  it('unsubscribes and stops its timers on unmount', () => {
    const f = feed()
    const { result, unmount } = renderHook(() => useBanner(f.subscribe))
    f.push({ id: 1 })
    expect(f.count()).toBe(1)
    unmount()
    expect(f.count()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(result.current).not.toBeNull()
  })
})
