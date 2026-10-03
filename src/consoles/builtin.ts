import { FootballConsole } from '../games/football/console/FootballConsole'
import { consoleRegistry, type ConsoleRegistry } from './registry'

export function registerBuiltinConsoles(
  registry: ConsoleRegistry = consoleRegistry,
) {
  registry.register('football', FootballConsole)
}
