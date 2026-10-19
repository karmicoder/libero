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

/** One way to present a sport's state; chosen per window with `?layout=`. */
export interface BoardLayout {
  id: string
  label: string
  Board: AnyBoard
}

export interface BoardLayouts {
  layouts: BoardLayout[]
  /** The layout used when none is asked for or the id is unknown. */
  defaultId: string
}

type Listener = () => void

/**
 * Scoreboard layouts keyed by `sportId`, kept apart from `SportDefinition`
 * (data-only), `EngineRegistry` (rules) and `ConsoleRegistry` (scorer UI).
 */
export class BoardRegistry {
  #sports = new Map<string, BoardLayouts>()
  #listeners = new Set<Listener>()

  register = (sportId: string, entry: BoardLayouts): void => {
    this.#sports.set(sportId, entry)
    this.#listeners.forEach((l) => l())
  }

  /** The sport's layouts as registered (a stable reference), if any. */
  layouts = (sportId: string): BoardLayouts | undefined =>
    this.#sports.get(sportId)

  has = (sportId: string): boolean => this.#sports.has(sportId)

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

/**
 * The layout asked for, else the sport's default, else its first. Undefined
 * only for an entry with no layouts.
 */
export function resolveLayout(
  entry: BoardLayouts | undefined,
  layoutId?: string | null,
): BoardLayout | undefined {
  if (!entry) return undefined
  const byId = (id?: string | null) =>
    id ? entry.layouts.find((l) => l.id === id) : undefined
  return byId(layoutId) ?? byId(entry.defaultId) ?? entry.layouts[0]
}

export const boardRegistry = new BoardRegistry()
