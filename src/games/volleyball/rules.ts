import type { SetScore, TeamSide, VolleyballState } from './state'

/** Sets each side has won, derived from the closed sets. */
export function setsWon(state: VolleyballState): SetScore {
  const won: SetScore = { visitor: 0, home: 0 }
  for (const set of state.completed) {
    if (set.visitor > set.home) won.visitor += 1
    else if (set.home > set.visitor) won.home += 1
  }
  return won
}

/** Both sides are one set from winning the match. */
export function isDecider(state: VolleyballState): boolean {
  const won = setsWon(state)
  const last = state.config.setsToWin - 1
  return won.visitor === last && won.home === last
}

/** Points a side needs to take the live set (before win-by). */
export function setTarget(state: VolleyballState): number {
  return isDecider(state)
    ? state.config.deciderPoints
    : state.config.pointsPerSet
}

/**
 * The live set can be closed: the leader has the target and leads by `winBy`,
 * or has reached the cap. Derived, never stored, so corrections, undo and
 * config edits can't leave it stale. It only drives the "End set" prompt.
 */
export function setReady(state: VolleyballState): boolean {
  const { visitor, home } = state.current
  const leader = Math.max(visitor, home)
  const lead = Math.abs(visitor - home)
  const { winBy, cap } = state.config
  if (cap !== undefined && leader >= cap) return lead > 0
  return leader >= setTarget(state) && lead >= winBy
}

/** The side that has won the match, if any. */
export function matchWinner(state: VolleyballState): TeamSide | null {
  const won = setsWon(state)
  const need = state.config.setsToWin
  if (won.visitor >= need && won.visitor > won.home) return 'visitor'
  if (won.home >= need && won.home > won.visitor) return 'home'
  return null
}
