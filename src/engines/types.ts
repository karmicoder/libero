/**
 * Contract for a sport's rules. An engine is a pure, serialisable reducer:
 * the same `(state, action)` always yields the same result, and `State` must
 * survive `JSON.parse(JSON.stringify(state))`. Anything time-dependent (e.g.
 * the current timestamp) arrives inside the action, never from `Date.now()`.
 */
export interface GameEngine<State, Action, Message, Config = unknown> {
  initialState(config: Config): State
  /**
   * Type guard for state read back from storage. Persisted state is untrusted
   * (older version, hand-edited, truncated), so restoring requires it.
   */
  isState?(value: unknown): value is State
  reduce(state: State, action: Action): ReduceResult<State, Message>
}

export interface ReduceResult<State, Message> {
  state: State
  /**
   * Transient domain notices (e.g. `goal-scored`) describing what this action
   * did. Never persisted or replayed; a missed one only costs a banner.
   */
  messages: Message[]
}
