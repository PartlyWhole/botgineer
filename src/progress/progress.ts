/**
 * Which levels the player has finished, and what that unlocks.
 *
 * This is one of the two things the app **stores** rather than derives
 * (the other is mastery), and it is stored because it has to outlive the page: a run's memory
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
import { stored } from './storage'

/** `unlocked`: not finished and not next, but open to play — every level
 *  is, once the player has chosen to unlock everything. */
export type LevelState = 'done' | 'current' | 'unlocked' | 'locked'

/**
 * Kept in the same set as the finished level ids: the player's choice to
 * open every level. It is a fact about the player like the others, and it
 * is not a level, so nothing that counts finished levels counts it — and
 * it earns nothing: a trophy still needs its levels actually finished.
 */
export const UNLOCK_ALL = '*unlock-all'

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
    } else out.set(id, done.has(UNLOCK_ALL) ? 'unlocked' : 'locked')
  }
  return out
}

/** A unit's trophy is earned when every level in it is done. */
export const unitDone = (levels: string[], done: ReadonlySet<string>): boolean =>
  levels.length > 0 && levels.every((id) => done.has(id))

/* ------------------------------- the store ------------------------------- */

const store = stored<ReadonlySet<string>>(
  'botgineer.progress.v1',
  new Set(),
  (raw) => new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []),
  (v) => [...v],
)

/** Records a level as finished. Idempotent, and never un-finishes one:
 *  scrubbing back through a finished run does not take the trophy away. */
export function markDone(id: string): void {
  const now = store.read()
  if (now.has(id)) return
  store.write(new Set([...now, id]))
}

/** Forgets every finished level, and the unlock. Part of "start over". */
export function resetProgress(): void {
  store.write(new Set())
}

/** Opens every level, or closes them again. Finished levels stay finished
 *  either way. */
export function setUnlockAll(on: boolean): void {
  const now = new Set(store.read())
  if (on) now.add(UNLOCK_ALL)
  else now.delete(UNLOCK_ALL)
  store.write(now)
}

export const allUnlocked = (done: ReadonlySet<string>): boolean => done.has(UNLOCK_ALL)

/** The finished levels, now, outside React. */
export const finishedLevels = (): ReadonlySet<string> => store.read()

/** The finished levels, kept current. */
export const useProgress = (): ReadonlySet<string> => store.use()
