import { useNavigate } from 'react-router'
import { SportTile } from '../components/SportTile'
import { useSports } from '../sports/useSports'
import styles from './SportSelectPage.module.css'

export function SportSelectPage() {
  const sports = useSports()
  const navigate = useNavigate()

  return (
    <div className="page">
      <h1>Choose a sport</h1>
      <p className="eyebrow">Pick a scoreboard to start a match</p>
      <div className={styles.grid}>
        {sports.map((sport) => (
          <SportTile
            key={sport.id}
            sport={sport}
            onSelect={() => navigate(`/match/${sport.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
