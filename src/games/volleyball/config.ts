import type { VolleyballConfig } from './state'

/** Indoor defaults. A fresh object each call so callers can't share mutations. */
export function defaultVolleyballConfig(): VolleyballConfig {
  return { setsToWin: 3, pointsPerSet: 25, deciderPoints: 15, winBy: 2 }
}

/** Why a config can't be saved: the only rules that protect state validity. */
export type ConfigProblem =
  'sets-to-win' | 'points-per-set' | 'decider-points' | 'win-by' | 'cap'

export const CONFIG_PROBLEM_MESSAGES: Record<ConfigProblem, string> = {
  'sets-to-win': 'Sets to win must be a whole number of at least 1.',
  'points-per-set': 'Points per set must be a whole number of at least 1.',
  'decider-points': 'Decider points must be a whole number of at least 1.',
  'win-by': 'Win by must be a whole number of at least 1.',
  cap: 'The cap must be a whole number no smaller than the larger set target.',
}

const isCount = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1

/** Problems that would leave the match in an invalid state. */
export function configProblems(config: VolleyballConfig): ConfigProblem[] {
  const problems: ConfigProblem[] = []
  if (!isCount(config.setsToWin)) problems.push('sets-to-win')
  if (!isCount(config.pointsPerSet)) problems.push('points-per-set')
  if (!isCount(config.deciderPoints)) problems.push('decider-points')
  if (!isCount(config.winBy)) problems.push('win-by')
  if (
    config.cap !== undefined &&
    (!isCount(config.cap) ||
      config.cap < Math.max(config.pointsPerSet, config.deciderPoints))
  ) {
    problems.push('cap')
  }
  return problems
}
