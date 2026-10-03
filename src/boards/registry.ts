import type { ComponentType } from 'react'

/** What every sport's scoreboard receives from the board host. */
export interface BoardProps<State, Notice> {
  /** The last snapshot from the console. */
  state: State
  /** The console has been heard from recently; otherwise `state` is frozen. */
  connected: boolean
  /** Transient engine notices from the console, for update banners. */
  subscribeNotices: (listener: (notice: Notice) => void) => () => void
}

// Stored type-erased; `get` restores the caller's types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBoard = ComponentType<BoardProps<any, any>>

type Listener = () => void

/**
 * Scoreboard components keyed by `sportId`, kept apart from `SportDefinition`
 * (data-only), `EngineRegistry` (rules) and `ConsoleRegistry` (scorer UI).
 */
export class BoardRegistry {
  #boards = new Map<string, AnyBoard>()
  #listeners = new Set<Listener>()

  register = (sportId: string, board: AnyBoard): void => {
    this.#boards.set(sportId, board)
    this.#listeners.forEach((l) => l())
  }

  get = <State, Notice>(
    sportId: string,
  ): ComponentType<BoardProps<State, Notice>> | undefined =>
    this.#boards.get(sportId)

  has = (sportId: string): boolean => this.#boards.has(sportId)

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

export const boardRegistry = new BoardRegistry()
