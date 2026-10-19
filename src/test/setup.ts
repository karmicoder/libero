/// <reference types="node" />
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach } from 'vitest'

// Vitest does not load CSS, so give code that reads motion tokens at runtime
// (`motionMs`) the real token values, from the one place they are defined. The
// reduced-motion block is a media query, which jsdom does not evaluate.
if (typeof document !== 'undefined') {
  const tokens = document.createElement('style')
  tokens.textContent = readFileSync('src/styles/tokens.css', 'utf8')
  document.head.append(tokens)
}

afterEach(cleanup)
