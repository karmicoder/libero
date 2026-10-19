import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import { HeaderSlotContext } from './headerSlotContext'
import { Wordmark } from './Wordmark'
import styles from './Layout.module.css'

export function Layout() {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  return (
    <div className={styles.app}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link to="/" className={styles.wordmarkLink}>
          <Wordmark />
        </Link>
        <div ref={setHeaderSlot} className={styles.slot} />
      </header>
      <HeaderSlotContext value={headerSlot}>
        <main id="main" tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
      </HeaderSlotContext>
    </div>
  )
}
