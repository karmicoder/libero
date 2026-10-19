import { footballEngine } from '../games/football/engine/football'
import { volleyballEngine } from '../games/volleyball/engine/volleyball'
import { engineRegistry, type EngineRegistry } from './registry'

export function registerBuiltinEngines(
  registry: EngineRegistry = engineRegistry,
) {
  registry.register('football', footballEngine)
  registry.register('volleyball', volleyballEngine)
}
