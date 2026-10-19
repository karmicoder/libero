import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSlotContext } from './headerSlotContext'

/** Renders `children` into the app header's slot so a page can share the
 *  header row instead of spending a row of its own. Without a header (the
 *  scoreboard, tests) the children render in place. */
export function InHeader({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext)
  return slot ? createPortal(children, slot) : children
}
