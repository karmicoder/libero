import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedCommit } from './useDebouncedCommit'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup(initial = 0) {
  const commit = vi.fn()
  const hook = renderHook(({ value }) => useDebouncedCommit(value, commit), {
    initialProps: { value: initial },
  })
  return { commit, ...hook }
}

describe('useDebouncedCommit', () => {
  it('shows the pending value at once and commits the last one after the delay', () => {
    const { result, commit } = setup()
    act(() => result.current.set(1))
    act(() => result.current.set(2))
    act(() => result.current.set(3))
    expect(result.current.value).toBe(3)
    expect(result.current.pending).toBe(true)
    act(() => vi.advanceTimersByTime(999))
    expect(commit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(commit).toHaveBeenCalledExactlyOnceWith(3)
    expect(result.current.pending).toBe(false)
  })

  it('restarts the timer on each change', () => {
    const { result, commit } = setup()
    act(() => result.current.set(1))
    act(() => vi.advanceTimersByTime(800))
    act(() => result.current.set(2))
    act(() => vi.advanceTimersByTime(800))
    expect(commit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(commit).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('honours a custom delay', () => {
    const commit = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedCommit<number>(0, commit, { delayMs: 250 }),
    )
    act(() => result.current.set(1))
    act(() => vi.advanceTimersByTime(250))
    expect(commit).toHaveBeenCalledWith(1)
  })

  it('commits nothing when the value returns to the committed one', () => {
    const { result, commit } = setup(5)
    act(() => result.current.set(6))
    act(() => result.current.set(5))
    expect(result.current.pending).toBe(false)
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).not.toHaveBeenCalled()
  })

  it('flushes immediately on demand', () => {
    const { result, commit } = setup()
    act(() => result.current.set(4))
    act(() => result.current.flush())
    expect(commit).toHaveBeenCalledExactlyOnceWith(4)
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).toHaveBeenCalledOnce()
  })

  it('flush is a no-op with nothing pending', () => {
    const { result, commit } = setup()
    act(() => result.current.flush())
    expect(commit).not.toHaveBeenCalled()
  })

  it('flushes on unmount', () => {
    const { result, commit, unmount } = setup()
    act(() => result.current.set(2))
    unmount()
    expect(commit).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('flushes on pagehide', () => {
    const { result, commit } = setup()
    act(() => result.current.set(2))
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(commit).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('flushes when the page becomes hidden, not when visible', () => {
    const { result, commit } = setup()
    let state: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state)
    act(() => result.current.set(2))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(commit).not.toHaveBeenCalled()
    state = 'hidden'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(commit).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('drops the pending value when the committed one changes underneath', () => {
    const { result, commit, rerender } = setup(1)
    act(() => result.current.set(7))
    rerender({ value: 3 })
    expect(result.current.value).toBe(3)
    expect(result.current.pending).toBe(false)
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).not.toHaveBeenCalled()
  })

  it('does not commit again after its own commit lands', () => {
    const { result, commit, rerender } = setup(0)
    act(() => result.current.set(2))
    act(() => vi.advanceTimersByTime(1000))
    rerender({ value: 2 })
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).toHaveBeenCalledOnce()
    expect(result.current.value).toBe(2)
  })
})
