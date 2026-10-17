import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWallClockJump } from './useWallClockJump'

let wall = 0
let mono = 0
const tick = (ms: number, { wallExtra = 0 } = {}) => {
  mono += ms
  wall += ms + wallExtra
  act(() => void vi.advanceTimersByTime(ms))
}

beforeEach(() => {
  wall = 1_700_000_000_000
  mono = 5_000
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const useJump = (active: boolean) =>
  useWallClockJump(
    active,
    () => wall,
    () => mono,
  )

describe('useWallClockJump', () => {
  it('stays quiet while both clocks agree, however late the timers fire', () => {
    const { result } = renderHook(() => useJump(true))
    tick(1_000)
    tick(30_000)
    expect(result.current.jump).toBeNull()
  })

  it('reports a forward jump of the system clock', () => {
    const { result } = renderHook(() => useJump(true))
    tick(1_000, { wallExtra: 3_600_000 })
    expect(result.current.jump).toEqual({ seconds: 3600 })
  })

  it('reports a backward jump as negative', () => {
    const { result } = renderHook(() => useJump(true))
    tick(1_000, { wallExtra: -5_000 })
    expect(result.current.jump).toEqual({ seconds: -5 })
  })

  it('can be dismissed', () => {
    const { result } = renderHook(() => useJump(true))
    tick(1_000, { wallExtra: 10_000 })
    act(() => result.current.dismiss())
    expect(result.current.jump).toBeNull()
  })

  it('does not watch while the clock is stopped', () => {
    const { result } = renderHook(() => useJump(false))
    tick(1_000, { wallExtra: 10_000 })
    expect(result.current.jump).toBeNull()
  })
})
