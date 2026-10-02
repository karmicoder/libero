import { Link, useParams } from 'react-router'
import { useSports } from '../sports/useSports'

/** Placeholder: the real scoreboard/console will replace this. */
export function MatchPage() {
  const { sportId } = useParams()
  const sport = useSports().find((s) => s.id === sportId)

  if (sport?.status !== 'ready') {
    return (
      <div className="page">
        <h1>Sport not available</h1>
        <p className="eyebrow">
          {sport ? `${sport.name} is coming soon` : 'That sport does not exist'}
        </p>
        <p>
          <Link to="/">Back to sport selection</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>{sport.name} match</h1>
      <p className="eyebrow">Scoreboard coming soon</p>
      <p>
        <Link to="/">Back to sport selection</Link>
      </p>
    </div>
  )
}
