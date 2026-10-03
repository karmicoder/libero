import { FootballBoard } from '../games/football/board/FootballBoard'
import { boardRegistry, type BoardRegistry } from './registry'

export function registerBuiltinBoards(registry: BoardRegistry = boardRegistry) {
  registry.register('football', FootballBoard)
}
