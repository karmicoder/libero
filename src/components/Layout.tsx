import { Link, Outlet } from 'react-router'
import { Wordmark } from './Wordmark'

export function Layout() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="wordmark-link">
          <Wordmark />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
