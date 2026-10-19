import { useEffect, useSyncExternalStore } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { boardRegistry, resolveLayout } from '../boards/registry'
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

/**
 * `?layout=<id>` picks one of the sport's layouts for this window. It is
 * presentation only (not in match state or sync), so displays can differ. An
 * unknown or missing id uses the sport's default.
 */
function useLayoutParam() {
  const [params] = useSearchParams()
  return params.get('layout')
}

/** Full-window scoreboard for a sport, opened from the console. */
export function BoardPage() {
  const { sportId = '' } = useParams()
  const sport = useSports().find((s) => s.id === sportId)
  const layouts = useSyncExternalStore(boardRegistry.subscribe, () =>
    boardRegistry.layouts(sportId),
  )
  const layoutId = useLayoutParam()
  const Board = resolveLayout(layouts, layoutId)?.Board
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
