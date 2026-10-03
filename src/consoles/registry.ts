import type { ComponentType } from 'react'
import type { MatchStore } from '../match/MatchStore'

/** What every sport's scorer console receives from the match host. */
export interface ConsoleProps<State, Action, Message> {
  store: MatchStore<State, Action, Message>
  /** At least one scoreboard window is connected. */
  boardConnected: boolean
  /** Route of this sport's scoreboard, for the "Open scoreboard" link. */
  boardPath: string
}

// Stored type-erased; `get` restores the caller's types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConsole = ComponentType<ConsoleProps<any, any, any>>

type Listener = () => void

/**
 * Scorer console components keyed by `sportId`, kept apart from
 * `SportDefinition` (data-only) and `EngineRegistry` (rules).
 */
export class ConsoleRegistry {
  #consoles = new Map<string, AnyConsole>()
  #listeners = new Set<Listener>()

  register = (sportId: string, console: AnyConsole): void => {
    this.#consoles.set(sportId, console)
    this.#listeners.forEach((l) => l())
  }

  get = <State, Action, Message>(
    sportId: string,
  ): ComponentType<ConsoleProps<State, Action, Message>> | undefined =>
    this.#consoles.get(sportId)

  has = (sportId: string): boolean => this.#consoles.has(sportId)

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

export const consoleRegistry = new ConsoleRegistry()
