import { useState } from 'react'
import { setsWon } from '../rules'
import type { ClosedSet, TeamSide, VolleyballState } from '../state'

/** What the board animates, derived from the change between two snapshots. */
export interface BoardTransitions {
  /** Restarts the animations: bumped on every visible change. */
  gen: number
  /** The side that just lost the serve, so its dot can scale out. */
  serveFrom: TeamSide | null
  /** The set that just closed, drawn over the (truthful) reset digits. */
  ghost: ClosedSet | null
  /** Sides whose set pip was just filled. */
  popped: TeamSide[]
}

const STATIC: BoardTransitions = {
  gen: 0,
  serveFrom: null,
  ghost: null,
  popped: [],
}

function diff(
  prev: VolleyballState,
  next: VolleyballState,
  last: BoardTransitions,
): BoardTransitions {
  const closed = next.completed.length > prev.completed.length
  const changed =
    closed ||
    prev.completed.length !== next.completed.length ||
    prev.current.visitor !== next.current.visitor ||
    prev.current.home !== next.current.home ||
    prev.serving !== next.serving ||
    prev.status !== next.status
  // A rename or config edit is not a scoring change: leave the animation be.
  if (!changed) return last

  const before = setsWon(prev)
  const after = setsWon(next)
  const sides: TeamSide[] = ['visitor', 'home']
  return {
    gen: last.gen + 1,
    serveFrom: prev.serving !== next.serving ? prev.serving : null,
    // Any newer change retargets: it drops a running set-win overlay.
    ghost: closed ? (next.completed.at(-1) ?? null) : null,
    popped: sides.filter((side) => after[side] > before[side]),
  }
}

/**
 * The board's state-diffed animation driver (see #71). The first snapshot
 * after mount or reconnect is static, so a snapshot alone is always correct
 * and no animation depends on a notice. Updated during render, like
 * `RollingNumber`, so the first paint already carries the change.
 *
 * Board-local on purpose: a sport with a clock must not treat every state
 * push as an animation trigger.
 */
export function useBoardTransitions(state: VolleyballState): BoardTransitions {
  const [seen, setSeen] = useState({ state, transitions: STATIC })
  if (seen.state === state) return seen.transitions
  const transitions = diff(seen.state, state, seen.transitions)
  setSeen({ state, transitions })
  return transitions
}
