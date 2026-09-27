/**
 * Stage 3's ideas, as a lesson: memory in, step out. The ones to guard are
 * the reads the robot must do (a typed `'b'` is not reading a slot), the
 * write that must change the same list rather than build a new one, and
 * the prediction, which takes a typed number only.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s3Ideas, script, type Evidence, type LineMemory } from '../../../content/lessons'
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

/** An accepted line and the memory it left: what `everBy` judges. */
const by = (source: string, memory: MemorySnapshot): LineMemory => ({ source, memory })
type Entry = MemorySnapshot | LineMemory
const memOf = (x: Entry): MemorySnapshot => ('memory' in x ? x.memory : x)

/** Memory after each line (a bare snapshot is a line whose source does not
 *  matter), and what the robot said. */
const ev = (entries: Entry[], ...said: [string, string, string][]): Evidence => {
  const history = entries.map(memOf)
  return {
    snapshot: history[history.length - 1]!,
    history,
    lines: entries.map((x) => ('memory' in x ? x : by('', x))),
    thoughts: said.map(([type, repr, source]) => ({ ...th(type, repr), source })),
  }
}

const abc = list('1', [str('a'), str('b'), str('c')])
const azc = list('1', [str('a'), str('z'), str('c')])
const zc = list('2', [str('z'), str('c')])
const ages = dict('3', [['ann', int(30)], ['bo', int(25)]])
const agesT = dict('3', [['ann', int(30)], ['bo', int(25)]])
agesT.elements!.push({ label: '(1, 2)', target: made(int(5)).id })
const IDX: [string, string, string] = ['str', "'IndexError'", '"IndexError"']
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
    said.push(['str', "'IndexError'", '"IndexError"'])
    expect(at(ev([m1], ...said))).toBe(3)
    const m2 = by('items[1] = "z"', mem({ items: azc }))
    expect(at(ev([m1, m2], ...said))).toBe(4)
    said.push(['int', '2', '2'])
    expect(at(ev([m1, m2], ...said))).toBe(5)
    const m3 = mem({ items: azc, part: zc })
    expect(at(ev([m1, m2, m3], ...said))).toBe(6)
    const m4 = mem({ items: azc, part: zc, ages })
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(7)
    said.push(['int', '30', 'ages["ann"]'])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(8)
    said.push(['str', "'KeyError'", "'KeyError'"])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(9)
    said.push(['int', '0', 'ages.get("cy", 0)'])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(10)
    said.push(['bool', 'False', '30 in ages'])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(11)
    const m4t = by('ages[(1, 2)] = 5', mem({ items: azc, part: zc, ages: agesT }))
    expect(at(ev([m1, m2, m3, m4, m4t], ...said))).toBe(12)
    const m5 = mem({ items: azc, part: zc, ages: agesT, grid })
    expect(at(ev([m1, m2, m3, m4, m4t, m5], ...said))).toBe(12)
    said.push(['int', '3', 'grid[1][0]'])
    expect(at(ev([m1, m2, m3, m4, m4t, m5], ...said))).toBe(s3Ideas.steps.length)
  })

  it('does not take a read typed out by hand', () => {
    const m1 = mem({ items: abc })
    expect(progress(s3Ideas, ev([m1], ['str', "'b'", '"b"'], ['str', "'c'", '"c"']))).toBe(1)
    const reply = guidance(s3Ideas, { ...ev([m1], ['str', "'b'", '"b"']), last: line('"b"', th('str', "'b'")) })
    expect(reply.text).toContain('Let the robot read the slot')
  })

  it('does not count a new list typed out as writing a slot', () => {
    const said: [string, string, string][] = [['str', "'b'", 'items[1]'], ['str', "'c'", 'items[-1]'], IDX]
    const fresh = mem({ items: list('9', [str('a'), str('z'), str('c')]) })
    const e = ev([mem({ items: abc }), fresh], ...said)
    expect(progress(s3Ideas, e)).toBe(3)
    expect(guidance(s3Ideas, { ...e, last: line('items = ["a", "z", "c"]', null) }).text).toContain('built a new list')
  })

  it('takes only a typed number as the prediction, and answers the inclusive count', () => {
    const said: [string, string, string][] = [['str', "'b'", 'items[1]'], ['str', "'c'", 'items[-1]'], IDX]
    const history = [mem({ items: abc }), by('items[1] = "z"', mem({ items: azc }))]
    // The robot's own slice is not a prediction.
    const ran = ev([...history, mem({ items: azc, part: zc })], ...said)
    expect(progress(s3Ideas, ran)).toBe(4)
    expect(guidance(s3Ideas, { ...ran, last: line('part = items[1:3]', null) }).text).toContain('Predict it first')
    const three = guidance(s3Ideas, { ...ev(history, ...said, ['int', '3', '3']), last: line('3', th('int', '3')) })
    expect(three.text).toContain('*before* its end')
  })

  it('does not take `False` typed by hand for `in`, and names the missing key', () => {
    const history = [
      mem({ items: abc }),
      by('items[1] = "z"', mem({ items: azc })),
      mem({ items: azc, part: zc }),
      mem({ items: azc, part: zc, ages }),
    ]
    const said: [string, string, string][] = [
      ['str', "'b'", 'items[1]'],
      ['str', "'c'", 'items[-1]'],
      IDX,
      ['int', '2', '2'],
      ['int', '30', 'ages["ann"]'],
      ['str', "'KeyError'", '"KeyError"'],
    ]
    const e = ev(history, ...said)
    expect(progress(s3Ideas, e)).toBe(9)
    expect(guidance(s3Ideas, { ...e, last: failed('ages["cy"]', 'KeyError') }).text).toContain('the `KeyError` you said')
    said.push(['int', '0', 'ages.get("cy", 0)'], ['bool', 'False', 'False'])
    expect(progress(s3Ideas, ev(history, ...said))).toBe(10)
  })

  it('finishes the write after the player rebinds `items` on the way (no softlock)', () => {
    const said: [string, string, string][] = [['str', "'b'", 'items[1]'], ['str', "'c'", 'items[-1]'], IDX]
    const fresh = list('9', [str('a'), str('b'), str('c')])
    const written = list('9', [str('a'), str('z'), str('c')])
    const rebound = [mem({ items: abc }), by('items = ["a", "b", "c"]', mem({ items: fresh }))]
    expect(progress(s3Ideas, ev(rebound, ...said))).toBe(3)
    expect(progress(s3Ideas, ev([...rebound, by('items[1] = "z"', mem({ items: written }))], ...said))).toBe(4)
    // A rebinding with the `'z'` already in it is not the write.
    const typedZ = [mem({ items: abc }), by('items = ["a", "z", "c"]', mem({ items: written }))]
    expect(progress(s3Ideas, ev(typedZ, ...said))).toBe(3)
  })

  it('files a tuple as a key after the list is refused, and takes only the tuple line', () => {
    const history = [
      mem({ items: abc }),
      by('items[1] = "z"', mem({ items: azc })),
      mem({ items: azc, part: zc }),
      mem({ items: azc, part: zc, ages }),
    ]
    const said: [string, string, string][] = [
      ['str', "'b'", 'items[1]'],
      ['str', "'c'", 'items[-1]'],
      IDX,
      ['int', '2', '2'],
      ['int', '30', 'ages["ann"]'],
      ['str', "'KeyError'", '"KeyError"'],
      ['int', '0', 'ages.get("cy", 0)'],
      ['bool', 'False', '30 in ages'],
    ]
    const e = ev(history, ...said)
    expect(progress(s3Ideas, e)).toBe(11)
    expect(guidance(s3Ideas, { ...e, last: failed('ages[[1, 2]] = 5', 'TypeError') }).text).toContain('Now the tuple')
    expect(progress(s3Ideas, ev([...history, by('ages[(1, 2)] = 5', mem({ items: azc, part: zc, ages: agesT }))], ...said))).toBe(12)
  })

  it('names counting from the end', () => {
    const e = ev([mem({ items: abc })], ['str', "'b'", 'items[1]'])
    expect(guidance(s3Ideas, { ...e, last: line('items[2]', th('str', "'c'")) }).text).toContain('count from the end')
  })

  it('does not give the prediction away when an index past the end stops the reads', () => {
    const e = ev([mem({ items: abc })])
    const reply = guidance(s3Ideas, { ...e, last: failed('items[3]', 'IndexError') }).text
    expect(reply).toContain('no such slot')
    expect(reply).not.toContain('IndexError')
  })

  /** What the robot thought of this line, as evidence. */
  const said = (l: ReturnType<typeof line>): [string, string, string][] =>
    l.thought ? [[l.thought.type, l.thought.repr, l.source]] : []

  const reads: [string, string, string][] = [['str', "'b'", 'items[1]'], ['str', "'c'", 'items[-1]']]

  it('takes the missing index’s error as a prediction: its name typed in quotes, and nothing else', () => {
    const m1 = mem({ items: abc })
    const at = (...said: [string, string, string][]) => progress(s3Ideas, ev([m1], ...reads, ...said))
    expect(at()).toBe(2)
    expect(s3Ideas.steps[2]!.say).toContain('`items[3]`')
    expect(at(['str', "'IndexError'", '"IndexError"'])).toBe(3)
    expect(at(['str', "'IndexError'", "'IndexError'"])).toBe(3)
    // Built, not typed: not a prediction.
    expect(at(['str', "'IndexError'", '"Index" + "Error"'])).toBe(2)
    expect(at(['str', "'KeyError'", '"KeyError"'])).toBe(2)
    // A line with a thought is in the evidence too, as the workbench hands it over.
    const miss = (l: ReturnType<typeof line>) =>
      guidance(s3Ideas, { ...ev([m1], ...reads, ...said(l)), last: l }).text
    expect(miss(failed('items[3]', 'IndexError'))).toContain('Predict first')
    expect(miss(line('IndexError', th('type', "<class 'IndexError'>")))).toContain('in quotes: `"IndexError"`')
    expect(miss(failed('indexerror', 'NameError'))).toContain('Without quotes')
    expect(miss(line('"KeyError"', th('str', "'KeyError'")))).toContain('A list’s slots have numbers')
    expect(miss(line('"ValueError"', th('str', "'ValueError'")))).toContain('an index that isn’t there')
  })

  it('greets the error they named when they see it, and still judges the write', () => {
    const e = ev([mem({ items: abc })], ...reads, IDX)
    expect(guidance(s3Ideas, { ...e, last: failed('items[3]', 'IndexError') }).text).toContain('the `IndexError` you said')
    expect(s3Ideas.steps[3]!.say).toMatch(/`items\[3\]` to see it, then `items\[1\] = "z"`/)
  })

  it('takes the missing key’s error as a prediction, and names the list’s error as the other one', () => {
    const history = [
      mem({ items: abc }),
      by('items[1] = "z"', mem({ items: azc })),
      mem({ items: azc, part: zc }),
      mem({ items: azc, part: zc, ages }),
    ]
    const before: [string, string, string][] = [...reads, IDX, ['int', '2', '2'], ['int', '30', 'ages["ann"]']]
    expect(progress(s3Ideas, ev(history, ...before))).toBe(8)
    expect(progress(s3Ideas, ev(history, ...before, ['str', "'KeyError'", '"KeyError"']))).toBe(9)
    // Guessed wrong for the missing index, `"KeyError"` does not answer the key later.
    const early: [string, string, string][] = [...reads, ['str', "'KeyError'", '"KeyError"'], IDX, ['int', '2', '2'], ['int', '30', 'ages["ann"]']]
    expect(progress(s3Ideas, ev(history, ...early))).toBe(8)
    // Nor does `"IndexError"` typed before the reads answer the index.
    expect(progress(s3Ideas, ev([mem({ items: abc })], IDX, ...reads))).toBe(2)
    const miss = (l: ReturnType<typeof line>) => guidance(s3Ideas, { ...ev(history, ...before, ...said(l)), last: l }).text
    expect(miss(failed('ages["cy"]', 'KeyError'))).toContain('Predict first')
    expect(miss(line('"IndexError"', th('str', "'IndexError'")))).toContain('A dictionary’s slots have keys')
    expect(miss(line('"ValueError"', th('str', "'ValueError'")))).toContain('a key that isn’t there')
  })
})
