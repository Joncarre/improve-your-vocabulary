import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './app/App.tsx'
import { requestPersistence } from './lib/storage.ts'
import './styles/index.css'

// Ask the browser not to evict our data (best effort; Settings shows the result).
void requestPersistence()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
