import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/nunito/900.css'
import './app/styles.css'
import './app/console.css'
import './app/props.css'
import './app/roadmap.css'
import './app/read.css'

const host = document.getElementById('root')
if (!host) throw new Error('#root is missing')
createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
