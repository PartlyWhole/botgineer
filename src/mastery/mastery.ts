/**
 * How well each skill is known.
 *
 * One record per skill: how many exercises it has had, how many were right
 * *first time*, a running score, the current streak and when it was last
 * practised. Only first tries count. Getting it right on the third go is
 * learning, and the exercise is not over until it happens — but it is not
 * evidence that the skill was already known, which is what mastery means.
 *
 * The score moves a fixed fraction of the way towards 1 on a right answer
 * and towards 0 on a wrong one, so recent answers matter most and one slip
 * does not erase a history. Five right in a row takes a new skill to
 * mastered; a miss sets the streak back to nothing, and mastered needs one.
 *
 * Mastery fades. A skill not practised for a while is shown weaker than it
 * was — but never by more than half, so what you knew stays mostly known.
 * How long it holds grows with the streak, which is spaced repetition in
 * its simplest form: a skill answered right many times running is asked
 * about less often. The fading is computed when read, never stored, so it
 * cannot drift out of step with the clock.
 */
import { stored } from '../progress/storage'

export type SkillRecord = {
  /** Exercises given (first tries only). */
  tries: number
  /** Of those, right first time. */
  right: number
  /** 0..1, as of `last`. */
  score: number
  /** Right first time, in a row. */
  streak: number
  /** When it was last practised, ms since the epoch. */
  last: number
}

export type Mastery = Readonly<Record<string, SkillRecord>>

export type Level = 'new' | 'attempted' | 'familiar' | 'proficient' | 'mastered'

export const LEVELS: Level[] = ['new', 'attempted', 'familiar', 'proficient', 'mastered']

export const LEVEL_NAMES: Record<Level, string> = {
  new: 'Not started',
  attempted: 'Attempted',
  familiar: 'Familiar',
  proficient: 'Proficient',
  mastered: 'Mastered',
}

/** How far towards the target one answer moves the score. */
export const RATE = 0.35
const DAY = 24 * 60 * 60 * 1000

/** Records a first try at an exercise for this skill. Pure. */
export function record(m: Mastery, skill: string, right: boolean, now: number): Mastery {
  const was = m[skill] ?? { tries: 0, right: 0, score: 0, streak: 0, last: now }
  const base = strength(was, now)
  return {
    ...m,
    [skill]: {
      tries: was.tries + 1,
      right: was.right + (right ? 1 : 0),
      score: base + RATE * ((right ? 1 : 0) - base),
      streak: right ? was.streak + 1 : 0,
      last: now,
    },
  }
}

/** Days a skill holds before it has faded halfway: two, doubling with each
 *  right answer in a row, up to a month. */
export const holdDays = (streak: number): number => 2 * 2 ** Math.min(streak, 4)

/**
 * The score as of now, faded by time since it was last practised.
 *
 * Fades towards half of itself, never below — see the header.
 */
export function strength(r: SkillRecord | undefined, now: number): number {
  if (!r || r.tries === 0) return 0
  const age = Math.max(0, now - r.last) / DAY
  const kept = 0.5 ** (age / holdDays(r.streak))
  return r.score * (0.5 + 0.5 * kept)
}

/** The named level a skill is at. Mastered needs the streak as well as the
 *  score, so it cannot be reached on luck and then coasted on. */
export function level(r: SkillRecord | undefined, now: number): Level {
  if (!r || r.tries === 0) return 'new'
  const s = strength(r, now)
  if (s < 0.4) return 'attempted'
  if (s < 0.6) return 'familiar'
  if (s >= 0.85 && r.streak >= 3) return 'mastered'
  return 'proficient'
}

/** 0 for new, 4 for mastered: for drawing a bar. */
export const levelIndex = (l: Level): number => LEVELS.indexOf(l)

/** Worth practising now: never tried, or faded noticeably below what it
 *  was when last practised. */
export function due(r: SkillRecord | undefined, now: number): boolean {
  if (!r || r.tries === 0) return true
  return r.score - strength(r, now) > 0.12
}

/* ------------------------------- the store ------------------------------- */

const isRecord = (x: unknown): x is SkillRecord => {
  const r = x as SkillRecord
  return (
    typeof r === 'object' &&
    r !== null &&
    [r.tries, r.right, r.score, r.streak, r.last].every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

const store = stored<Mastery>(
  'botgineer.mastery.v1',
  {},
  (raw) => {
    const out: Record<string, SkillRecord> = {}
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (isRecord(v)) out[k] = v
    }
    return out
  },
  (v) => v,
)

/** Records a first try, and saves it. */
export function recordTry(skill: string, right: boolean, now = Date.now()): void {
  store.write(record(store.read(), skill, right, now))
}

/**
 * Records several first tries at once, in one write — one item of the
 * collection is evidence about an exercise, its concepts, the
 * misconceptions it attacks, the lenses it reads through, and, on a miss,
 * which kind of mistake it was.
 */
export function recordAll(entries: readonly (readonly [key: string, right: boolean])[], now = Date.now()): void {
  let m = store.read()
  for (const [k, right] of entries) m = record(m, k, right, now)
  store.write(m)
}

/**
 * What mastery is kept about, by key. One store, several kinds of thing:
 *
 *   `<concept>`      a concept or warm-up skill, by its bare id — the
 *                    warm-up's records predate the prefixes, and concept
 *                    ids are unique across both families
 *   `ex:<id>`        one collection item; `right` is right first time
 *   `mis:<id>`       a misconception: right is *caught*, wrong *fell for*
 *   `lens:<lens>`    syntax, flow or object reading
 *   `err:<type>`     a miss of this kind; only misses are recorded, so
 *                    `tries` is the count
 */
export const KEY = {
  exercise: (id: string) => `ex:${id}`,
  misconception: (id: string) => `mis:${id}`,
  lens: (l: string) => `lens:${l}`,
  error: (t: string) => `err:${t}`,
}

/** Whether an item's most recent first try was a miss. A miss sets the
 *  streak to nothing, and only a right answer builds one. */
export const lastMissed = (r: SkillRecord | undefined): boolean => r !== undefined && r.tries > 0 && r.streak === 0

export const currentMastery = (): Mastery => store.read()

export const useMastery = (): Mastery => store.use()
