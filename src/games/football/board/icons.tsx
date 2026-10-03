import styles from './UpdateBanner.module.css'

// Material Symbols "sports_soccer" (Apache-2.0), 24x24 viewBox.
const BALL_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 3.3 1.35-.95a8.01 8.01 0 0 1 4.38 3.34l-.39 1.34-1.35.46L13 6.7V5.3zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34a8.103 8.103 0 0 1 4.38-3.34zM7.08 17.11l-1.14.1A7.938 7.938 0 0 1 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34-.78 1.37zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11-.7 1.48zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54L14.27 15zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21z'

/** Icons are named for assistive tech; colour is never the only signal. */
export function BallIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Goal"
      fill="currentColor"
    >
      <path d={BALL_PATH} />
    </svg>
  )
}

const CARD_NAME = {
  yellow: 'Yellow card',
  red: 'Red card',
  second: 'Second yellow',
} as const

export function CardIcon({ kind }: { kind: keyof typeof CARD_NAME }) {
  return (
    <svg
      className={styles.card}
      viewBox="0 0 24 24"
      role="img"
      aria-label={CARD_NAME[kind]}
    >
      {kind === 'second' ? (
        <>
          <rect
            className={styles.cardYellow}
            x="2"
            y="2"
            width="12"
            height="17"
            rx="2"
          />
          <rect
            className={styles.cardRed}
            x="9"
            y="5"
            width="12"
            height="17"
            rx="2"
          />
        </>
      ) : (
        <rect
          className={kind === 'red' ? styles.cardRed : styles.cardYellow}
          x="5"
          y="2"
          width="14"
          height="20"
          rx="2"
        />
      )}
    </svg>
  )
}

export function SubIcon({ direction }: { direction: 'off' | 'on' }) {
  return (
    <svg
      className={direction === 'off' ? styles.subOff : styles.subOn}
      viewBox="0 0 24 24"
      role="img"
      aria-label={direction === 'off' ? 'Off' : 'On'}
      fill="currentColor"
    >
      {direction === 'off' ? (
        <path d="M12 20 4 10h5V4h6v6h5z" />
      ) : (
        <path d="M12 4 20 14h-5v6H9v-6H4z" />
      )}
    </svg>
  )
}
