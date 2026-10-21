import styles from './SetPrompt.module.css'

interface Props {
  /** Display name of the side leading the live set; undefined when tied. */
  leader?: string
  /** 1-based number of the live set. */
  setNumber: number
  /** The leader has met the set target: ask rather than offer. */
  ready: boolean
  /** Display name of the match winner once the match is finished. */
  matchWinner?: string
  onEndSet: () => void
}

/**
 * Below the columns, the operator confirms a set end. At the threshold it
 * asks; before it, any non-tied score can end the set early. Once the match
 * is over it names the winner instead.
 */
export function SetPrompt({
  leader,
  setNumber,
  ready,
  matchWinner,
  onEndSet,
}: Props) {
  if (matchWinner !== undefined) {
    return (
      <p className={styles.matchOver} role="status">
        {matchWinner} wins the match
      </p>
    )
  }
  if (leader === undefined) return null
  if (ready) {
    return (
      <section className={styles.prompt} aria-label="End set">
        <p className={styles.question} role="status">
          {leader} has won set {setNumber}?
        </p>
        <button type="button" className="primary" onClick={onEndSet}>
          End set
        </button>
      </section>
    )
  }
  return (
    <div className={styles.early}>
      <button type="button" className={styles.earlyButton} onClick={onEndSet}>
        End set early
      </button>
    </div>
  )
}
