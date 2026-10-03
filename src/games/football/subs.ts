import type { MatchEvent, TeamSide } from './state'

/** Substitutions the team has made in a period. */
export function subsUsed(
  events: MatchEvent[],
  team: TeamSide,
  periodId: string,
): number {
  return events.filter(
    (e) =>
      e.type === 'substitution' && e.team === team && e.periodId === periodId,
  ).length
}
