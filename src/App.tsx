import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { SportSelectPage } from './pages/SportSelectPage'
import { MatchPage } from './pages/MatchPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SportSelectPage />} />
        <Route path="match/:sportId" element={<MatchPage />} />
      </Route>
    </Routes>
  )
}
