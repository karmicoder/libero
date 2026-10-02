import type { SportDefinition } from './types'

type Listener = () => void

/**
 * Observable collection of sports. Subscribable so UI (via
 * `useSyncExternalStore`) re-renders when a sport is registered at runtime.
 */
export class SportRegistry {
  #sports: readonly SportDefinition[] = []
  #listeners = new Set<Listener>()

  /** Adds a sport, or replaces the one with the same id (keeping its position). */
  register = (sport: SportDefinition): void => {
    const i = this.#sports.findIndex((s) => s.id === sport.id)
    this.#sports =
      i === -1
        ? [...this.#sports, sport]
        : this.#sports.map((s, j) => (j === i ? sport : s))
    this.#listeners.forEach((l) => l())
  }

  unregister = (id: string): void => {
    if (!this.#sports.some((s) => s.id === id)) return
    this.#sports = this.#sports.filter((s) => s.id !== id)
    this.#listeners.forEach((l) => l())
  }

  /** Stable reference between changes, as `useSyncExternalStore` requires. */
  list = (): readonly SportDefinition[] => this.#sports

  get = (id: string): SportDefinition | undefined =>
    this.#sports.find((s) => s.id === id)

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

/** App-wide registry. Tests and future features may create their own. */
export const sportRegistry = new SportRegistry()
