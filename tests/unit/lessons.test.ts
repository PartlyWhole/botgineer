/**
 * A lesson's progress is derived from evidence, so these tests are just
 * evidence in, step number out. No UI, no runtime, no bookkeeping.
 */
import { describe, expect, it } from 'vitest'
import {
  guidance,
  namesPoint,
  objectsFirst,
  progress,
  takeAnOrder,
  type Evidence,
  type Lesson,
} from '../../content/lessons'
import type { Binding, MemorySnapshot, PyObject } from '../../src/memory/model'

const value = (type: string, repr: string): PyObject => ({
  id: `v:${type}:${repr}`,
  type,
  kind: 'value',
  repr,
  elements: null,
  partial: false,
})

const list = (id: string, targets: string[]): PyObject => ({
  id,
  type: 'list',
  kind: 'reference',
  repr: `${targets.length} items`,
  elements: targets.map((t, i) => ({ label: String(i), target: t })),
  partial: false,
})

const snap = (objects: PyObject[], bindings: Binding[] = []): MemorySnapshot => ({
  bindings,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  line: 1,
})

/** Evidence from a session whose only state is this one snapshot. */
const at = (snapshot: MemorySnapshot, echoed: string[] = []): Evidence => ({
  snapshot,
  echoed,
  history: [snapshot],
})

/** Evidence from a session that passed through each of these in turn. */
const over = (history: MemorySnapshot[], echoed: string[] = []): Evidence => ({
  snapshot: history[history.length - 1]!,
  echoed,
  history,
})

const NOTHING: Evidence = at(snap([]))

/** `name = <value>`, as the extractor would have it. */
const bound = (name: string, type: string, repr: string) => ({
  object: value(type, repr),
  binding: { name, scope: 'global', target: `v:${type}:${repr}` },
})

/* ----------------------- one: objects before names ----------------------- */

describe('objects before names', () => {
  it('starts at the first step', () => {
    expect(progress(objectsFirst, NOTHING)).toBe(0)
    expect(guidance(objectsFirst, NOTHING).text).toMatch(/Say `10`/)
  })

  it('advances when the int exists', () => {
    expect(progress(objectsFirst, at(snap([value('int', '10')])))).toBe(1)
  })

  it('does not accept a different number', () => {
    expect(progress(objectsFirst, at(snap([value('int', '11')])))).toBe(0)
  })

  it('wants the string quoted the way Python reprs it', () => {
    expect(progress(objectsFirst, at(snap([value('int', '10'), value('str', "'John'")])))).toBe(2)
  })

  it('accepts a computed value, not just a typed one', () => {
    const s = snap([value('int', '10'), value('str', "'John'"), value('int', '7')])
    expect(progress(objectsFirst, at(s))).toBe(3)
  })

  it('finishes on a three-item collection nothing holds', () => {
    const s = snap([
      value('int', '10'),
      value('str', "'John'"),
      value('int', '7'),
      value('int', '1'),
      value('int', '2'),
      value('int', '3'),
      list('o:L1', ['v:int:1', 'v:int:2', 'v:int:3']),
    ])
    expect(progress(objectsFirst, at(s))).toBe(objectsFirst.steps.length)
    expect(guidance(objectsFirst, at(s)).text).toBe(objectsFirst.outro)
  })

  it('does not count a collection that a name already holds', () => {
    const s = snap(
      [value('int', '1'), list('o:L1', ['v:int:1'])],
      [{ name: 'xs', scope: 'global', target: 'o:L1' }],
    )
    expect(progress(objectsFirst, at(s))).toBe(0)
  })
})

/* -------------------------- two: names are arrows -------------------------- */

