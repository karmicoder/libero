import type { GameEngine } from '../engines/types'

type Listener = () => void

/**
 * A tiny store around an engine's reducer: current state, `dispatch`, and a
 * separate channel for the transient messages each action produces. Messages
 * are never stored or replayed. `onChange` runs after every state change (used
 * for the localStorage backup).
 */
export class MatchStore<State, Action, Message> {
  #state: State
  #engine: GameEngine<State, Action, Message, never>
  #onChange?: (state: State) => void
  #listeners = new Set<Listener>()
  #noticeListeners = new Set<(message: Message) => void>()

  constructor(
    engine: GameEngine<State, Action, Message, never>,
    initial: State,
    onChange?: (state: State) => void,
  ) {
    this.#engine = engine
    this.#state = initial
    this.#onChange = onChange
  }

  getState = (): State => this.#state

  /**
   * Replaces the state wholesale, bypassing the reducer. For adopting state
   * from elsewhere (e.g. the previous console's handover), not for game actions.
   */
  replaceState = (state: State): void => {
    this.#state = state
    this.#onChange?.(state)
    this.#listeners.forEach((l) => l())
  }

  dispatch = (action: Action): void => {
    const { state, messages } = this.#engine.reduce(this.#state, action)
    if (state !== this.#state) {
      this.#state = state
      this.#onChange?.(state)
      this.#listeners.forEach((l) => l())
    }
    messages.forEach((m) => this.#noticeListeners.forEach((l) => l(m)))
  }

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  subscribeNotices = (listener: (message: Message) => void): (() => void) => {
    this.#noticeListeners.add(listener)
    return () => this.#noticeListeners.delete(listener)
  }
}
