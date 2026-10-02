import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSports } from '../sports/useSports'

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
        <fieldset className="sport-grid">
          <legend className="visually-hidden">Sport</legend>
          {sports.map((sport) => {
            const ready = sport.status === 'ready'
            return (
              <label key={sport.id} className="tile">
                <input
                  type="radio"
                  name="sport"
                  value={sport.id}
                  checked={selected?.id === sport.id}
                  disabled={!ready}
                  onChange={() => setChosenId(sport.id)}
                />
                <svg
                  className="tile-icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d={sport.iconPath} />
                </svg>
                <span className="tile-name">{sport.name}</span>
                <span className="eyebrow">
                  {ready ? 'Ready' : 'Coming soon'}
                </span>
              </label>
            )
          })}
        </fieldset>
      </div>
      <footer className="app-footer">
        <div>
          <span className="eyebrow">Selected</span>
          <output className="selected-name" aria-label="Selected sport">
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
