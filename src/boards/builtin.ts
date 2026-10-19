import { FootballBoard } from '../games/football/board/FootballBoard'
import { VolleyballBoard } from '../games/volleyball/board/VolleyballBoard'
import { boardRegistry, type BoardRegistry } from './registry'

export function registerBuiltinBoards(registry: BoardRegistry = boardRegistry) {
  registry.register('football', {
    layouts: [{ id: 'full', label: 'Full', Board: FootballBoard }],
    defaultId: 'full',
  })
  registry.register('volleyball', {
    layouts: [{ id: 'full', label: 'Full', Board: VolleyballBoard }],
    defaultId: 'full',
  })
}
