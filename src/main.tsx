import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// A deploy replaces the hashed files a page loads lazily, so a tab opened
// before it can fail to load the next one. Reload once to pick up the new
// build; the timestamp stops a loop if the file is genuinely missing.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'waypoint.chunkReloadAt'
  try {
    const last = Number(sessionStorage.getItem(KEY)) || 0
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
