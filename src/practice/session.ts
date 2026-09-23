/**
 * A practice session: which exercises, in what order.
 *
 * Drawn from a pool of skills — a unit's, the ones its lessons introduced
 * — and weighted towards the weak ones. A skill's weight is how far it is
 * from mastered, plus a floor so nothing is ever left out entirely, plus a
 * bump if it has faded since it was last practised. The same skill is
 * never asked twice running, and the same question never twice at all.
 *
 * Pure and seeded: the same pool, mastery, clock and seed give the same
 * session, which is what lets a test replay one.
 */
import { due, strength, type Mastery } from '../mastery/mastery'
import { generate, rng, type Exercise } from './exercises'

export const SESSION_LENGTH = 5

export function weightOf(skill: string, m: Mastery, now: number): number {
  return 0.25 + (1 - strength(m[skill], now)) + (due(m[skill], now) ? 0.3 : 0)
}

export function planSession(
  pool: string[],
  m: Mastery,
  now: number,
  seed: number,
  length = SESSION_LENGTH,
): Exercise[] {
  if (pool.length === 0) return []
  const r = rng(seed)
  const out: Exercise[] = []
  const keys = new Set<string>()
  let prev: string | null = null

  for (let i = 0; i < length; i++) {
    const choices = pool.length > 1 ? pool.filter((s) => s !== prev) : pool
    const weights = choices.map((s) => weightOf(s, m, now))
    let roll = r() * weights.reduce((a, b) => a + b, 0)
    let skill = choices[choices.length - 1]!
    for (let j = 0; j < choices.length; j++) {
      roll -= weights[j]!
      if (roll <= 0) {
        skill = choices[j]!
        break
      }
    }

    // A fresh question: a few tries at a new seed if this one was asked.
    let ex = generate(skill, Math.floor(r() * 2 ** 31))
    for (let t = 0; t < 6 && keys.has(ex.key); t++) ex = generate(skill, Math.floor(r() * 2 ** 31))
    keys.add(ex.key)
    out.push(ex)
    prev = skill
  }
  return out
}
