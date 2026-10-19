import { Link, Outlet } from 'react-router'
import { Wordmark } from './Wordmark'
import styles from './Layout.module.css'

export function Layout() {
  return (
    <div className={styles.app}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link to="/" className={styles.wordmarkLink}>
          <Wordmark />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
