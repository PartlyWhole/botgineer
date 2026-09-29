/**
 * v2, Basic data types (`v2-types`): four types shown, named and asked in
 * order, then a quiz of multiple choice and typed questions that covers
 * every concept once, whatever the seed.
 */
import { describe, expect, it } from 'vitest'
import { progress, script, type Evidence, type LessonStep, type Pick } from '../../../content/lessons'
import { quiz, typesLesson } from '../../../content/lessons/v2/types'
import type { Thought } from '../../../src/memory/extract'
import { NOTHING, line, th, thinking } from './fixtures'

/** Every thought a typed quiz step could want, to find the one it does. */
const CANDIDATES: Thought[] = [
  th('bool', 'True'),
  th('bool', 'False'),
  ...[3, 4, 5, 6, 7, 8].map((n) => th('int', String(n))),
  ...[24.5, 52.5, 61.5, 18.5, 36.5].map((n) => th('float', String(n))),
  ...['Bolt', 'Sprocket', 'Pip', 'True'].map((w) => th('str', `'${w}'`)),
]
const answerOf = (step: LessonStep): Thought | undefined => CANDIDATES.find((t) => step.done(thinking(t)))

const typeOfLiteral = (text: string) =>
  /^["']/.test(text) ? 'str' : text === 'True' || text === 'False' ? 'bool' : text.includes('.') ? 'float' : 'int'

describe('v2-types: teaching', () => {
  const lesson = typesLesson(1)

  it('shows each type before naming it, types the first example of each, and asks bool, int, float, str in turn', () => {
    const asks = lesson.steps.slice(0, 4).map((s) => answerOf(s) ?? (s.done(thinking(th('str', "'0412 555 019'"))) ? th('str', 'phone') : undefined))
    expect(asks.map((t) => t?.type)).toEqual(['bool', 'int', 'float', 'str'])
    for (const step of lesson.steps.slice(0, 4)) {
      const beats = step.beats ?? []
      const named = beats.findIndex((b) => /are called \*/.test(b.say))
      const shown = beats.findIndex((b) => b.thought !== undefined)
      expect(shown).toBeGreaterThanOrEqual(0)
      expect(shown).toBeLessThan(named)
      expect(beats.some((b) => b.types !== undefined)).toBe(true)
    }
  })

  it('refuses the phone number as a number, and takes it as words', () => {
    const phone = lesson.steps[3]!
    expect(phone.done(thinking(th('int', '412555019')))).toBe(false)
    expect(phone.done(thinking(th('str', "'0412 555 019'")))).toBe(true)
    expect(phone.nudge!(line('0412555019', th('int', '412555019')))).toMatch(/`0` at the front falls off/)
  })
})

describe('v2-types: the quiz', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i + 1)

  it('asks eight questions, taking turns between picking and typing, never three of a kind in a row', () => {
    for (const seed of seeds) {
      const q = quiz(seed)
      expect(q).toHaveLength(8)
      const kinds = q.map((s) => (s.choices ? 'pick' : 'type'))
      expect(kinds.filter((k) => k === 'pick')).toHaveLength(5)
      expect(kinds.join(',')).not.toMatch(/(pick,pick,pick|type,type,type)/)
    }
  })

  it('covers every concept once: 3 vs 3.0, True vs "True", digits in quotes, all four types by situation, the word True', () => {
    for (const seed of seeds) {
      const q = quiz(seed)
      const ids = q.flatMap((s) => (s.choices ? [s.choices.id] : []))
      expect(new Set(ids)).toEqual(new Set(['q-dot', 'q-quote', 'q-digits', 'q-sit-a', 'q-sit-b']))
      // Each literal's key agrees with Python's reading of it.
      for (const s of q) {
        if (s.show?.kind === 'value') expect(s.choices!.answer).toBe(typeOfLiteral(s.show.text))
      }
      // The four types, two picked and two typed, each once.
      const picked = q.filter((s) => s.choices?.id.startsWith('q-sit')).map((s) => s.choices!.answer)
      const typed = q.filter((s) => !s.choices && s.show?.kind !== 'note').map((s) => answerOf(s)?.type)
      const typedNames = q.filter((s) => !s.choices && s.show?.kind === 'note' && !/True/.test(s.say)).map(() => 'str')
      expect([...picked, ...typed, ...typedNames].sort()).toEqual(['bool', 'float', 'int', 'str'])
      // And the word True, as words.
      expect(q.some((s) => s.done(thinking(th('str', "'True'"))) && !s.done(thinking(th('bool', 'True'))))).toBe(true)
    }
  })

  it('has a typed answer that works for every typed question', () => {
    for (const seed of seeds) for (const s of quiz(seed)) if (!s.choices) expect(answerOf(s)).toBeDefined()
  })
})

describe('v2-types: picking', () => {
  const lesson = typesLesson(5)
  // Past the teaching: the four answers, in order.
  const taught: Thought[] = [th('bool', 'True'), th('int', '4'), th('float', '36.5'), th('str', "'0412 555 019'")]
  const at = (picks: Pick[], lastPick: Pick | null = null): Evidence => ({ ...thinking(...taught), picks, lastPick })
  const first = lesson.steps[4]!

  it('opens the quiz on a question picked on the stage, not typed', () => {
    const s = script(lesson, at([]))
    expect(s.at).toBe(4)
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', choices: { id: first.choices!.id, tried: [] } })
  })

  it('answers a wrong pick, marks it tried, and moves on only on the right one', () => {
    const wrong = first.choices!.options.find((o) => o.id !== first.choices!.answer)!.id
    const miss = { ask: first.choices!.id, choice: wrong }
    const s = script(lesson, at([miss], miss))
    expect(s.at).toBe(4)
    expect(s.items[s.rest]!.kind).toBe('reply')
    expect(s.items[s.rest]!.choices!.tried).toEqual([wrong])
    const hit = { ask: first.choices!.id, choice: first.choices!.answer }
    expect(progress(lesson, at([miss, hit], hit))).toBe(5)
    // And the praise for it is said before the next question.
    expect(script(lesson, at([miss, hit], hit)).items[0]!.kind).toBe('praise')
  })

  it('does not take a pick for a question that is not being asked', () => {
    expect(progress(lesson, { ...NOTHING, picks: [{ ask: first.choices!.id, choice: first.choices!.answer }] })).toBe(0)
  })
})