describe('names point at objects', () => {
  const x10 = bound('x', 'int', '10')

  it('wants a name on an object, not just the object', () => {
    expect(progress(namesPoint, at(snap([value('int', '10')])))).toBe(0)
    expect(progress(namesPoint, at(snap([x10.object], [x10.binding])))).toBe(1)
  })

  it('wants the second name on the same object, not an equal one', () => {
    // Two names, two different objects: not yet an alias.
    const other = bound('y', 'int', '11')
    const apart = snap([x10.object, other.object], [x10.binding, other.binding])
    expect(progress(namesPoint, at(apart))).toBe(1)

    const together = snap([x10.object], [x10.binding, { ...x10.binding, name: 'y' }])
    expect(progress(namesPoint, at(together))).toBe(2)
  })

  const aliased = snap([x10.object], [x10.binding, { ...x10.binding, name: 'y' }])
  const moved = snap(
    [value('int', '10'), value('int', '99')],
    [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
    ],
  )

  it('finishes when x has moved and y has not', () => {
    expect(progress(namesPoint, over([aliased, moved]))).toBe(namesPoint.steps.length)
  })

  it('does not slide backwards when the last step un-answers the first', () => {
    // `x = 99` makes "x points at 10" false again. Asking only about the
    // current snapshot would drop the player back to step one at the exact
    // moment they finished the lesson.
    expect(progress(namesPoint, at(moved))).toBe(0)
    expect(progress(namesPoint, over([aliased, moved]))).toBe(3)
  })

  it('is not finished if both names moved together', () => {
    const together = snap(
      [value('int', '99')],
      [
        { name: 'x', scope: 'global', target: 'v:int:99' },
        { name: 'y', scope: 'global', target: 'v:int:99' },
      ],
    )
    expect(progress(namesPoint, over([aliased, together]))).toBe(2)
  })
})

/* ------------------------- three: taking an order ------------------------- */

describe('taking an order', () => {
  const customer = bound('customer', 'str', "'Ana'")
  const parcels = bound('parcels', 'int', '7')
  const stored = snap([customer.object, parcels.object], [customer.binding, parcels.binding])

  it('is asked by the courier, not the crow', () => {
    expect(guidance(takeAnOrder, NOTHING).speaker).toBe('courier')
  })

  it('wants the name on the ticket first', () => {
    expect(progress(takeAnOrder, NOTHING)).toBe(0)
    expect(progress(takeAnOrder, at(snap([customer.object], [customer.binding])))).toBe(1)
  })

  it('then the count', () => {
    expect(progress(takeAnOrder, at(stored))).toBe(2)
  })

  it('is not satisfied by storing the answer instead of working it out', () => {
    // A name pointing at 14 is not the robot answering the question.
    const cheated = snap(
      [customer.object, parcels.object, value('int', '14')],
      [customer.binding, parcels.binding, { name: 'total', scope: 'global', target: 'v:int:14' }],
    )
    expect(progress(takeAnOrder, at(cheated))).toBe(2)
  })

  it('finishes when the robot says the weight out loud', () => {
    expect(progress(takeAnOrder, at(stored, ['14']))).toBe(takeAnOrder.steps.length)
    expect(guidance(takeAnOrder, at(stored, ['14'])).text).toBe(takeAnOrder.outro)
  })

  it('does not accept the weight before the facts are stored', () => {
    // Evidence is checked in order, so a lucky `7 * 2` early proves nothing.
    expect(progress(takeAnOrder, at(snap([]), ['14']))).toBe(0)
  })
})

/* ------------------------------- every lesson ------------------------------ */

const ALL: Lesson[] = [objectsFirst, namesPoint, takeAnOrder]

describe.each(ALL.map((l) => [l.id, l] as const))('%s', (_id, lesson) => {
  it('starts at the beginning and has something to say there', () => {
    expect(progress(lesson, NOTHING)).toBe(0)
    expect(guidance(lesson, NOTHING).text).not.toBe('')
  })

  it('only ever moves forward as evidence accumulates', () => {
    // Evidence only grows, so a satisfied step can never come undone —
    // which is the whole reason progress needs no bookkeeping.
    const objects = [
      value('int', '10'),
      value('str', "'John'"),
      value('int', '7'),
      value('int', '99'),
      value('str', "'Ana'"),
      value('int', '1'),
      list('o:L1', ['v:int:1']),
    ]
    const bindings: Binding[] = [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
      { name: 'customer', scope: 'global', target: "v:str:'Ana'" },
    ]
    const steps = [
      snap([]),
      snap(objects.slice(0, 2)),
      snap(objects.slice(0, 4)),
      snap(objects, bindings),
    ]
    const stages: Evidence[] = [
      NOTHING,
      over(steps.slice(0, 2)),
      over(steps.slice(0, 3)),
      over(steps),
      over(steps, ['14']),
    ]
    const seen = stages.map((e) => progress(lesson, e))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })
})
