import { findPeriod, nextPlayPeriod, periodOffsetSeconds } from './config'
import type { Clock, FootballState, PeriodConfig } from './state'

/**
 * Exact elapsed match-clock seconds at `now` (epoch ms). Every window derives
 * the time itself, so there are no tick actions. Never stops at period length.
 */
export function clockSeconds(clock: Clock, now: number): number {
  if (clock.runningSince === null) return clock.baseSeconds
  return clock.baseSeconds + Math.max(0, now - clock.runningSince) / 1000
}

/** Whole seconds for display. Floored only here, so stop/start loses no time. */
export function displayedSeconds(clock: Clock, now: number): number {
  return Math.floor(clockSeconds(clock, now))
}

export type ClockControl =
  | { kind: 'start' }
  | { kind: 'resume' }
  | { kind: 'pause' }
  /** In a break: starting moves to `period` (e.g. "START 2ND HALF"). */
  | { kind: 'start-next'; period: PeriodConfig }
  /** Shootout, or a break with nothing to start: the clock can't run. */
  | { kind: 'disabled' }

/** What the primary clock button should do, for the console to label. */
export function clockControl(state: FootballState, now: number): ClockControl {
  const period = findPeriod(state.config, state.periodId)
  if (!period || period.kind === 'shootout') return { kind: 'disabled' }
  if (period.kind === 'break') {
    const next = nextPlayPeriod(state.config, period.id)
    return next ? { kind: 'start-next', period: next } : { kind: 'disabled' }
  }
  if (state.clock.runningSince !== null) return { kind: 'pause' }
  const atPeriodStart =
    clockSeconds(state.clock, now) ===
    periodOffsetSeconds(state.config, period.id)
  return { kind: atPeriodStart ? 'start' : 'resume' }
}
