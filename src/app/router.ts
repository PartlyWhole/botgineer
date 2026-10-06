/**
 * Hash routing: the map, or one level.
 *
 * GitHub Pages applies no rewrite rules, so a path route would 404 on
 * refresh. A hash route always requests the existing index.html, which
 * makes deep links and reloads work with no server configuration.
 *
 *   `#/`              home: the v2 map while v1 is hidden (`versions.ts`),
 *                     else v1's
 *   `#/map`           v1's roadmap
 *   `#/v2`            v2's map
 *   `#/skills`        how well each concept is known, and which mistakes
 *   `#/glossary`      plain phrase to formal term; `#/glossary/<term>`
 *                     opens at one entry
 *   `#/code`          the sandbox: the editor and memory alone, to write,
 *                     run and step through (`#/sandbox` is v1's first level)
 *   `#/<level id>`    that level's workbench
 *   `…&room=<url>`    any of these, in a shared room (`roomInHash`)
 *
 * Anything unrecognised is the map, which is always somewhere sensible to
 * land (the v2 map, for an unknown `v2-` id). A level's own hash still works whether or not the map shows it as
 * unlocked: locks are an invitation to play in order, not a wall, and
 * every test and every shared link depends on deep links going straight
 * in.
 */
import { useEffect, useState } from 'react'
import { activityById, type Activity } from '../../content/activities'
import { SHOW_V1 } from './versions'

export type Route =
  | { kind: 'map' }
  | { kind: 'map2' }
  | { kind: 'skills' }
  | { kind: 'code' }
  | { kind: 'glossary'; term: string | null }
  | { kind: 'level'; activity: Activity }

function read(): Route {
  // A shared room rides after the route (`roomInHash`), and is not part of it.
  const id = window.location.hash.replace(/^#\/?/, '').split('&')[0]!
  if (id === 'v2') return { kind: 'map2' }
  if (id === 'skills') return { kind: 'skills' }
  if (id === 'code') return { kind: 'code' }
  if (id === 'glossary' || id.startsWith('glossary/')) return { kind: 'glossary', term: id.slice('glossary/'.length) || null }
  // Home is the map of the version on offer: v2's, while v1 is hidden.
  if (id === '' && !SHOW_V1) return { kind: 'map2' }
  const activity = id === '' || id === 'map' ? null : activityById(id)
  if (activity) return { kind: 'level', activity }
  // A v2 level this page does not know (a stale page, or a level renamed)
  // lands on the v2 map rather than v1's.
  return id.startsWith('v2-') ? { kind: 'map2' } : { kind: 'map' }
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

/** Back to the map — having just finished `finished`, if given. A v2
 *  level goes back to the v2 map; `version` says which when nothing was
 *  finished. */
export function goToMap(finished?: string, version?: 1 | 2): void {
  arrival = finished ?? null
  const v = version ?? (finished ? (activityById(finished)?.version ?? 1) : 1)
  window.location.hash = v === 2 ? '#/v2' : '#/map'
}

/**
 * The shared room a link carries, after the route: `#/code&room=<url>`,
 * with `&via=tabs` when the room uses only some transports
 * (`collab/room`). Null when there is none.
 */
export function roomInHash(hash = window.location.hash): { url: string; via: string | null } | null {
  const m = hash.match(/&room=(automerge:[A-Za-z0-9]+)(?:&via=([\w,]*))?$/)
  return m ? { url: m[1]!, via: m[2] ?? null } : null
}

/** The current route's hash with no room on it. */
export function hashWithoutRoom(hash = window.location.hash): string {
  return hash.split('&')[0]!
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
