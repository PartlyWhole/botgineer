/**
 * Stage 8's ideas, as a lesson: memory in, step out. The steps to guard
 * are the two predictions — each must take a typed number and nothing
 * that got the robot to do the working — and the runs, which must have
 * been the call itself.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s8Ideas, script } from '../../../content/lessons'
import type { Binding, MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, madeBy, snap, th, typed, value } from './fixtures'
import type { Evidence, LineMemory } from '../../../content/lessons'

const fn = (uid: string, name: string, defaults: string[] = []): PyObject => ({
  id: uid,
  type: 'function',
  kind: 'reference',
  repr: `function ${name}`,
  elements: defaults.length ? defaults.map((target, i) => ({ label: `default ${i + 1}`, target })) : null,
  partial: false,
})

const list = (uid: string, items: string[]): PyObject => ({
  id: uid,
  type: 'list',
  kind: 'reference',
  repr: `${items.length} items`,
  elements: items.map((target, i) => ({ label: String(i), target })),
  partial: false,
})

const g = (name: string, target: string): Binding => ({ name, scope: 'global', target })

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

const five = value('int', '5')
const a = value('str', "'a'")
const b = value('str', "'b'")
const x = value('str', "'x'")
const y = value('str', "'y'")

describe('s8-ideas', () => {
  it('opens on Mira’s problem, before its first question', () => {
    const s = script(s8Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('came back changed')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Type `def double(n):`, then `n = n * 2` and `return n`, both indented under it.' })
  })

  it('names argument and parameter on beats of their own, after the first call', () => {
    const said = s8Ideas.steps.flatMap((st) => (st.beats ?? []).map((bt) => bt.say))
    const arg = said.findIndex((t) => t.includes('**argument**'))
    const par = said.findIndex((t) => t.includes('**parameter**'))
    expect(arg).toBeGreaterThan(0)
    expect(par).toBe(arg + 1)
    // Neither word is used before its beat.
    for (const t of said.slice(0, arg)) expect(t).not.toMatch(/argument|parameter/)
  })

  it('keeps every ask to one short line', () => {
    for (const st of s8Ideas.steps) expect(st.say.length, st.say).toBeLessThanOrEqual(110)
  })

  it('walks def, the prediction, the call, the shared list and the shared default', () => {
    const at = (e: Evidence) => progress(s8Ideas, e)
    const dbl = fn('u1', 'double')
    const m1 = snap([dbl], [g('double', 'u1')])
    expect(at(ev([m1]))).toBe(1)

    const m2 = snap([dbl, five], [g('double', 'u1'), g('x', five.id)])
    expect(at(ev([m1, m2]))).toBe(2)
    // Running it is not a prediction.
    expect(at(ev([m1, m2], ['int', '10', 'double(x)']))).toBe(2)
    const said: [string, string, string][] = [['int', '5', '5']]
    expect(at(ev([m1, m2], ...said))).toBe(3)
    // A `10` typed by hand is not the call: the robot must work it out.
    expect(at(ev([m1, m2], ...said, ['int', '10', '10']))).toBe(3)
    said.push(['int', '10', 'double(x)'])
    expect(at(ev([m1, m2], ...said))).toBe(4)

    const dflt = list('u3', [])
    const add = fn('u4', 'add', ['u3'])
    const baseB = [g('double', 'u1'), g('x', five.id), g('add', 'u4')]
    const m3 = snap([dbl, five, add, dflt], baseB)
    expect(at(ev([m1, m2, m3], ...said))).toBe(5)

    const things = list('u5', [a.id, b.id])
    const m4 = snap([dbl, five, add, dflt, things, a, b], [...baseB, g('things', 'u5'), g('same', 'u5')])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(6)
    // The run before the prediction does not count as one.
    expect(at(ev([m1, m2, m3, m4], ...said, ['list', "['x', 'y']", 'add("y")']))).toBe(6)
    said.push(['int', '2', '2'])
    expect(at(ev([m1, m2, m3, m4], ...said))).toBe(7)

    // One call is not yet the shared default.
    const two = by('2', m4)
    const one = list('u3', [x.id])
    const m5 = by('add("x")', snap([dbl, five, add, one, things, a, b, x], [...baseB, g('things', 'u5'), g('same', 'u5')]))
    expect(at(ev([m1, m2, m3, m4, two, m5], ...said))).toBe(7)
    const full = list('u3', [x.id, y.id])
    const m6 = by('add("y")', snap([dbl, five, add, full, things, a, b, x, y], [...baseB, g('things', 'u5'), g('same', 'u5')]))
    expect(at(ev([m1, m2, m3, m4, two, m5, m6], ...said))).toBe(s8Ideas.steps.length)
  })

  it('counts only the checks made after their predictions', () => {
    const dbl = fn('u1', 'double')
    const m1 = snap([dbl], [g('double', 'u1')])
    const m2 = snap([dbl, five], [g('double', 'u1'), g('x', five.id)])
    // `double(x)` run while predicting, then 5: the check is still owed.
    const early = ev([m1, m2], ['int', '10', 'double(x)'], ['int', '5', '5'])
    expect(progress(s8Ideas, early)).toBe(3)
    // `add("x")` run while predicting, then 2, then one more `add("x")`:
    // the default holds two, but `add("y")` never ran after the 2.
    const dflt = list('u3', [x.id])
    const add = fn('u4', 'add', ['u3'])
    const things = list('u5', [a.id, b.id])
    const base = [g('double', 'u1'), g('x', five.id), g('add', 'u4'), g('things', 'u5'), g('same', 'u5')]
    const m4 = by('add("x")', snap([dbl, five, add, dflt, things, a, b, x], base))
    const xx = by('add("x")', snap([dbl, five, add, list('u3', [x.id, x.id]), things, a, b, x], base))
    const said: [string, string, string][] = [['int', '5', '5'], ['int', '10', 'double(x)'], ['int', '2', '2']]
    expect(progress(s8Ideas, ev([m1, m2, m4, by('2', m4.memory), xx], ...said))).toBe(7)
  })

  it('arrives at each question asking it, not answering the line that did the step before', () => {
    const dbl = fn('u1', 'double')
    const m1 = snap([dbl], [g('double', 'u1')])
    const m2 = snap([dbl, five], [g('double', 'u1'), g('x', five.id)])
    const atPredict = guidance(s8Ideas, madeBy(ev([m1, m2]), line('x = 5', null)))
    expect(atPredict.text).toBe(s8Ideas.steps[2]!.say)
    const dflt = list('u3', [])
    const add = fn('u4', 'add', ['u3'])
    const things = list('u5', [a.id, b.id])
    const m4 = snap([dbl, five, add, dflt, things, a, b], [g('double', 'u1'), g('x', five.id), g('add', 'u4'), g('things', 'u5'), g('same', 'u5')])
    const said: [string, string, string][] = [['int', '5', '5'], ['int', '10', 'double(x)']]
    const atDefault = guidance(s8Ideas, madeBy(ev([m4], ...said), line('same = add("b", things)', null)))
    expect(atDefault.text).toBe(s8Ideas.steps[6]!.say)
    // Typed again, it did no step: the call was run instead of predicted.
    const again = guidance(s8Ideas, madeBy(ev([m4, m4], ...said), line('same = add("b", things)', null)))
    expect(again.text).toContain('Predict it first')
  })

  it('answers a block that was not indented', () => {
    expect(guidance(s8Ideas, typed(failed('def double(n):\nn = n * 2', 'IndentationError'))).text).toContain('Indent the body')
  })

  it('answers a prediction that ran the call, or guessed the parameter moved x', () => {
    const dbl = fn('u1', 'double')
    const m = snap([dbl, five], [g('double', 'u1'), g('x', five.id)])
    const base = ev([m])
    expect(progress(s8Ideas, base)).toBe(2)
    const ran = guidance(s8Ideas, {
      ...base,
      thoughts: [{ ...th('int', '10'), source: 'double(x)' }],
      last: line('double(x)', th('int', '10')),
    })
    expect(ran.text).toContain('Predict it first')
    const ten = guidance(s8Ideas, {
      ...base,
      thoughts: [{ ...th('int', '10'), source: '10' }],
      last: line('10', th('int', '10')),
    })
    expect(ten.text).toContain('which name')
  })
})
