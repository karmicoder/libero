import type { SportDefinition } from '../sports/types'
import styles from './SportTile.module.css'

interface SportTileProps {
  sport: SportDefinition
  onSelect: () => void
}

/** One sport on the select screen. Activating a ready tile starts the match;
 *  coming-soon tiles are disabled. */
export function SportTile({ sport, onSelect }: SportTileProps) {
  const ready = sport.status === 'ready'
  return (
    <button
      type="button"
      className={styles.tile}
      disabled={!ready}
      onClick={onSelect}
    >
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
    </button>
  )
}
