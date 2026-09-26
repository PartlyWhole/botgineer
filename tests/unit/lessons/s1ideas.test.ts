/**
 * Stage 1's ideas, as a lesson: memory in, step out. The prediction step
 * is the one to guard — it must take a typed number and nothing that got
 * the robot to do the working.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s1Ideas, script } from '../../../content/lessons'
import type { MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, bound, line, snap, th, typed, value } from './fixtures'
import type { Evidence } from '../../../content/lessons'

const TEN = value('int', '10')
const TWENTY = value('int', '20')
/** A list `[10, 20]`: its slots point at the two ints, which `mem` adds. */
const list = (uid: string, items: PyObject[] = [TEN, TWENTY]): PyObject => ({
  id: uid,
  type: 'list',
  kind: 'reference',
  repr: `${items.length} items`,
  elements: items.map((o, i) => ({ label: String(i), target: o.id })),
  partial: false,
})

/** Memory with `total` at this value, plus whatever else is given. */
const mem = (total: string | null, extra: { objects?: PyObject[]; bindings?: { name: string; target: string }[] } = {}): MemorySnapshot => {
  const t = total === null ? [] : [bound('total', 'int', total)]
  return snap(
    [...t.map((b) => b.object), TEN, TWENTY, ...(extra.objects ?? [])],
    [...t.map((b) => b.binding), ...(extra.bindings ?? []).map((b) => ({ ...b, scope: 'global' }))],
  )
}

const ev = (history: MemorySnapshot[], ...said: [string, string, string][]): Evidence => ({
  snapshot: history[history.length - 1]!,
  history,
  thoughts: said.map(([type, repr, source]) => ({ ...th(type, repr), source })),
})

