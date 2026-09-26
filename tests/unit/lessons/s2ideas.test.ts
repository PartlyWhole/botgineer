/**
 * Stage 2's ideas, as a lesson: memory in, step out. The run steps judge
 * the event — which arrow moved, which list changed — read from the
 * cards' slots, because a list's own repr in memory is only "3 items".
 * The prediction must be a typed list, never the robot looking.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s2Ideas, script, type Evidence } from '../../../content/lessons'
import type { MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, line, snap, th, typed, value } from './fixtures'

/** A list as memory holds it: slots pointing at int cards. */
const list = (uid: string, items: number[]): PyObject[] => {
  const ints = items.map((n) => value('int', String(n)))
  return [
    {
      id: uid,
      type: 'list',
      kind: 'reference',
      repr: `${items.length} items`,
      elements: ints.map((o, i) => ({ label: String(i), target: o.id })),
      partial: false,
    },
    ...ints,
  ]
}

/** Memory from lists by uid and names by target. */
const mem = (lists: Record<string, number[]>, names: Record<string, string>, extra: PyObject[] = []): MemorySnapshot =>
  snap(
    [...Object.entries(lists).flatMap(([uid, items]) => list(uid, items)), ...extra],
    Object.entries(names).map(([name, target]) => ({ name, scope: 'global', target })),
  )

const NONE = value('NoneType', 'None')
const TEN = value('int', '10')
const ELEVEN = value('int', '11')

const ev = (history: MemorySnapshot[], ...said: [string, string, string][]): Evidence => ({
  snapshot: history[history.length - 1]!,
  history,
  thoughts: said.map(([type, repr, source]) => ({ ...th(type, repr), source })),
})

describe('s2-ideas', () => {
  it('opens on Mira’s changed list, before its first question', () => {
    const s = script(s2Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('swears she didn’t touch it')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Make a list: type `nums = [1, 2]`.' })
  })

  it('walks change, the prediction, the move, None, and += on a list and a number', () => {
    const at = (e: Evidence) => progress(s2Ideas, e)
    const h: MemorySnapshot[] = [mem({ a: [1, 2] }, { nums: 'a' })]
    expect(at(ev(h))).toBe(1)
    h.push(mem({ a: [1, 2] }, { nums: 'a', other: 'a' }))
    expect(at(ev(h))).toBe(2)
    h.push(mem({ a: [1, 2, 3] }, { nums: 'a', other: 'a' }))
    expect(at(ev(h))).toBe(3)
    // The robot looking at `other` is not a prediction; a typed list is.
    expect(at(ev(h, ['list', '[1, 2, 3]', 'other']))).toBe(3)
    const said: [string, string, string][] = [['list', '[1, 2, 3]', '[1, 2, 3]']]
    expect(at(ev(h, ...said))).toBe(4)
    h.push(mem({ a: [1, 2, 3], b: [1, 2, 3, 4] }, { nums: 'b', other: 'a' }))
    expect(at(ev(h, ...said))).toBe(5)
    h.push(mem({ b: [1, 2, 3, 4] }, { nums: 'b', other: NONE.id }, [NONE]))
    expect(at(ev(h, ...said))).toBe(6)
    h.push(mem({ b: [1, 2, 3, 4] }, { nums: 'b', other: 'b' }))
    expect(at(ev(h, ...said))).toBe(6)
    h.push(mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b' }))
    expect(at(ev(h, ...said))).toBe(7)
    h.push(mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b', n: TEN.id, m: TEN.id }, [TEN]))
    expect(at(ev(h, ...said))).toBe(7)
    h.push(mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b', n: ELEVEN.id, m: TEN.id }, [TEN, ELEVEN]))
    expect(at(ev(h, ...said))).toBe(s2Ideas.steps.length)
  })

  it('does not count a rebinding as the change, or += on a list as the move', () => {
    const at = (e: Evidence) => progress(s2Ideas, e)
    const two = [mem({ a: [1, 2] }, { nums: 'a' }), mem({ a: [1, 2] }, { nums: 'a', other: 'a' })]
    // `nums = nums + [3]`: a new list, and `other` left on the old one.
    expect(at(ev([...two, mem({ a: [1, 2], b: [1, 2, 3] }, { nums: 'b', other: 'a' })]))).toBe(2)
    // `nums += [4]` where the move was asked: both names see it, so no move.
    const changed = [...two, mem({ a: [1, 2, 3] }, { nums: 'a', other: 'a' })]
    const said: [string, string, string] = ['list', '[1, 2, 3]', '[1, 2, 3]']
    expect(at(ev([...changed, mem({ a: [1, 2, 3, 4] }, { nums: 'a', other: 'a' })], said))).toBe(4)
    // …and the asked-for line after that detour still finishes the step.
    const after = mem({ a: [1, 2, 3, 4], b: [1, 2, 3, 4, 4] }, { nums: 'b', other: 'a' })
    expect(at(ev([...changed, mem({ a: [1, 2, 3, 4] }, { nums: 'a', other: 'a' }), after], said))).toBe(5)
  })

  it('answers a prediction that asked the robot, or moved both names', () => {
    const h = [mem({ a: [1, 2, 3] }, { nums: 'a', other: 'a' })]
    const base: Evidence = { ...ev([mem({ a: [1, 2] }, { nums: 'a' }), mem({ a: [1, 2] }, { nums: 'a', other: 'a' }), ...h]) }
    expect(progress(s2Ideas, base)).toBe(3)
    const looked = guidance(s2Ideas, { ...base, last: line('other', th('list', '[1, 2, 3]')) })
    expect(looked.text).toContain('Predict it first')
    const both = guidance(s2Ideas, { ...base, last: line('[1, 2, 3, 4]', th('list', '[1, 2, 3, 4]')) })
    expect(both.text).toContain('only `nums` moves')
  })

  it('says a bare list was let go, at the first step', () => {
    expect(guidance(s2Ideas, typed(line('[1, 2]', th('list', '[1, 2]')))).text).toContain('thought of and let go')
  })

  it('says None is never shown, when `.sort()` is asked bare', () => {
    const h = [
      mem({ a: [1, 2] }, { nums: 'a' }),
      mem({ a: [1, 2] }, { nums: 'a', other: 'a' }),
      mem({ a: [1, 2, 3] }, { nums: 'a', other: 'a' }),
      mem({ a: [1, 2, 3], b: [1, 2, 3, 4] }, { nums: 'b', other: 'a' }),
    ]
    const e: Evidence = { ...ev(h, ['list', '[1, 2, 3]', '[1, 2, 3]']), last: line('other.sort()', null) }
    expect(progress(s2Ideas, e)).toBe(5)
    expect(guidance(s2Ideas, e).text).toContain('shows nothing for `None`')
  })
})
