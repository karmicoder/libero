import { describe, expect, it } from 'vitest'
import { clearBackup, loadBackup, saveBackup } from './storage'

class MemoryStorage implements Storage {
  #data = new Map<string, string>()
  get length() {
    return this.#data.size
  }
  clear = () => this.#data.clear()
  getItem = (k: string) => this.#data.get(k) ?? null
  key = (i: number) => [...this.#data.keys()][i] ?? null
  removeItem = (k: string) => void this.#data.delete(k)
  setItem = (k: string, v: string) => void this.#data.set(k, v)
}

const throwing = (): Storage =>
  new Proxy({} as Storage, {
    get() {
      throw new Error('storage blocked')
    },
  })

const isCount = (v: unknown): v is { n: number } =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as { n?: unknown }).n === 'number'

describe('match backup storage', () => {
  it('round-trips state per sport', () => {
    const storage = new MemoryStorage()
    saveBackup('football', { n: 3 }, storage)
    expect(loadBackup('football', isCount, storage)?.state).toEqual({ n: 3 })
    expect(typeof loadBackup('football', isCount, storage)?.savedAt).toBe(
      'number',
    )
    expect(loadBackup('volleyball', isCount, storage)).toBeNull()
  })

  it('still reads a version 1 backup, with no save time', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'libero:match:football',
      JSON.stringify({ version: 1, state: { n: 2 } }),
    )
    expect(loadBackup('football', isCount, storage)).toEqual({
      state: { n: 2 },
      savedAt: null,
    })
  })

  it('returns null when nothing is stored', () => {
    expect(loadBackup('football', isCount, new MemoryStorage())).toBeNull()
  })

  it('ignores a backup from a different version', () => {
    const storage = new MemoryStorage()
    saveBackup('football', { n: 1 }, storage)
    const key = storage.key(0)!
    storage.setItem(key, JSON.stringify({ version: 999, state: { n: 1 } }))
    expect(loadBackup('football', isCount, storage)).toBeNull()
  })

  it('ignores corrupt JSON and state that fails the guard', () => {
    const storage = new MemoryStorage()
    saveBackup('football', { n: 1 }, storage)
    const key = storage.key(0)!
    storage.setItem(key, '{not json')
    expect(loadBackup('football', isCount, storage)).toBeNull()
    storage.setItem(key, JSON.stringify({ version: 1, state: { n: 'x' } }))
    expect(loadBackup('football', isCount, storage)).toBeNull()
  })

  it('clears a backup', () => {
    const storage = new MemoryStorage()
    saveBackup('football', { n: 1 }, storage)
    clearBackup('football', storage)
    expect(loadBackup('football', isCount, storage)).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    const storage = throwing()
    expect(() => saveBackup('football', { n: 1 }, storage)).not.toThrow()
    expect(loadBackup('football', isCount, storage)).toBeNull()
    expect(() => clearBackup('football', storage)).not.toThrow()
  })
})
