import { useEffect, useSyncExternalStore } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { boardRegistry } from '../boards/registry'
import { BoardHost } from '../match/BoardHost'
import { useSports } from '../sports/useSports'

/**
 * `?theme=light|dark` overrides the OS preference for this window (handy for
 * a projector or TV). Any other value keeps the default.
 */
function useThemeParam() {
  const [params] = useSearchParams()
  const theme = params.get('theme')
  useEffect(() => {
    if (theme !== 'light' && theme !== 'dark') return
    const root = document.documentElement
    root.dataset.theme = theme
    return () => {
      delete root.dataset.theme
    }
  }, [theme])
}

/** Full-window scoreboard for a sport, opened from the console. */
export function BoardPage() {
  const { sportId = '' } = useParams()
  const sport = useSports().find((s) => s.id === sportId)
  const Board = useSyncExternalStore(boardRegistry.subscribe, () =>
    boardRegistry.get<unknown, unknown>(sportId),
  )
  useThemeParam()

  if (sport?.status !== 'ready' || !Board) {
    return (
      <main className="page">
        <h1>Scoreboard not available</h1>
        <p>
          <Link to="/">Back to sport selection</Link>
        </p>
      </main>
    )
  }

  return (
    <main>
      <BoardHost sportId={sport.id} Board={Board} />
    </main>
  )
}
