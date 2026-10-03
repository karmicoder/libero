import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/oxanium/500.css'
import './styles/index.css'
import { registerBuiltinBoards } from './boards/builtin'
import { registerBuiltinConsoles } from './consoles/builtin'
import { registerBuiltinEngines } from './engines/builtin'
import { registerBuiltinSports } from './sports/builtin'
import App from './App'

registerBuiltinSports()
registerBuiltinEngines()
registerBuiltinConsoles()
registerBuiltinBoards()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
