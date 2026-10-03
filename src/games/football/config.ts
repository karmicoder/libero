import type { MatchConfig, PeriodConfig } from './state'

/** The most added minutes the scorer can announce for a period. */
export const MAX_STOPPAGE_MINUTES = 15

/** Design defaults. A fresh object each call so callers can't share mutations. */
export function defaultMatchConfig(): MatchConfig {
  return {
    periods: [
      {
        id: 'h1',
        name: '1st half',
        abbreviation: '1H',
        lengthMinutes: 45,
        kind: 'play',
      },
      {
        id: 'ht',
        name: 'Half time',
        abbreviation: 'HT',
        lengthMinutes: 15,
        kind: 'break',
      },
      {
        id: 'h2',
        name: '2nd half',
        abbreviation: '2H',
        lengthMinutes: 45,
        kind: 'play',
      },
      {
        id: 'et1',
        name: 'Extra time 1',
        abbreviation: 'ET1',
        lengthMinutes: 15,
        kind: 'play',
      },
      {
        id: 'et2',
        name: 'Extra time 2',
        abbreviation: 'ET2',
        lengthMinutes: 15,
        kind: 'play',
      },
      { id: 'pen', name: 'Penalties', abbreviation: 'PEN', kind: 'shootout' },
    ],
    substitutions: { enabled: true, perPeriod: 5 },
    stoppageTime: { enabled: true },
  }
}

export function findPeriod(
  config: MatchConfig,
  periodId: string,
): PeriodConfig | undefined {
  return config.periods.find((p) => p.id === periodId)
}

/**
 * Where the match clock starts in a period: the summed lengths of the `play`
 * periods before it (breaks and shootouts don't count). 0 for an unknown id.
 */
export function periodOffsetSeconds(
  config: MatchConfig,
  periodId: string,
): number {
  let seconds = 0
  for (const p of config.periods) {
    if (p.id === periodId) return seconds
    if (p.kind === 'play') seconds += (p.lengthMinutes ?? 0) * 60
  }
  return 0
}

/** The first `play` period after `periodId`, if any. */
export function nextPlayPeriod(
  config: MatchConfig,
  periodId: string,
): PeriodConfig | undefined {
  const i = config.periods.findIndex((p) => p.id === periodId)
  if (i === -1) return undefined
  return config.periods.slice(i + 1).find((p) => p.kind === 'play')
}
