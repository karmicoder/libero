/**
 * Contract for a sport's rules. An engine is a pure, serialisable reducer:
 * the same `(state, action)` always yields the same result, and `State` must
 * survive `JSON.parse(JSON.stringify(state))`. Anything time-dependent (e.g.
 * the current timestamp) arrives inside the action, never from `Date.now()`.
 * The console passes a monotonic reading (`performance.now()`), so a system
 * clock change can't move the game clock; see `ClockTiming`.
 */
export interface GameEngine<State, Action, Message, Config = unknown> {
  initialState(config: Config): State
  /**
   * Type guard for state read back from storage. Persisted state is untrusted
   * (older version, hand-edited, truncated), so restoring requires it.
   */
  isState?(value: unknown): value is State
  reduce(state: State, action: Action): ReduceResult<State, Message>
  /** Present when the state holds a running clock. */
  clockTiming?: ClockTiming<State>
}

/**
 * A running clock is anchored to the monotonic reading (`performance.now()`)
 * of the window that owns it, and that origin differs per document. State
 * therefore never crosses a window boundary raw: the sender `fold`s elapsed
 * time into it, the receiver `anchor`s it to its own reading. Backups are
 * folded too, and restored `pause`d. Pure; `now` is a monotonic millisecond
 * reading in the caller's document.
 */
export interface ClockTiming<State> {
  isRunning(state: State): boolean
  /** Elapsed time folded in, so the state carries no sender-local anchor. */
  fold(state: State, now: number): State
  /** Re-anchors a running clock to this window's `now`. */
  anchor(state: State, now: number): State
  /** Stops the clock at its elapsed time at `now`. */
  pause(state: State, now: number): State
  /**
   * Backups from before clocks were monotonic hold the wall-clock (epoch ms)
   * start of a running clock; null if stopped. Only read to restore those.
   */
  legacyEpochRunningSince?(state: State): number | null
}

export interface ReduceResult<State, Message> {
  state: State
  /**
   * Transient domain notices (e.g. `goal-scored`) describing what this action
   * did. Never persisted or replayed; a missed one only costs a banner.
   */
  messages: Message[]
}
