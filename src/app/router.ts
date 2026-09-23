/**
 * Hash routing: the map, or one level.
 *
 * GitHub Pages applies no rewrite rules, so a path route would 404 on
 * refresh. A hash route always requests the existing index.html, which
 * makes deep links and reloads work with no server configuration.
 *
 *   `#/` or `#/map`   the roadmap — where the game starts, like a home
 *   `#/skills`        how well each concept is known, and which mistakes
 *   `#/glossary`      plain phrase to formal term; `#/glossary/<term>`
 *                     opens at one entry
 *   `#/<level id>`    that level's workbench
 *
 * Anything unrecognised is the map, which is always somewhere sensible to
 * land. A level's own hash still works whether or not the map shows it as
 * unlocked: locks are an invitation to play in order, not a wall, and
 * every test and every shared link depends on deep links going straight
 * in.
 */
import { useEffect, useState } from 'react'
import { activityById, type Activity } from '../../content/activities'

export type Route =
  | { kind: 'map' }
  | { kind: 'skills' }
  | { kind: 'glossary'; term: string | null }
  | { kind: 'level'; activity: Activity }

function read(): Route {
  const id = window.location.hash.replace(/^#\/?/, '')
  if (id === 'skills') return { kind: 'skills' }
  if (id === 'glossary' || id.startsWith('glossary/')) return { kind: 'glossary', term: id.slice('glossary/'.length) || null }
  const activity = id === '' || id === 'map' ? null : activityById(id)
  return activity ? { kind: 'level', activity } : { kind: 'map' }
}

/**
 * The level just finished, when the map was reached by finishing it.
 *
 * The map uses it to celebrate: the finished stop pops, the one it
 * unlocked bounces, a trophy just earned lifts. It is a matter of how you
 * *arrived*, not of progress — progress is stored, this is not — so it
 * lives in memory for this page and is gone on reload, or the moment you
 * go anywhere else.
 */
let arrival: string | null = null

/** What the map should celebrate, if anything. Reading does not clear it:
 *  React may render the map twice on the way in. */
export const arrivedFrom = (): string | null => arrival

/** Navigate to a level by id. The hash format is written down here and
 *  nowhere else. */
export function goTo(id: string): void {
  arrival = null
  window.location.hash = `#/${id}`
}

/** Back to the map — having just finished `finished`, if given. */
export function goToMap(finished?: string): void {
  arrival = finished ?? null
  window.location.hash = '#/map'
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onHash = () => setRoute(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}
