import { FootballConsole } from '../games/football/console/FootballConsole'
import { VolleyballConsole } from '../games/volleyball/console/VolleyballConsole'
import { consoleRegistry, type ConsoleRegistry } from './registry'

export function registerBuiltinConsoles(
  registry: ConsoleRegistry = consoleRegistry,
) {
  registry.register('football', FootballConsole)
  registry.register('volleyball', VolleyballConsole)
}
