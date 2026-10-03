import { footballEngine } from '../games/football/engine/football'
import { engineRegistry, type EngineRegistry } from './registry'

export function registerBuiltinEngines(
  registry: EngineRegistry = engineRegistry,
) {
  registry.register('football', footballEngine)
}
