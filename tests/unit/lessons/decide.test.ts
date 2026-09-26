/**
 * Making Choices, as a lesson: memory in, step out. The steps to guard
 * are the prediction (a typed string, never a line that did the work),
 * the comparison (asked of the robot, about the name), and the loops,
 * which must be judged on what the loop left behind — `w` — so a list
 * typed out by hand is refused.
 */
import { describe, expect, it } from 'vitest'
import { decide, guidance, progress, script, type Evidence } from '../../../content/lessons'
import { ACTIVITIES } from '../../../content/activities'
import { LEVEL_ORDER } from '../../../content/roadmap'
import type { MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, snap, th, value } from './fixtures'

type V = number | string | number[]

const obj = (v: number | string): PyObject =>
  typeof v === 'number' ? value('int', String(v)) : value('str', `'${v}'`)
const idOf = (v: number | string) => obj(v).id

/** Memory with these names: a number, a string, or a list of numbers. */
const mem = (names: Record<string, V>): MemorySnapshot => {
  const objects: PyObject[] = []
  const bindings = Object.entries(names).map(([name, v]) => {
    if (!Array.isArray(v)) {
      objects.push(obj(v))
      return { name, scope: 'global', target: idOf(v) }
    }
    const l: PyObject = {
      id: `u:${name}`,
      type: 'list',
      kind: 'reference',
      repr: `${v.length} items`,
      elements: v.map((n) => ({ label: null, target: idOf(n) })),
      partial: false,
    }
    objects.push(l, ...v.map(obj))
    return { name, scope: 'global', target: l.id }
  })
  return snap(objects, bindings)
}

const ev = (history: MemorySnapshot[], ...said: [string, string, string][]): Evidence => ({
  snapshot: history[history.length - 1]!,
  history,
  thoughts: said.map(([type, repr, source]) => ({ ...th(type, repr), source })),
})

const at = (e: Evidence) => progress(decide, e)

/** Every step done, in play order: memory and what was said. */
const H: MemorySnapshot[] = [
  mem({ weight: 12 }),
  mem({ weight: 12, ride: 'van' }),
  mem({ weight: 3, ride: 'van' }),
  mem({ weight: 3, ride: 'bike' }),
  mem({ weight: 3, ride: 'bike', heavy: [] }),
  mem({ weight: 3, ride: 'bike', heavy: [12, 15], w: 15 }),
  mem({ weight: 3, ride: 'bike', heavy: [12, 15], w: 3 }),
]
const SAID: [string, string, string][] = [
  ['bool', 'True', 'weight > 10'],
  ['str', "'van'", '"van"'],
]

