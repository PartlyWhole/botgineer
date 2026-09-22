/**
 * A lesson's progress is derived from evidence, so these tests are just
 * evidence in, step number out. No UI, no runtime, no bookkeeping.
 *
 * The first two lessons never bind anything, so their evidence is
 * entirely *thoughts* — what the robot worked out and let go. Memory
 * staying empty there is the lesson, not an omission.
 */
import { describe, expect, it } from 'vitest'
import {
  guidance,
  namesPoint,
  operations,
  primitives,
  progress,
  takeAnOrder,
  type Evidence,
  type Lesson,
} from '../../content/lessons'
import type { Thought } from '../../src/memory/extract'
import type { Binding, MemorySnapshot, PyObject } from '../../src/memory/model'

const value = (type: string, repr: string): PyObject => ({
  id: `v:${type}:${repr}`,
  type,
  kind: 'value',
  repr,
  elements: null,
  partial: false,
})

const snap = (objects: PyObject[], bindings: Binding[] = []): MemorySnapshot => ({
  bindings,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  line: 1,
})

const EMPTY = snap([])
const th = (type: string, repr: string): Thought => ({ type, repr })

/** Evidence from a session that thought these things and bound nothing. */
const thinking = (...thoughts: Thought[]): Evidence => ({
  snapshot: EMPTY,
  thoughts,
  history: [EMPTY],
})

/** Evidence from a session that passed through these memories. */
const over = (history: MemorySnapshot[], thoughts: Thought[] = []): Evidence => ({
  snapshot: history[history.length - 1]!,
  thoughts,
  history,
})

const NOTHING: Evidence = thinking()

const bound = (name: string, type: string, repr: string) => ({
  object: value(type, repr),
  binding: { name, scope: 'global', target: `v:${type}:${repr}` },
})

/* --------------------------- one: four kinds --------------------------- */

describe('the four kinds of thing', () => {
  it('starts by asking for a whole number', () => {
    expect(progress(primitives, NOTHING)).toBe(0)
    expect(guidance(primitives, NOTHING).text).toMatch(/whole number/)
  })

  it('accepts any int, not one particular one', () => {
    // The player picks their own number; the type is what is being taught.
    expect(progress(primitives, thinking(th('int', '10')))).toBe(1)
    expect(progress(primitives, thinking(th('int', '-3')))).toBe(1)
  })

  it('does not accept a float for the int step', () => {
    expect(progress(primitives, thinking(th('float', '3.0')))).toBe(0)
  })

  it('walks through float, str and bool', () => {
    expect(progress(primitives, thinking(th('int', '1'), th('float', '2.5')))).toBe(2)
    expect(progress(primitives, thinking(th('int', '1'), th('float', '2.5'), th('str', "'crow'")))).toBe(3)
  })

  it('finishes on a bool, and says memory is still empty', () => {
    const e = thinking(th('int', '1'), th('float', '2.5'), th('str', "'x'"), th('bool', 'True'))
    expect(progress(primitives, e)).toBe(primitives.steps.length)
    expect(guidance(primitives, e).text).toMatch(/none of them had a name/)
    expect(e.snapshot.bindings).toEqual([])
  })

  it('does not mistake the word "True" for a bool', () => {
    // `"True"` is a str. Telling them apart is the point of the lesson.
    const e = thinking(th('int', '1'), th('float', '2.5'), th('str', "'True'"))
    expect(progress(primitives, e)).toBe(3)
  })
})

/* ------------------------- two: working things out ------------------------- */

describe('working things out', () => {
  it('wants the answer, not the question', () => {
    expect(progress(operations, NOTHING)).toBe(0)
    expect(progress(operations, thinking(th('int', '42')))).toBe(1)
  })

  it('wants a float from division', () => {
    const got = thinking(th('int', '42'), th('float', '4.5'))
    expect(progress(operations, got)).toBe(2)
    // `4` would be the wrong answer, and a different type as well.
    expect(progress(operations, thinking(th('int', '42'), th('int', '4')))).toBe(1)
  })

  it('joins words and answers a comparison', () => {
    const e = thinking(th('int', '42'), th('float', '4.5'), th('str', "'botgineer'"))
    expect(progress(operations, e)).toBe(3)
    expect(progress(operations, thinking(...e.thoughts, th('bool', 'False')))).toBe(4)
  })

  it('finishes on the two-part sum, and says the answer went nowhere', () => {
    const e = thinking(
      th('int', '42'),
      th('float', '4.5'),
      th('str', "'botgineer'"),
      th('bool', 'False'),
      th('int', '20'),
    )
    expect(progress(operations, e)).toBe(operations.steps.length)
    expect(guidance(operations, e).text).toMatch(/Nobody else ever knew it/)
  })

  it('needs no memory at all to be completed', () => {
    const e = thinking(
      th('int', '42'),
      th('float', '4.5'),
      th('str', "'botgineer'"),
      th('bool', 'False'),
      th('int', '20'),
    )
    expect(Object.keys(e.snapshot.objects)).toEqual([])
    expect(progress(operations, e)).toBe(operations.steps.length)
  })

  it('has no two steps answered by the same value', () => {
    // Otherwise one answer would satisfy a step it was not for.
    const answers = ['42', '4.5', "'botgineer'", 'False', '20']
    expect(new Set(answers).size).toBe(answers.length)
  })
})

