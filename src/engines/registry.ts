import type { GameEngine } from './types'

type Listener = () => void

// Engines are stored type-erased; `get` restores the caller's types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGameEngine = GameEngine<any, any, any, any>

/**
 * Game engines keyed by `sportId`, kept apart from `SportDefinition` so sport
 * metadata stays data-only. Runtime-injectable like `SportRegistry`.
 */
export class EngineRegistry {
  #engines = new Map<string, AnyGameEngine>()
  #listeners = new Set<Listener>()

  /** Attaches an engine to a sport, replacing any existing one. */
  register = (sportId: string, engine: AnyGameEngine): void => {
    this.#engines.set(sportId, engine)
    this.#listeners.forEach((l) => l())
  }

  unregister = (sportId: string): void => {
    if (!this.#engines.delete(sportId)) return
    this.#listeners.forEach((l) => l())
  }

  /**
   * Looks up a sport's engine. The type parameters are the caller's claim about
   * the engine registered under `sportId`; they are not checked at runtime.
   */
  get = <State, Action, Message, Config = unknown>(
    sportId: string,
  ): GameEngine<State, Action, Message, Config> | undefined =>
    this.#engines.get(sportId)

  has = (sportId: string): boolean => this.#engines.has(sportId)

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

/** App-wide registry. Tests and future features may create their own. */
export const engineRegistry = new EngineRegistry()
