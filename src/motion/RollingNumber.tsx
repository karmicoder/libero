import { useState } from 'react'
import styles from './RollingNumber.module.css'

/**
 * A number whose changed digits roll (see docs/design-language.md, Motion).
 *
 * The true value is always the real text, so a view that mounts with a value,
 * or one that never runs the animation, still shows and announces the right
 * thing. The outgoing digit is drawn by CSS from `data-prev`, so it is never in
 * the text content or the accessibility tree.
 *
 * A new value arriving mid-roll retargets: the digits that differ restart from
 * the digit currently shown to the newest value. Nothing is queued.
 */
export function RollingNumber({ value }: { value: number }) {
  const text = String(value)
  // Derived state, updated during render so the first paint already has it.
  const [track, setTrack] = useState({ text, prev: text, gen: 0 })
  if (track.text !== text) {
    setTrack({ text, prev: track.text, gen: track.gen + 1 })
  }

  // Align from the right so 9 -> 10 rolls the units and brings in the tens.
  const length = Math.max(track.text.length, track.prev.length)
  const digits = Array.from({ length }, (_, i) => {
    const place = length - 1 - i
    const current = track.text.charAt(track.text.length - 1 - place)
    const previous = track.prev.charAt(track.prev.length - 1 - place)
    return { place, current, previous, changed: current !== previous }
  })

  return (
    <span className={styles.number}>
      {digits.map(({ place, current, previous, changed }) => (
        <span
          // A new generation remounts the digit, which restarts its animation.
          key={changed ? `${place}:${track.gen}` : `${place}:still`}
          className={changed ? styles.rolling : styles.digit}
          data-prev={changed ? previous : undefined}
        >
          <span className={styles.incoming}>{current}</span>
        </span>
      ))}
    </span>
  )
}