/* ---------------------------- three: names ---------------------------- */

describe('names point at objects', () => {
  const x10 = bound('x', 'int', '10')
  const named = snap([x10.object], [x10.binding])
  const aliased = snap([x10.object], [x10.binding, { ...x10.binding, name: 'y' }])
  const moved = snap(
    [value('int', '10'), value('int', '99')],
    [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
    ],
  )

  it('asks for a name because the last lesson kept nothing', () => {
    expect(guidance(namesPoint, NOTHING).text).toMatch(/forgetting/)
  })

  it('wants the name, then wants it read back without recomputing', () => {
    expect(progress(namesPoint, over([named]))).toBe(1)
    expect(progress(namesPoint, over([named], [th('int', '10')]))).toBe(2)
  })

  it('finishes when x has moved and y has not', () => {
    expect(progress(namesPoint, over([named, aliased, moved], [th('int', '10')]))).toBe(
      namesPoint.steps.length,
    )
  })

  it('does not slide backwards when the last step un-answers the first', () => {
    // `x = 99` makes "x points at 10" false again.
    expect(progress(namesPoint, over([moved], [th('int', '10')]))).toBe(0)
    expect(progress(namesPoint, over([named, aliased, moved], [th('int', '10')]))).toBe(4)
  })
})

/* -------------------------- four: taking an order -------------------------- */

describe('taking an order', () => {
  const customer = bound('customer', 'str', "'Ana'")
  const parcels = bound('parcels', 'int', '7')
  const stored = snap([customer.object, parcels.object], [customer.binding, parcels.binding])

  it('is asked by the courier, not the crow', () => {
    expect(guidance(takeAnOrder, NOTHING).speaker).toBe('courier')
  })

  it('wants both facts before the question', () => {
    expect(progress(takeAnOrder, over([snap([customer.object], [customer.binding])]))).toBe(1)
    expect(progress(takeAnOrder, over([stored]))).toBe(2)
  })

  it('finishes when the robot works the weight out', () => {
    expect(progress(takeAnOrder, over([stored], [th('int', '14')]))).toBe(takeAnOrder.steps.length)
  })

  it('is not satisfied by storing the answer instead of working it out', () => {
    const cheated = snap(
      [customer.object, parcels.object, value('int', '14')],
      [customer.binding, parcels.binding, { name: 'total', scope: 'global', target: 'v:int:14' }],
    )
    expect(progress(takeAnOrder, over([cheated]))).toBe(2)
  })
})

/* ------------------------------ every lesson ------------------------------ */

const ALL: Lesson[] = [primitives, operations, namesPoint, takeAnOrder]

describe.each(ALL.map((l) => [l.id, l] as const))('%s', (_id, lesson) => {
  it('starts at the beginning and has something to say there', () => {
    expect(progress(lesson, NOTHING)).toBe(0)
    expect(guidance(lesson, NOTHING).text).not.toBe('')
  })

  it('has an outro that is not one of its steps', () => {
    expect(lesson.outro).not.toBe('')
    expect(lesson.steps.map((s) => s.say)).not.toContain(lesson.outro)
  })

  it('only ever moves forward as evidence accumulates', () => {
    const objects = [
      value('int', '10'),
      value('int', '99'),
      value('str', "'Ana'"),
      value('int', '7'),
    ]
    const bindings: Binding[] = [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
      { name: 'customer', scope: 'global', target: "v:str:'Ana'" },
      { name: 'parcels', scope: 'global', target: 'v:int:7' },
    ]
    const memories = [
      EMPTY,
      snap(objects.slice(0, 1), bindings.slice(1, 2)),
      snap(objects, bindings),
    ]
    const said = [
      th('int', '10'),
      th('float', '4.5'),
      th('str', "'botgineer'"),
      th('bool', 'False'),
      th('int', '42'),
      th('int', '20'),
      th('int', '14'),
    ]
    const stages: Evidence[] = said.map((_, i) =>
      over(memories.slice(0, Math.min(memories.length, 1 + Math.floor(i / 3))), said.slice(0, i)),
    )
    const seen = stages.map((e) => progress(lesson, e))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })
})
