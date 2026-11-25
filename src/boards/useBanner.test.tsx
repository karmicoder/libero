import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BANNER_HOLD_MS,
  bannerEnterDelayMs,
  bannerEnterMs,
  bannerExitMs,
  bannerFlipMs,
  bannerVisibleMs,
} from './banner'
import { useBanner } from './useBanner'

// The motion durations come from the tokens (see src/test/setup.ts).
const BANNER_ENTER_DELAY_MS = bannerEnterDelayMs()
const BANNER_ENTER_MS = bannerEnterMs()
const BANNER_EXIT_MS = bannerExitMs()
const BANNER_FLIP_HALF_MS = bannerFlipMs()
const BANNER_VISIBLE_MS = bannerVisibleMs()

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
    expect(result.current).toMatchObject({ notice: { id: 1 }, phase: 'in' })

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

  it('waits for the exit as long as the exit token says', () => {
    // Retuning the token must retune the timer with it.
    document.documentElement.style.setProperty('--motion-board-exit', '200ms')
    try {
      const f = feed()
      const { result } = renderHook(() => useBanner(f.subscribe))
      f.push({ id: 1 })
      act(() => void vi.advanceTimersByTime(bannerVisibleMs()))
      expect(result.current?.phase).toBe('out')
      act(() => void vi.advanceTimersByTime(199))
      expect(result.current).not.toBeNull()
      act(() => void vi.advanceTimersByTime(1))
      expect(result.current).toBeNull()
    } finally {
      document.documentElement.style.removeProperty('--motion-board-exit')
    }
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
    expect(result.current).toMatchObject({ notice: { id: 2 }, phase: 'in' })

    // The first notice's timer would have fired by now; it must not.
    act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS - 1))
    expect(result.current).toMatchObject({ notice: { id: 2 }, phase: 'in' })
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
    expect(result.current).toMatchObject({ notice: { id: 2 }, phase: 'in' })
    // The old exit timer must not remove the new banner.
    act(() => void vi.advanceTimersByTime(BANNER_EXIT_MS))
    expect(result.current?.notice).toEqual({ id: 2 })
  })

  describe('follow-up', () => {
    // Notice 10 is followed by 11, which is followed by nothing.
    const followUp = (n: Notice): Notice | undefined =>
      n.id === 10 ? { id: 11 } : undefined

    it('flips to the follow-up when the first page has held, then holds and leaves as usual', () => {
      const f = feed()
      const { result } = renderHook(() => useBanner(f.subscribe, followUp))

      f.push({ id: 10 })
      const card = result.current?.key
      act(
        () =>
          void vi.advanceTimersByTime(
            BANNER_VISIBLE_MS + BANNER_FLIP_HALF_MS - 1,
          ),
      )
      // Turning edge-on, still the first page.
      expect(result.current).toMatchObject({ notice: { id: 10 }, flip: 'out' })
      act(() => void vi.advanceTimersByTime(1))
      // The same card, now showing the follow-up.
      expect(result.current).toMatchObject({
        notice: { id: 11 },
        phase: 'in',
        flip: 'in',
        key: card,
      })

      act(
        () => void vi.advanceTimersByTime(BANNER_FLIP_HALF_MS + BANNER_HOLD_MS),
      )
      expect(result.current?.phase).toBe('out')
      act(() => void vi.advanceTimersByTime(BANNER_EXIT_MS))
      expect(result.current).toBeNull()
    })

    it('holds every page face-on for the same time, across three pages', () => {
      // 10 → 11 → 12, as 7+ substitution pairs page through.
      const chain = (n: Notice): Notice | undefined =>
        n.id < 12 ? { id: n.id + 1 } : undefined
      const f = feed()
      const { result } = renderHook(() => useBanner(f.subscribe, chain))

      /** Advances to just before `ms`, checks `before`, then to `ms`. */
      const boundary = (ms: number, before: object, at: object) => {
        act(() => void vi.advanceTimersByTime(ms - 1))
        expect(result.current).toMatchObject(before)
        act(() => void vi.advanceTimersByTime(1))
        expect(result.current).toMatchObject(at)
      }
      const leadInAndHold = BANNER_ENTER_DELAY_MS + BANNER_ENTER_MS
      const flipInAndHold = BANNER_FLIP_HALF_MS + BANNER_HOLD_MS

      f.push({ id: 10 })
      // The first page slides in, then holds.
      boundary(
        leadInAndHold + BANNER_HOLD_MS,
        { notice: { id: 10 }, phase: 'in' },
        { notice: { id: 10 }, flip: 'out' },
      )
      boundary(
        BANNER_FLIP_HALF_MS,
        { notice: { id: 10 } },
        { notice: { id: 11 } },
      )
      // Each later page flips in, then holds just as long.
      boundary(
        flipInAndHold,
        { notice: { id: 11 }, flip: 'in' },
        { notice: { id: 11 }, flip: 'out' },
      )
      boundary(
        BANNER_FLIP_HALF_MS,
        { notice: { id: 11 } },
        { notice: { id: 12 } },
      )
      boundary(
        flipInAndHold,
        { notice: { id: 12 }, phase: 'in' },
        { notice: { id: 12 }, phase: 'out' },
      )
    })

    it('starts the flip a half-turn before the swap', () => {
      const f = feed()
      const { result } = renderHook(() => useBanner(f.subscribe, followUp))
      f.push({ id: 10 })
      act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS - 1))
      expect(result.current?.flip).toBeUndefined()
      act(() => void vi.advanceTimersByTime(1))
      expect(result.current).toMatchObject({ notice: { id: 10 }, flip: 'out' })
      act(() => void vi.advanceTimersByTime(BANNER_FLIP_HALF_MS))
      expect(result.current?.notice).toEqual({ id: 11 })
    })

    it('is cancelled by a newer notice', () => {
      const f = feed()
      const { result } = renderHook(() => useBanner(f.subscribe, followUp))
      f.push({ id: 10 })
      act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS - 100))
      f.push({ id: 1 })
      act(() => void vi.advanceTimersByTime(BANNER_VISIBLE_MS - 1))
      expect(result.current?.notice).toEqual({ id: 1 })
      expect(result.current?.flip).toBeUndefined()
    })
  })

  describe('per-sport timing', () => {
    const timing = { holdMs: 2_000 }

    it('holds for the sport hold time instead of the default', () => {
      const f = feed()
      const { result } = renderHook(() =>
        useBanner(f.subscribe, undefined, timing),
      )
      f.push({ id: 1 })
      const visible = bannerVisibleMs(timing.holdMs)
      expect(visible).toBeLessThan(BANNER_VISIBLE_MS)
      act(() => void vi.advanceTimersByTime(visible - 1))
      expect(result.current?.phase).toBe('in')
      act(() => void vi.advanceTimersByTime(1))
      expect(result.current?.phase).toBe('out')
    })

    it('holds each follow-up page for the sport hold time', () => {
      const f = feed()
      const followUp = (n: Notice): Notice | undefined =>
        n.id === 10 ? { id: 11 } : undefined
      const { result } = renderHook(() =>
        useBanner(f.subscribe, followUp, timing),
      )
      f.push({ id: 10 })
      act(
        () =>
          void vi.advanceTimersByTime(
            bannerVisibleMs(timing.holdMs) + BANNER_FLIP_HALF_MS,
          ),
      )
      expect(result.current?.notice).toEqual({ id: 11 })
      act(
        () =>
          void vi.advanceTimersByTime(BANNER_FLIP_HALF_MS + timing.holdMs - 1),
      )
      expect(result.current?.phase).toBe('in')
      act(() => void vi.advanceTimersByTime(1))
      expect(result.current?.phase).toBe('out')
    })

    it('keeps a banner showing when the board passes a fresh timing object', () => {
      const f = feed()
      const { result, rerender } = renderHook(() =>
        useBanner(f.subscribe, undefined, { holdMs: 2_000 }),
      )
      f.push({ id: 1 })
      rerender()
      expect(f.count()).toBe(1)
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
