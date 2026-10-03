import { useSyncExternalStore } from 'react'

/** Subscribes a component to a `MatchStore`'s current state. */
export function useMatchState<State>(store: {
  subscribe: (listener: () => void) => () => void
  getState: () => State
}): State {
  return useSyncExternalStore(store.subscribe, store.getState)
}
