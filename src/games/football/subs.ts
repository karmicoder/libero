import type { FootballState, MatchConfig, MatchEvent, TeamSide } from './state'

/** The per-period substitution limit, or undefined if subs are off or unlimited. */
export function subLimit(config: MatchConfig): number | undefined {
  return config.substitutions.enabled
    ? config.substitutions.perPeriod
    : undefined
}

/** Largest "remaining" a scorer may set by hand (the design's 0-5, or the limit if larger). */
export function maxSubsRemaining(config: MatchConfig): number {
  return Math.max(5, subLimit(config) ?? 0)
}

/** Players substituted by the team in a period: one per pair, not per event. */
export function subsMade(
  events: MatchEvent[],
  team: TeamSide,
  periodId: string,
): number {
  return events.reduce(
    (total, e) =>
      e.type === 'substitution' && e.team === team && e.periodId === periodId
        ? total + e.pairs.length
        : total,
    0,
  )
}

/**
 * True when the team has made more substitutions this period than the limit
 * allows. Substitutions are never blocked; the UI uses this to warn.
 */
export function subsOverLimit(state: FootballState, team: TeamSide): boolean {
  const limit = subLimit(state.config)
  return (
    limit !== undefined && subsMade(state.events, team, state.periodId) > limit
  )
}
