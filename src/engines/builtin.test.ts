import { describe, expect, it } from 'vitest'
import { SportRegistry } from '../sports/registry'
import { registerBuiltinSports } from '../sports/builtin'
import { registerBuiltinEngines } from './builtin'
import { EngineRegistry } from './registry'

describe('registerBuiltinEngines', () => {
  it('attaches an engine to every ready built-in sport', () => {
    const sports = new SportRegistry()
    const engines = new EngineRegistry()
    registerBuiltinSports(sports)
    registerBuiltinEngines(engines)

    const ready = sports.list().filter((s) => s.status === 'ready')
    expect(ready.map((s) => s.id)).toContain('volleyball')
    for (const sport of ready) expect(engines.has(sport.id)).toBe(true)
  })

  it('gives volleyball a state guard for restoring backups', () => {
    const engines = new EngineRegistry()
    registerBuiltinEngines(engines)
    const engine = engines.get('volleyball')!
    expect(engine.isState?.(engine.initialState(undefined))).toBe(true)
    expect(engine.isState?.({ oops: true })).toBe(false)
  })
})
