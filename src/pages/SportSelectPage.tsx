import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SportTile } from '../components/SportTile'
import { useSports } from '../sports/useSports'
import styles from './SportSelectPage.module.css'

export function SportSelectPage() {
  const sports = useSports()
  const navigate = useNavigate()
  const [chosenId, setChosenId] = useState<string>()

  // Until the user chooses, default to the first sport that can start a match.
  const selected =
    sports.find((s) => s.id === chosenId && s.status === 'ready') ??
    sports.find((s) => s.status === 'ready')

  const start = selected ? () => navigate(`/match/${selected.id}`) : undefined

  return (
    <>
      <div className="page">
        <h1>Choose a sport</h1>
        <p className="eyebrow">Pick a scoreboard to start a match</p>
        <fieldset className={styles.grid}>
          <legend className="visually-hidden">Sport</legend>
          {sports.map((sport) => (
            <SportTile
              key={sport.id}
              sport={sport}
              checked={selected?.id === sport.id}
              onSelect={() => setChosenId(sport.id)}
            />
          ))}
        </fieldset>
      </div>
      <footer className={styles.footer}>
        <div>
          <span className="eyebrow">Selected</span>
          <output className={styles.selectedName} aria-label="Selected sport">
            {selected?.name ?? 'None'}
          </output>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!start}
          onClick={start}
        >
          Start match
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
          </svg>
        </button>
      </footer>
    </>
  )
}
