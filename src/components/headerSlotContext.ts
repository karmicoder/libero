import { createContext } from 'react'

/** The element in the app header that pages can fill (see `InHeader`). */
export const HeaderSlotContext = createContext<HTMLElement | null>(null)
