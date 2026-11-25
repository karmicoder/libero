import { useEffect } from 'react'

export interface UndoHotkeyHandlers {
  onUndo: () => void
  onRedo: () => void
}

/** Which history step a key press asks for, if any. */
export function undoHotkey(e: KeyboardEvent): 'undo' | 'redo' | undefined {
  if (e.altKey) return undefined
  const key = e.key.toLowerCase()
  if (key === 'z' && (e.ctrlKey || e.metaKey)) {
    return e.shiftKey ? 'redo' : 'undo'
  }
  // The Windows convention. Not Cmd+Y: Mac browsers use it for History.
  if (key === 'y' && e.ctrlKey && !e.metaKey && !e.shiftKey) return 'redo'
  return undefined
}

/**
 * Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Not where the keys
 * already mean something: in a text field (the browser's own undo) or while
 * a dialog is open (nothing under it should change).
 */
export function useUndoHotkeys(
  { onUndo, onRedo }: UndoHotkeyHandlers,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      const step = undoHotkey(e)
      if (!step) return
      // Holding the keys must not walk through the whole history.
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        document.querySelector('[role="dialog"]')
      ) {
        return
      }
      e.preventDefault()
      if (step === 'undo') onUndo()
      else onRedo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onUndo, onRedo, enabled])
}
