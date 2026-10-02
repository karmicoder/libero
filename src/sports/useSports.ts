import { useSyncExternalStore } from 'react'
import { sportRegistry, type SportRegistry } from './registry'

export function useSports(registry: SportRegistry = sportRegistry) {
  return useSyncExternalStore(registry.subscribe, registry.list)
}
