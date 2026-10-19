/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read from disk: Vitest's CSS handling returns an empty string for imports.
const tokens = readFileSync('src/styles/tokens.css', 'utf8')

/** Custom properties declared in `block`, as name -> value. */
function declarations(block: string) {
  return new Map(
    Array.from(block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g), (m) => [
      m[1],
      m[2].trim(),
    ]),
  )
}

const reducedStart = tokens.indexOf('@media (prefers-reduced-motion')
const reduced = declarations(
  tokens.slice(
    reducedStart,
    tokens.indexOf('@media (prefers-color-scheme', reducedStart),
  ),
)

describe('motion tokens under reduced motion', () => {
  it('drops console motion', () => {
    expect(reduced.get('--duration-fast')).toBe('0ms')
    expect(reduced.get('--duration-slow')).toBe('0ms')
  })

  it('leaves board motion alone (the board ignores the OS setting)', () => {
    for (const name of reduced.keys()) {
      expect(name, name).not.toMatch(/^--motion-(board|distance|scale)/)
      expect(name, name).not.toMatch(/^--ease-/)
    }
  })
})
