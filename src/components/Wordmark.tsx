import styles from './Wordmark.module.css'

interface WordmarkProps {
  className?: string
}

/** The Libero wordmark: the mark stands in for the "L" of "IBERO". Sized by the
 *  inherited `font-size`, coloured by `color`, and named "Libero" for AT. */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      role="img"
      aria-label="Libero"
      className={[styles.wordmark, className].filter(Boolean).join(' ')}
    >
      <svg className={styles.mark} viewBox="11 11 46 43.5" aria-hidden="true">
        <rect x="12" y="12" width="12" height="40" fill="currentColor" />
        <rect x="12" y="40" width="26" height="12" fill="currentColor" />
        <circle cx="49" cy="46" r="8" fill="var(--brand)" />
      </svg>
      <span aria-hidden="true">IBERO</span>
    </span>
  )
}
