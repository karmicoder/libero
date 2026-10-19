/**
 * Reads a duration token (e.g. `--motion-board-exit`) as milliseconds, for the
 * few timers that must wait for a CSS animation to finish. The token is the
 * single source of truth; this never carries a duration of its own. Returns 0
 * when the token is not defined (e.g. no stylesheet is loaded).
 */
export function motionMs(token: string): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return 0
  return raw.endsWith('ms') ? value : value * 1000
}
