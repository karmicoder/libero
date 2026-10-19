import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { SportSelectPage } from './pages/SportSelectPage'
import { MatchPage } from './pages/MatchPage'
import { BoardPage } from './pages/BoardPage'
import { PrototypePage } from './prototype/volleyball-console/PrototypePage'

export default function App() {
  return (
    <Routes>
      {/* The scoreboard fills the window: no app header. */}
      <Route path="match/:sportId/board" element={<BoardPage />} />
      <Route element={<Layout />}>
        <Route index element={<SportSelectPage />} />
        <Route path="match/:sportId" element={<MatchPage />} />
        {/* PROTOTYPE (#69): throwaway */}
        <Route
          path="prototype/volleyball-console"
          element={<PrototypePage />}
        />
      </Route>
    </Routes>
  )
}
