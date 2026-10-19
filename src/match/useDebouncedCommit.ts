import { useCallback, useEffect, useRef, useState } from 'react'

export interface DebouncedCommit<T> {
  /** What to show: the pending value if there is one, else the committed one. */
  value: T
  /** True while `value` has not been committed yet. */
  pending: boolean
  /** Edit the value; commits once it has been left alone for `delayMs`. */
  set: (next: T) => void
  /** Commit any pending value now. No-op when nothing is pending. */
  flush: () => void
}

/**
 * Local editing of a value that is committed (dispatched, persisted,
 * broadcast) only after it has settled. For "adjust a number with repeated
 * presses" controls; discrete events must be dispatched immediately instead.
 *
 * - Every `set` restarts the timer; setting back to the committed value
 *   cancels it and commits nothing.
 * - A pending value is flushed on unmount and when the page is hidden.
 *   Callers flush on Enter / blur and before dependent dispatches.
 * - If the committed `value` changes underneath (takeover, undo, period
 *   change), the pending value is dropped.
 *
 * The timer only paces the UI; it never feeds the game clock.
 */
export function useDebouncedCommit<T>(
  committed: T,
  commit: (value: T) => void,
  { delayMs = 1000 }: { delayMs?: number } = {},
): DebouncedCommit<T> {
  const [draft, setDraft] = useState<{ value: T } | null>(null)

  // Refs let the timer and page listeners see the latest values without
  // re-subscribing on every render.
  const draftRef = useRef(draft)
  const commitRef = useRef(commit)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    commitRef.current = commit
  })

  const clearTimer = () => {
    clearTimeout(timer.current)
    timer.current = undefined
  }

  const update = (next: { value: T } | null) => {
    draftRef.current = next
    setDraft(next)
  }

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
    const pending = draftRef.current
    if (!pending) return
    draftRef.current = null
    setDraft(null)
    commitRef.current(pending.value)
  }, [])

  const set = (next: T) => {
    clearTimer()
    if (Object.is(next, committed)) {
      update(null)
      return
    }
    update({ value: next })
    timer.current = setTimeout(flush, delayMs)
  }

  // External change: drop the pending value and show the new state.
  const seen = useRef(committed)
  useEffect(() => {
    if (Object.is(seen.current, committed)) return
    seen.current = committed
    clearTimer()
    draftRef.current = null
    setDraft(null)
  }, [committed])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  return {
    value: draft ? draft.value : committed,
    pending: draft !== null,
    set,
    flush,
  }
}
