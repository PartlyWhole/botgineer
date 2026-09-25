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

const list = (uid: string): PyObject => ({ id: uid, type: 'list', kind: 'reference', repr: '[10, 20]', elements: [], partial: false })

/** Memory with `total` at this value, plus whatever else is given. */
const mem = (total: string | null, extra: { objects?: PyObject[]; bindings?: { name: string; target: string }[] } = {}): MemorySnapshot => {
  const t = total === null ? [] : [bound('total', 'int', total)]
  return snap(
    [...t.map((b) => b.object), ...(extra.objects ?? [])],
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
    expect(s.items[0]!.text).toContain('other people write the programs')
    expect(s.items[1]!.text).toContain('before it does it')
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
})
