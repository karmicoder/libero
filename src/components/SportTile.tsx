import type { SportDefinition } from '../sports/types'
import styles from './SportTile.module.css'

interface SportTileProps {
  sport: SportDefinition
  checked: boolean
  onSelect: () => void
}

/** One choice in the sport radio group. The native radio stays in the DOM for
 *  keyboard and screen readers; the whole tile is its visual. */
export function SportTile({ sport, checked, onSelect }: SportTileProps) {
  const ready = sport.status === 'ready'
  return (
    <label className={styles.tile}>
      <input
        type="radio"
        name="sport"
        value={sport.id}
        checked={checked}
        disabled={!ready}
        onChange={onSelect}
      />
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={sport.iconPath} />
      </svg>
      <span className={styles.name}>{sport.name}</span>
      <span className={`eyebrow ${styles.status}`}>
        {ready ? 'Ready' : 'Coming soon'}
      </span>
    </label>
  )
}
