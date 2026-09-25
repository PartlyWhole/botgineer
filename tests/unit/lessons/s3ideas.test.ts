/**
 * Stage 3's ideas, as a lesson: memory in, step out. The ones to guard are
 * the reads the robot must do (a typed `'b'` is not reading a slot), the
 * write that must change the same list rather than build a new one, and
 * the prediction, which takes a typed number only.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s3Ideas, script, type Evidence } from '../../../content/lessons'
import type { Binding, MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, snap, th, value } from './fixtures'

const str = (c: string) => value('str', `'${c}'`)
const int = (n: number) => value('int', String(n))

/** Every object made here, so memory can hold what a container points at. */
const MADE = new Map<string, PyObject>()
const made = (o: PyObject): PyObject => (MADE.set(o.id, o), o)

/** A list object whose slots point at these objects. */
const list = (uid: string, items: PyObject[]): PyObject =>
  made({
    id: `o:${uid}`,
    type: 'list',
    kind: 'reference',
    repr: `list, ${items.length} items`,
    elements: items.map((o, i) => ({ label: String(i), target: made(o).id })),
    partial: false,
  })

const dict = (uid: string, pairs: [string, PyObject][]): PyObject =>
  made({
    id: `o:${uid}`,
    type: 'dict',
    kind: 'reference',
    repr: `dict, ${pairs.length} entries`,
    elements: pairs.map(([k, o]) => ({ label: `'${k}'`, target: made(o).id })),
    partial: false,
  })

/** Memory with these names on these objects, and everything they reach. */
const mem = (names: Record<string, PyObject>): MemorySnapshot => {
  const all = new Map<string, PyObject>()
  const reach = (o: PyObject) => {
    if (all.has(o.id)) return
    all.set(o.id, o)
    for (const e of o.elements ?? []) reach(MADE.get(e.target)!)
  }
  Object.values(names).forEach(reach)
  const bindings: Binding[] = Object.entries(names).map(([name, o]) => ({ name, scope: 'global', target: o.id }))
  return snap([...all.values()], bindings)
}

const ev = (history: MemorySnapshot[], ...said: [string, string, string][]): Evidence => ({
  snapshot: history[history.length - 1]!,
  history,
  thoughts: said.map(([type, repr, source]) => ({ ...th(type, repr), source })),
})

const abc = list('1', [str('a'), str('b'), str('c')])
const azc = list('1', [str('a'), str('z'), str('c')])
const zc = list('2', [str('z'), str('c')])
const ages = dict('3', [['ann', int(30)], ['bo', int(25)]])
const grid = list('6', [list('4', [int(1), int(2)]), list('5', [int(3), int(4)])])

describe('s3-ideas', () => {
  it('opens on Mira’s wrong slot, before its first question', () => {
    const s = script(s3Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('wrote into the wrong slot')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Type `items = ["a", "b", "c"]`.' })
  })

  it('walks reading, writing, the slice, the dictionary and nesting', () => {
    const at = (e: Evidence) => progress(s3Ideas, e)
    const m1 = mem({ items: abc })
    expect(at(ev([m1]))).toBe(1)
    const said: [string, string, string][] = [['str', "'b'", 'items[1]']]
    expect(at(ev([m1], ...said))).toBe(1)
    said.push(['str', "'c'", 'items[-1]'])
    expect(at(ev([m1], ...said))).toBe(2)
    const m2 = mem({ items: azc })
    expect(at(ev([m1, m2], ...said))).toBe(3)
    said.push(['int', '2', '2'])
    expect(at(ev([m1, m2], ...said))).toBe(4)
    const m3 = mem({ items: azc, part: zc })
    expect(at(ev([m1, m2, m3], ...said))).toBe(5)
    const m4 = mem({ items: azc, part: zc, ages })
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(6)
    said.push(['int', '30', 'ages["ann"]'])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(7)
    said.push(['int', '0', 'ages.get("cy", 0)'])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(8)
    said.push(['bool', 'False', '30 in ages'])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(9)
    const m5 = mem({ items: azc, part: zc, ages, grid })
    expect(at(ev([m1, m2, m3, m4, m5], ...said))).toBe(9)
    said.push(['int', '3', 'grid[1][0]'])
    expect(at(ev([m1, m2, m3, m4, m5], ...said))).toBe(s3Ideas.steps.length)
  })

  it('does not take a read typed out by hand', () => {
    const m1 = mem({ items: abc })
    expect(progress(s3Ideas, ev([m1], ['str', "'b'", '"b"'], ['str', "'c'", '"c"']))).toBe(1)
    const reply = guidance(s3Ideas, { ...ev([m1], ['str', "'b'", '"b"']), last: line('"b"', th('str', "'b'")) })
    expect(reply.text).toContain('Let the robot read the slot')
  })

  it('does not count a new list typed out as writing a slot', () => {
    const said: [string, string, string][] = [['str', "'b'", 'items[1]'], ['str', "'c'", 'items[-1]']]
    const fresh = mem({ items: list('9', [str('a'), str('z'), str('c')]) })
    const e = ev([mem({ items: abc }), fresh], ...said)
    expect(progress(s3Ideas, e)).toBe(2)
    expect(guidance(s3Ideas, { ...e, last: line('items = ["a", "z", "c"]', null) }).text).toContain('built a new list')
  })

  it('takes only a typed number as the prediction, and answers the inclusive count', () => {
    const said: [string, string, string][] = [['str', "'b'", 'items[1]'], ['str', "'c'", 'items[-1]']]
    const history = [mem({ items: abc }), mem({ items: azc })]
    // The robot's own slice is not a prediction.
    const ran = ev([...history, mem({ items: azc, part: zc })], ...said)
    expect(progress(s3Ideas, ran)).toBe(3)
    expect(guidance(s3Ideas, { ...ran, last: line('part = items[1:3]', null) }).text).toContain('Predict it first')
    const three = guidance(s3Ideas, { ...ev(history, ...said, ['int', '3', '3']), last: line('3', th('int', '3')) })
    expect(three.text).toContain('*before* its end')
  })

  it('does not take `False` typed by hand for `in`, and names the missing key', () => {
    const history = [mem({ items: abc }), mem({ items: azc }), mem({ items: azc, part: zc }), mem({ items: azc, part: zc, ages })]
    const said: [string, string, string][] = [
      ['str', "'b'", 'items[1]'],
      ['str', "'c'", 'items[-1]'],
      ['int', '2', '2'],
      ['int', '30', 'ages["ann"]'],
    ]
    const e = ev(history, ...said)
    expect(progress(s3Ideas, e)).toBe(7)
    expect(guidance(s3Ideas, { ...e, last: failed('ages["cy"]', 'KeyError') }).text).toContain('`KeyError`')
    said.push(['int', '0', 'ages.get("cy", 0)'], ['bool', 'False', 'False'])
    expect(progress(s3Ideas, ev(history, ...said))).toBe(8)
  })

  it('says an index past the end is an IndexError', () => {
    const e = ev([mem({ items: abc })])
    expect(guidance(s3Ideas, { ...e, last: failed('items[3]', 'IndexError') }).text).toContain('`IndexError`')
  })
})