describe('decide', () => {
  it('opens on Mira’s choice, and on what the robot cannot do yet (R12)', () => {
    const s = script(decide, NOTHING)
    expect(s.items[0]!.text).toContain('van')
    expect(s.items[1]!.text).toContain('can’t choose')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Type `weight = 12`.' })
  })

  it('walks the condition, if, the skipped block, else, an if in a loop and a break under one', () => {
    expect(at(ev([H[0]!]))).toBe(1)
    expect(at(ev([H[0]!], SAID[0]!))).toBe(2)
    expect(at(ev(H.slice(0, 2), SAID[0]!))).toBe(3)
    expect(at(ev(H.slice(0, 3), SAID[0]!))).toBe(4)
    expect(at(ev(H.slice(0, 3), ...SAID))).toBe(5)
    expect(at(ev(H.slice(0, 4), ...SAID))).toBe(6)
    expect(at(ev(H.slice(0, 5), ...SAID))).toBe(7)
    expect(at(ev(H.slice(0, 6), ...SAID))).toBe(8)
    expect(at(ev(H, ...SAID))).toBe(decide.steps.length)
    expect(script(decide, ev(H, ...SAID)).finished).toBe(true)
  })

  it('has between six and nine asks, each praised with its reason (R9)', () => {
    expect(decide.steps.length).toBeGreaterThanOrEqual(6)
    expect(decide.steps.length).toBeLessThanOrEqual(9)
    for (const s of decide.steps) expect(String(s.praise)).toMatch(/because|so /)
    expect(decide.takeaway).toMatch(/\.$/)
  })

  it('does not take a typed True, or a question about the number, as the robot comparing', () => {
    const h = [H[0]!]
    expect(at(ev(h, ['bool', 'True', 'True']))).toBe(1)
    expect(at(ev(h, ['bool', 'True', '12 > 10']))).toBe(1)
  })

  it('does not take the robot reading `ride`, or an unquoted guess, as a prediction', () => {
    const h = H.slice(0, 3)
    expect(at(ev(h, SAID[0]!, ['str', "'van'", 'ride']))).toBe(4)
    expect(at(ev(h, SAID[0]!, ['str', "'van'", '"v" + "an"']))).toBe(4)
  })

  it('refuses a loop’s result typed out by hand: only a loop leaves `w` behind', () => {
    const before = H.slice(0, 5)
    expect(at(ev([...before, mem({ weight: 3, ride: 'bike', heavy: [12, 15] })], ...SAID))).toBe(7)
    // Every parcel appended, because the `if` was left out.
    expect(at(ev([...before, mem({ weight: 3, ride: 'bike', heavy: [12, 3, 15], w: 15 })], ...SAID))).toBe(7)
    // A bare `break` stops on the first pass.
    expect(at(ev([...H.slice(0, 6), mem({ weight: 3, ride: 'bike', heavy: [12, 15], w: 12 })], ...SAID))).toBe(8)
  })

  describe('answers the likely misses', () => {
    // As the workbench reports it: a line that made a thought adds it last.
    const reply = (e: Evidence, l: ReturnType<typeof line>) => {
      const thoughts = l.ok && l.thought ? [...e.thoughts, { ...l.thought, source: l.source }] : e.thoughts
      return guidance(decide, { ...e, thoughts, last: l }).text
    }
    const atIf = ev(H.slice(0, 1), SAID[0]!)
    const atElse = ev(H.slice(0, 3), ...SAID)
    const atLoop = ev(H.slice(0, 5), ...SAID)
    const atBreak = ev(H.slice(0, 6), ...SAID)

    it('a typed answer, and a number instead of the name', () => {
      const e = ev([H[0]!])
      expect(reply(e, line('True', th('bool', 'True')))).toContain('you answered it')
      expect(reply(e, line('12 > 10', th('bool', 'True')))).toContain('Ask about the name')
    })

    it('a header with no colon, and a body with no indent', () => {
      expect(reply(atIf, failed('if weight > 10', 'SyntaxError'))).toContain('colon')
      expect(reply(atIf, failed('if weight > 10:\nride = "van"', 'IndentationError'))).toContain('spaces in front')
    })

    it('`=` where `==` asks the question', () => {
      expect(reply(atBreak, failed('for w in [12, 3, 15]:\n    if w = 3:\n        break', 'SyntaxError'))).toContain('==')
    })

    it('the skipped block predicted as run, an unquoted word, and running it first', () => {
      const e = ev(H.slice(0, 3), SAID[0]!)
      expect(reply(e, line('"truck"', th('str', "'truck'")))).toContain('skipped')
      expect(reply(e, failed('van', 'NameError'))).toContain('quotes')
      expect(reply(e, line('ride', th('str', "'van'")))).toContain('Predict it first')
      expect(reply(e, line('if weight > 10:\n    ride = "truck"', null))).toContain('Predict it first')
    })

    it('an `else` on its own, and an `if` that forgot it', () => {
      expect(reply(atElse, failed('else:', 'SyntaxError'))).toContain('can’t stand alone')
      expect(reply(atElse, line('if weight > 10:\n    ride = "van"', null))).toContain('Add `else:`')
    })

    it('the append outside the `if`, a loop with no `if`, and a list that was not empty', () => {
      expect(reply(atLoop, line('for w in [12, 3, 15]:\n    if w > 10:\n        pass\n    heavy.append(w)', null))).toContain(
        'isn’t inside the `if`',
      )
      expect(reply(atLoop, line('for w in [12, 3, 15]:\n    heavy.append(w)', null))).toContain('Every parcel went in')
      expect(reply(atLoop, line('for w in [12, 3, 15]:\n    if w > 10:\n        heavy.append(w)', null))).toContain(
        'wasn’t empty',
      )
    })

    it('a `break` outside its `if`', () => {
      expect(reply(atBreak, line('for w in [12, 3, 15]:\n    if w == 3:\n        pass\n    break', null))).toContain(
        'isn’t inside the `if`',
      )
    })
  })

  it('asks the question, not a reply, when it arrives after the line before', () => {
    const e = ev(H.slice(0, 6), ...SAID)
    const last = line('for w in [12, 3, 15]:\n    if w > 10:\n        heavy.append(w)', null)
    expect(script(decide, { ...e, last }).items.at(-1)!.kind).toBe('ask')
    // `weight = 12` finished step one and made no thought: not a miss.
    expect(script(decide, { ...ev([H[0]!]), last: line('weight = 12', null) }).items.at(-1)!.kind).toBe('ask')
    const p = ev(H.slice(0, 3), SAID[0]!)
    expect(script(decide, { ...p, last: line('weight = 3', null) }).items.at(-1)!.kind).toBe('ask')
  })

  it('plays between Stage 5’s ideas and its exercises, which use `if`', () => {
    const i = LEVEL_ORDER.indexOf('decide')
    expect(LEVEL_ORDER[i - 1]).toBe('s5-ideas')
    expect(LEVEL_ORDER[i + 1]).toBe('s5-set-1')
    expect(ACTIVITIES.find((a) => a.id === 'decide')).toMatchObject({ mode: 'console', lesson: 'decide', title: 'Making Choices' })
  })
})
