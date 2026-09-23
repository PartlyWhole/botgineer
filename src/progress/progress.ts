/**
 * Which levels the player has finished, and what that unlocks.
 *
 * This is the one thing in the app that is **stored** rather than derived,
 * and it is stored because it has to outlive the page: a run's memory
 * belongs to the run, a lesson's progress is derived from evidence
 * (invariant 11), but "you have done level three" is a fact about the
 * player, and it has nowhere else to live on a static site with no
 * accounts. It lives in this browser's localStorage and nowhere else.
 *
 * What is stored is a set of finished level ids, and nothing more.
 * Everything the map shows — done, current, locked, a unit's trophy — is
 * derived from that set and the roadmap's order, so there is exactly one
 * fact to get wrong.
 */
import { useSyncExternalStore } from 'react'

export type LevelState = 'done' | 'current' | 'locked'

/**
 * Each level's state, from the play order and what is finished.
 *
 * Finished levels are done. The first unfinished one is current — the one
 * the map invites you to play. Every unfinished level after it is locked.
 * A level finished out of order (reached by a deep link) still shows as
 * done; it does not unlock anything past the current one, because what is
 * current is the first gap, not the furthest point reached.
 */
export function levelStates(order: string[], done: ReadonlySet<string>): Map<string, LevelState> {
  const out = new Map<string, LevelState>()
  let found = false
  for (const id of order) {
    if (done.has(id)) out.set(id, 'done')
    else if (!found) {
      out.set(id, 'current')
      found = true
    } else out.set(id, 'locked')
  }
  return out
}

/** A unit's trophy is earned when every level in it is done. */
export const unitDone = (levels: string[], done: ReadonlySet<string>): boolean =>
  levels.length > 0 && levels.every((id) => done.has(id))

/* ------------------------------- the store ------------------------------- */

const KEY = 'botgineer.progress.v1'

let cache: ReadonlySet<string> | null = null
const listeners = new Set<() => void>()

/** Read once, then served from memory. Storage can throw (a private
 *  window, blocked site data) or hold something that is not ours; either
 *  way the answer is "nothing finished yet", never a crash. */
function read(): ReadonlySet<string> {
  if (cache) return cache
  let ids: string[] = []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    ids = []
  }
  cache = new Set(ids)
  return cache
}

function write(next: ReadonlySet<string>) {
  cache = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    // Not saved, but still true for this visit.
  }
  for (const fn of [...listeners]) fn()
}

/** Records a level as finished. Idempotent, and never un-finishes one:
 *  scrubbing back through a finished run does not take the trophy away. */
export function markDone(id: string): void {
  const now = read()
  if (now.has(id)) return
  write(new Set([...now, id]))
}

/** Forgets everything. For tests, and for a "start over" if one is ever
 *  offered. */
export function resetProgress(): void {
  write(new Set())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  // Another tab finishing a level shows up here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    cache = null
    fn()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

/** The finished levels, kept current. */
export function useProgress(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, read)
}
