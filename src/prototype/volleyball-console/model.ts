// PROTOTYPE (#69): throwaway stub of the #70 state model. Not the real engine.
export type Side = 'visitor' | 'home'
export const other = (s: Side): Side => (s === 'home' ? 'visitor' : 'home')

export interface Score {
  visitor: number
  home: number
}
export interface Closed extends Score {
  firstServer: Side
}
export interface VState {
  completed: Closed[]
  current: Score
  firstServer: Side
  serving: Side
  finished: boolean
  history: Omit<VState, 'history'>[]
  label: string
}

export const SETS_TO_WIN = 3
export const initial = (): VState => ({
  completed: [],
  current: { visitor: 0, home: 0 },
  firstServer: 'home',
  serving: 'home',
  finished: false,
  history: [],
  label: '',
})

export const setsWon = (s: VState): Score => ({
  visitor: s.completed.filter((c) => c.visitor > c.home).length,
  home: s.completed.filter((c) => c.home > c.visitor).length,
})
export const isDecider = (s: VState) => {
  const w = setsWon(s)
  return w.home === SETS_TO_WIN - 1 && w.visitor === SETS_TO_WIN - 1
}
export const target = (s: VState) => (isDecider(s) ? 15 : 25)
export const setReady = (s: VState) => {
  const { visitor, home } = s.current
  const hi = Math.max(visitor, home)
  return hi >= target(s) && Math.abs(visitor - home) >= 2
}
export const leader = (s: VState): Side | null =>
  s.current.visitor === s.current.home
    ? null
    : s.current.visitor > s.current.home
      ? 'visitor'
      : 'home'

export type Action =
  | { type: 'point'; team: Side }
  | { type: 'set-server'; team: Side }
  | { type: 'end-set' }
  | { type: 'adjust'; team: Side; delta: 1 | -1 }
  | { type: 'undo' }
  | { type: 'new-match' }

const snap = (s: VState): Omit<VState, 'history'> => {
  const { history: _h, ...rest } = s
  void _h
  return rest
}

export function reduce(s: VState, a: Action): VState {
  if (a.type === 'new-match') return initial()
  if (a.type === 'undo') {
    const prev = s.history.at(-1)
    return prev ? { ...prev, history: s.history.slice(0, -1) } : s
  }
  if (s.finished) return s
  const push = (label: string, next: Partial<VState>): VState => ({
    ...s,
    ...next,
    label,
    history: [...s.history, { ...snap(s), label }],
  })
  switch (a.type) {
    case 'point':
      return push(`point ${a.team}`, {
        current: { ...s.current, [a.team]: s.current[a.team] + 1 },
        serving: a.team,
      })
    case 'adjust':
      return push(`adjust ${a.team}`, {
        current: {
          ...s.current,
          [a.team]: Math.max(0, s.current[a.team] + a.delta),
        },
      })
    case 'set-server': {
      const zero = s.current.visitor === 0 && s.current.home === 0
      return push('serve change', {
        serving: a.team,
        ...(zero && { firstServer: a.team }),
      })
    }
    case 'end-set': {
      const l = leader(s)
      if (!l) return s
      const completed = [
        ...s.completed,
        { ...s.current, firstServer: s.firstServer },
      ]
      const won = completed.filter((c) =>
        l === 'home' ? c.home > c.visitor : c.visitor > c.home,
      ).length
      if (won >= SETS_TO_WIN) {
        return push('end set', { completed, finished: true })
      }
      const first = other(s.firstServer)
      return push('end set', {
        completed,
        current: { visitor: 0, home: 0 },
        firstServer: first,
        serving: first,
      })
    }
  }
}
