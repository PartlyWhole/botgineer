/**
 * Hash routing.
 *
 * GitHub Pages applies no rewrite rules, so a path route would 404 on
 * refresh. A hash route always requests the existing index.html, which
 * makes deep links and reloads work with no server configuration.
 */
import { useEffect, useState } from 'react'

export const ROUTES = {
  tutorial: 'First Objects',
  parcels: 'Heavy Parcels',
} as const

export type Route = keyof typeof ROUTES

const DEFAULT: Route = 'tutorial'

function read(): Route {
  const id = window.location.hash.replace(/^#\/?/, '')
  return id in ROUTES ? (id as Route) : DEFAULT
}

export function useRoute(): [Route, (next: Route) => void] {
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onHash = () => setRoute(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [route, (next) => {
    window.location.hash = `#/${next}`
  }]
}
