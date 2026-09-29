/**
 * v2, Working things out (`v2-ops`): operations, order and rules taught
 * and asked, then a quiz of nine that covers each concept once, the key
 * computed by the same copy of Python as its question.
 */
import { describe, expect, it } from 'vitest'
import { progress, script, type Evidence } from '../../../content/lessons'
import { hasOp, opsLesson, outcome, quiz } from '../../../content/lessons/v2/ops'
import { thinking } from './fixtures'
import type { Heard } from '../../../content/lessons'

/** The robot's thought for a line, the way the console reports it. */
function thoughtOf(source: string, type: string, repr: string): Heard {
  return { type, repr, source }
}

describe('v2-ops: the pieces', () => {
  it('tells a line with a sum in it from a number typed by hand', () => {
    expect(hasOp('7 * 6')).toBe(true)
    expect(hasOp('42')).toBe(false)
    expect(hasOp('-3')).toBe(false)
    expect(hasOp('"a-b"')).toBe(false)
    expect(hasOp('"bot" + "gineer"')).toBe(true)
  })

  it('reads the rules the way Python does', () => {
    expect(outcome({ k: 'bin', op: '+', l: { k: 'lit', value: { t: 'str', v: '5' } }, r: { k: 'lit', value: { t: 'int', v: 5 } } })).toEqual({ error: 'TypeError' })
    expect(outcome({ k: 'bin', op: '/', l: { k: 'lit', value: { t: 'int', v: 6 } }, r: { k: 'lit', value: { t: 'int', v: 3 } } })).toEqual({ repr: '2.0', type: 'float' })
  })
})

describe('v2-ops: teaching', () => {
  const lesson = opsLesson(1)

  it('refuses the right number typed by hand, and takes the sum', () => {
    const crates = lesson.steps[0]!
    expect(crates.done(thinking(thoughtOf('42', 'int', '42')))).toBe(false)
    expect(crates.done(thinking(thoughtOf('7 * 6', 'int', '42')))).toBe(true)
    expect(crates.nudge!({ source: '42', ok: true, error: null, thought: { type: 'int', repr: '42' } })).toMatch(/you worked it out/)
    expect(crates.nudge!({ source: '7 x 6', ok: false, error: 'SyntaxError', thought: null })).toMatch(/`\*`, not `x`/)
  })

  it('shows each operation, the order and the rules before it asks about them', () => {
    const said = lesson.steps.slice(0, 5).map((s) => (s.beats ?? []).map((b) => b.say).join(' '))
    expect(said[0]).toMatch(/`\+` adds/)
    expect(said[0]).toMatch(/`\/` divides/)
    expect(said[1]).toMatch(/always makes a `float`/)
    expect(said[2]).toMatch(/`\*` and `\/` go first/)
    expect(said[2]).toMatch(/brackets go first/)
    expect(said[4]).toMatch(/can't be added to a number/)
    // The TypeError is demonstrated before it is asked about.
    expect(lesson.steps[4]!.beats!.some((b) => b.stops === 'TypeError')).toBe(true)
    expect(lesson.steps[4]!.choices!.answer).toBe('TypeError')
  })
})

describe('v2-ops: the quiz', () => {
  const seeds = Array.from({ length: 300 }, (_, i) => i + 1)
  const PATTERN = ['type', 'pick', 'type', 'pick', 'type', 'pick', 'type', 'pick', 'type']
  const IDS = ['quiz-order', 'quiz-type', 'quiz-rule', 'quiz-glue']

  it('asks nine, taking turns between typing and picking, each concept once', () => {
    for (const seed of seeds) {
      const q = quiz(seed)
      expect(q.map((s) => (s.choices ? 'pick' : 'type'))).toEqual(PATTERN)
      expect(q.flatMap((s) => (s.choices ? [s.choices.id] : []))).toEqual(IDS)
    }
  })

  it('has four distinct options on every pick, the key among them, and a reason for every wrong one', () => {
    for (const seed of seeds) {
      for (const s of quiz(seed).filter((x) => x.choices)) {
        const c = s.choices!
        const ids = c.options.map((o) => o.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.length).toBe(4)
        expect(ids).toContain(c.answer)
        for (const o of ids) if (o !== c.answer) expect(c.nudge?.(o)).toBeTruthy()
      }
    }
  })

  it('gives every typed question a model sum that is a sum, and asks the robot to work it out', () => {
    for (const seed of seeds) {
      for (const s of quiz(seed).filter((x) => !x.choices)) {
        expect(s.model).toBeDefined()
        expect(hasOp(s.model!)).toBe(true)
        expect(s.tag).toBe('robot')
      }
    }
  })

  it('needs brackets exactly once, and a float from division exactly once', () => {
    for (const seed of seeds) {
      const models = quiz(seed).flatMap((s) => (s.model ? [s.model] : []))
      expect(models.filter((m) => m.includes('(')).length).toBe(1)
      expect(models.filter((m) => m.includes('/')).length).toBe(1)
    }
  })

  it('only moves on for a pick of the key', () => {
    const lesson = opsLesson(3)
    const order = lesson.steps[2]!.choices!
    const past = (picks: { ask: string; choice: string }[]): Evidence => ({
      ...thinking(thoughtOf('7 * 6', 'int', '42'), thoughtOf('9 / 2', 'float', '4.5')),
      picks,
      lastPick: picks[picks.length - 1] ?? null,
    })
    expect(progress(lesson, past([{ ask: order.id, choice: '15' }]))).toBe(2)
    const s = script(lesson, past([{ ask: order.id, choice: '15' }]))
    expect(s.items[s.rest]!.text).toMatch(/left to right/)
    expect(progress(lesson, past([{ ask: order.id, choice: '11' }]))).toBe(3)
  })
})