describe('s1-ideas', () => {
  it('opens on the bridge into reading, before its first question', () => {
    const s = script(s1Ideas, NOTHING)
    // `program` is named here, before `wake` (next on the path) uses it.
    expect(s.items[0]!.text).toContain('are called a program')
    expect(s.items[1]!.text).toContain('programs other people wrote')
    expect(s.items[2]!.text).toContain('before it does it')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Type `total = 5`.' })
  })

  it('walks right side first, the prediction, print, and lists shared and not', () => {
    const at = (e: Evidence) => progress(s1Ideas, e)
    const five = mem('5')
    expect(at(ev([five]))).toBe(1)
    const six = mem('6')
    expect(at(ev([five, six]))).toBe(2)
    // A typed 7 is the prediction; the robot's 7 from running it is not.
    expect(at(ev([five, six, mem('7')]))).toBe(2)
    expect(at(ev([five, six], ['int', '7', '7']))).toBe(3)
    const seven = mem('7')
    expect(at(ev([five, six, seven], ['int', '7', '7']))).toBe(4)
    const none = value('NoneType', 'None')
    const shown = mem('7', { objects: [none], bindings: [{ name: 'shown', target: none.id }] })
    expect(at(ev([five, six, seven, shown], ['int', '7', '7']))).toBe(5)
    const a = list('u1')
    const withA = mem('7', { objects: [none, a], bindings: [{ name: 'shown', target: none.id }, { name: 'a', target: 'u1' }] })
    expect(at(ev([five, six, seven, withA], ['int', '7', '7']))).toBe(6)
    const shared = mem('7', {
      objects: [none, a],
      bindings: [{ name: 'shown', target: none.id }, { name: 'a', target: 'u1' }, { name: 'b', target: 'u1' }],
    })
    const said: [string, string, string][] = [['int', '7', '7']]
    expect(at(ev([five, six, seven, shared], ...said))).toBe(7)
    said.push(['bool', 'True', 'id(a) == id(b)'])
    expect(at(ev([five, six, seven, shared], ...said))).toBe(8)
    const c = list('u2')
    const apart = mem('7', {
      objects: [none, a, c],
      bindings: [{ name: 'shown', target: none.id }, { name: 'a', target: 'u1' }, { name: 'b', target: 'u1' }, { name: 'c', target: 'u2' }],
    })
    said.push(['bool', 'False', 'id(c) == id(a)'])
    expect(at(ev([five, six, seven, shared, apart], ...said))).toBe(s1Ideas.steps.length)
  })

  it('answers a prediction that ran the line, or read the old value', () => {
    const base: Evidence = { ...ev([mem('5'), mem('6')]) }
    const ran = guidance(s1Ideas, { ...base, last: line('total = total + 1', null) })
    expect(ran.text).toContain('Predict it first')
    const six = guidance(s1Ideas, { ...base, thoughts: [{ ...th('int', '6'), source: '6' }], last: line('6', th('int', '6')) })
    expect(six.text).toContain('`total` at `6` now')
  })

  it('says a bare value was let go, at the first step', () => {
    expect(guidance(s1Ideas, typed(line('5', th('int', '5')))).text).toContain('thought of and let go')
  })

  it('tells the way on in play order: wake is next, then the exercises', () => {
    const outro = s1Ideas.outro as { say: string }[]
    expect(outro.at(-1)!.say).toMatch(/wake the robot.*Then the exercises/)
  })

  describe('the id steps', () => {
    const none = value('NoneType', 'None')
    const a = list('u1')
    const base = [{ name: 'shown', target: none.id }, { name: 'a', target: 'u1' }, { name: 'b', target: 'u1' }]
    const shared = mem('7', { objects: [none, a], bindings: base })
    const before: [string, string, string][] = [['int', '7', '7']]
    const at = (h: MemorySnapshot[], ...said: [string, string, string][]) => ev([mem('5'), mem('6'), mem('7'), ...h], ...before, ...said)

    it('wants both names asked about, not one twice', () => {
      expect(progress(s1Ideas, at([shared], ['bool', 'True', 'id(a) == id(a)']))).toBe(7)
      expect(progress(s1Ideas, at([shared], ['bool', 'True', 'id(b) == id(a)']))).toBe(8)
      const twice = { ...at([shared], ['bool', 'True', 'id(a) == id(a)']), last: line('id(a) == id(a)', th('bool', 'True')) }
      expect(guidance(s1Ideas, twice).text).toMatch(/both names/)
    })

    it('answers a typed True, and == on the lists, with what id is for', () => {
      const saidTrue = { ...at([shared], ['bool', 'True', 'True']), last: line('True', th('bool', 'True')) }
      expect(guidance(s1Ideas, saidTrue).text).toMatch(/you saying `True`/)
      const eq = { ...at([shared], ['bool', 'True', 'a == b']), last: line('a == b', th('bool', 'True')) }
      expect(guidance(s1Ideas, eq).text).toMatch(/look the same.*one object/)
    })

    it('wants c to be a second [10, 20], and both c and a asked about', () => {
      const ok: [string, string, string] = ['bool', 'True', 'id(a) == id(b)']
      const withC = (c: PyObject) =>
        mem('7', { objects: [none, a, c], bindings: [...base, { name: 'c', target: c.id }] })
      const empty = list('u2', [])
      expect(progress(s1Ideas, at([shared, withC(empty)], ok, ['bool', 'False', 'id(c) == id(a)']))).toBe(8)
      expect(progress(s1Ideas, at([shared, withC(list('u2'))], ok, ['bool', 'False', 'id(c) == id(c) + 1']))).toBe(8)
      expect(progress(s1Ideas, at([shared, withC(list('u2'))], ok, ['bool', 'False', 'id(c) == id(a)']))).toBe(9)
      const eq = { ...at([shared, withC(list('u2'))], ok, ['bool', 'True', 'c == a']), last: line('c == a', th('bool', 'True')) }
      expect(guidance(s1Ideas, eq).text).toMatch(/look the same/)
    })
  })

  it('answers print alone, and brackets alone', () => {
    const seven = mem('7')
    const printed = { ...ev([mem('5'), mem('6'), seven], ['int', '7', '7'], ['NoneType', 'None', 'print(total)']), last: line('print(total)', th('NoneType', 'None')) }
    expect(guidance(s1Ideas, printed).text).toMatch(/kept nothing.*`shown = print\(total\)`/)
    const none = value('NoneType', 'None')
    const shown = mem('7', { objects: [none], bindings: [{ name: 'shown', target: none.id }] })
    const bracket = { ...ev([mem('5'), mem('6'), seven, shown], ['int', '7', '7'], ['list', '[10, 20]', '[10, 20]']), last: line('[10, 20]', th('list', '[10, 20]')) }
    expect(guidance(s1Ideas, bracket).text).toMatch(/built and let go/)
  })

  it('praises only what memory shows, however the step was reached', () => {
    const e = ev([mem('5'), mem('6'), mem('7')], ['int', '7', '7'])
    expect(script(s1Ideas, e).items[0]!.text).toMatch(/`total` points at `7` now/)
  })
})
