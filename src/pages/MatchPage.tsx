import { Link, useParams } from 'react-router'
import { useSyncExternalStore } from 'react'
import { engineRegistry } from '../engines/registry'
import { MatchSession } from '../match/MatchSession'
import { useSports } from '../sports/useSports'

/** Placeholder: the real scoreboard/console will replace this. */
export function MatchPage() {
  const { sportId } = useParams()
  const sport = useSports().find((s) => s.id === sportId)
  const hasEngine = useSyncExternalStore(engineRegistry.subscribe, () =>
    sportId ? engineRegistry.has(sportId) : false,
  )

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

  const stub = (
    <div className="page">
      <h1>{sport.name} match</h1>
      <p className="eyebrow">Scoreboard coming soon</p>
      <p>
        <Link to="/">Back to sport selection</Link>
      </p>
    </div>
  )

  // Sports without an engine yet keep the placeholder.
  if (!hasEngine) return stub
  return <MatchSession sportId={sport.id}>{() => stub}</MatchSession>
}
