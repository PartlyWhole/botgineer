/**
 * What a reading level plays, and what its result means. Pure.
 *
 * The checkpoint is a gate, as the collection asks ("the ladder assumes
 * every rung holds"): a stage's trophy needs all but one of its questions
 * right first time. A miss sends you back — every missed question's "go
 * back to" exercises become a **review** — and the checkpoint opens again
 * once each of them has been done since.
 *
 * None of that is stored. It is read off mastery's per-item records
 * (`ex:<id>`): a record whose streak is nothing was last answered wrong,
 * and its `last` says when. Finished levels are the only other thing
 * stored (invariant 19), and a failed checkpoint is simply not finished.
 */
import { KEY, due, lastMissed, type Mastery } from '../mastery/mastery'
import { STAGES, goBackOf, itemById, specOf } from './index'
import { rng } from '../practice/exercises'
import { variantFamilies, variantId } from './variants'

/** All but one right first time, where a vocabulary-only miss counts as
 *  right — it is not a gap in understanding. */
export const passMark = (questions: number): number => Math.max(1, questions - 1)

export const passed = (results: readonly (boolean | null)[]): boolean =>
  results.every((r) => r !== null) && results.filter((r) => r === true).length >= passMark(results.length)

/** The checkpoint questions of a stage whose last first-try was a miss. */
export function missedQuestions(stage: number, m: Mastery): string[] {
  const cp = STAGES[stage - 1]?.checkpoint
  if (!cp) return []
  return cp.items.filter((q) => lastMissed(m[KEY.exercise(q.id)])).map((q) => q.id)
}

/**
 * The review a failed checkpoint owes: the exercises its missed questions
 * point back to, in collection order. A question the key gives no pointer
 * for falls back on the stage's exercises that share its concepts.
 */
export function reviewItems(stage: number, m: Mastery): string[] {
  const out = new Set<string>()
  for (const id of missedQuestions(stage, m)) {
    const back = goBackOf(itemById(id)!)
    if (back.length) back.forEach((b) => out.add(b))
    else {
      const concepts = new Set(specOf(id)?.concepts ?? [])
      for (const e of STAGES[stage - 1]!.exercises) if (specOf(e.id)?.concepts.some((c) => concepts.has(c))) out.add(e.id)
    }
  }
  const order = STAGES.flatMap((s) => s.exercises.map((e) => e.id))
  return [...out].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/** When the checkpoint was last failed: the latest of its missed
 *  questions' records. */
const failedAt = (stage: number, m: Mastery): number =>
  Math.max(0, ...missedQuestions(stage, m).map((id) => m[KEY.exercise(id)]?.last ?? 0))

/** Whether a review is owed: the checkpoint was failed, and not every
 *  review exercise has been done since. */
export function reviewOwed(stage: number, m: Mastery, checkpointDone: boolean): boolean {
  if (checkpointDone) return false
  const items = reviewItems(stage, m)
  if (items.length === 0) return false
  const since = failedAt(stage, m)
  return items.some((id) => (m[KEY.exercise(id)]?.last ?? 0) <= since)
}

/** Where a set picks up: the first item never answered, or the start
 *  when all of them have been (a replay). */
export function resumeAt(ids: readonly string[], m: Mastery): number {
  const i = ids.findIndex((id) => !m[KEY.exercise(id)])
  return i < 0 ? 0 : i
}

export const PRACTICE_LENGTH = 5

/**
 * A stage's practice: up to two exercises that want another look —
 * missed last time, or whose concepts have faded — then fresh variants of
 * the stage's templatable families to make five. Seeded, so a test can
 * replay one.
 */
export function practiceItems(stage: number, m: Mastery, now: number, seed: number): string[] {
  const r = rng(seed)
  const exercises = STAGES[stage - 1]?.exercises ?? []
  const again = exercises
    .filter((e) => {
      const rec = m[KEY.exercise(e.id)]
      if (!rec) return false
      if (lastMissed(rec)) return true
      return (specOf(e.id)?.concepts ?? []).some((c) => due(m[c], now))
    })
    .map((e) => e.id)
  const out = again.slice(0, 2)
  const families = variantFamilies(stage)
  let k = 0
  while (out.length < PRACTICE_LENGTH && families.length > 0) {
    const f = families[k % families.length]!
    out.push(variantId(f.id, Math.floor(r() * 2 ** 31)))
    k++
  }
  return out
}
