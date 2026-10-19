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

const baseBlock = tokens.slice(
  tokens.indexOf(':root {'),
  tokens.indexOf('@media (prefers-reduced-motion'),
)
const reducedStart = tokens.indexOf('@media (prefers-reduced-motion')
const reducedBlock = tokens.slice(
  reducedStart,
  tokens.indexOf('@media (prefers-color-scheme', reducedStart),
)

const base = declarations(baseBlock)
const reduced = declarations(reducedBlock)

describe('motion tokens', () => {
  it('handles reduced motion in the tokens, in one place', () => {
    // Every board duration, distance and scale has a reduced-motion value.
    const board = [...base.keys()].filter(
      (name) =>
        /^--motion-(board|distance|scale)-/.test(name) ||
        name.startsWith('--motion-distance') ||
        name.startsWith('--motion-scale'),
    )
    expect(board.length).toBeGreaterThan(0)
    for (const name of board) expect(reduced.has(name), name).toBe(true)
  })

  it('swaps board durations for the reduced fade rather than zeroing them', () => {
    for (const [name, value] of reduced) {
      if (name.startsWith('--motion-board-')) {
        expect(value, name).toBe('var(--motion-reduced-fade)')
      }
    }
    expect(base.get('--motion-reduced-fade')).toBe('200ms')
  })

  it('removes travel and scale under reduced motion', () => {
    expect(reduced.get('--motion-distance-roll')).toBe('0em')
    expect(reduced.get('--motion-scale-pulse')).toBe('1')
    expect(reduced.get('--motion-scale-pop-pip')).toBe('1')
  })

  it('drops console motion under reduced motion', () => {
    expect(reduced.get('--duration-fast')).toBe('0ms')
    expect(reduced.get('--duration-slow')).toBe('0ms')
  })
})
