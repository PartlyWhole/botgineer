import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './app/styles.css'
import './app/console.css'

const host = document.getElementById('root')
if (!host) throw new Error('#root is missing')
createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
