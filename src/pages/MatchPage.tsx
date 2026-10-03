import { Link, useParams } from 'react-router'
import { useSyncExternalStore } from 'react'
import { consoleRegistry } from '../consoles/registry'
import { engineRegistry } from '../engines/registry'
import { ConsoleHost } from '../match/ConsoleHost'
import { MatchSession } from '../match/MatchSession'
import { useSports } from '../sports/useSports'

export function MatchPage() {
  const { sportId = '' } = useParams()
  const sport = useSports().find((s) => s.id === sportId)
  const hasEngine = useSyncExternalStore(engineRegistry.subscribe, () =>
    engineRegistry.has(sportId),
  )
  const Console = useSyncExternalStore(consoleRegistry.subscribe, () =>
    consoleRegistry.get<unknown, unknown, unknown>(sportId),
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

  // Ready sports without an engine and console yet keep a placeholder.
  if (!hasEngine || !Console) {
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

  return (
    <MatchSession<unknown, unknown, unknown> sportId={sport.id}>
      {(store) => (
        <ConsoleHost sportId={sport.id} store={store} Console={Console} />
      )}
    </MatchSession>
  )
}
