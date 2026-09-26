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

/** Evidence from accepted lines, each beside the memory it left, as the
 *  workbench builds it: the steps that name a kind of line read `lines`. */
const run = (steps: [string, MemorySnapshot][], ...said: [string, string, string][]): Evidence => ({
  ...ev(
    steps.map(([, m]) => m),
    ...said,
  ),
  lines: steps.map(([source, memory]) => ({ source, memory })),
})

/** `(1, inner)`: slot 1 always points at the list `i`, whatever it holds. */
const TUPLE = (): PyObject => ({
  id: 't',
  type: 'tuple',
  kind: 'reference',
  repr: '2 items',
  elements: [
    { label: '0', target: value('int', '1').id },
    { label: '1', target: 'i' },
  ],
  partial: false,
})

/** Every step done, in play order. */
const PLAY: [string, MemorySnapshot][] = [
  ['nums = [1, 2]', mem({ a: [1, 2] }, { nums: 'a' })],
  ['other = nums', mem({ a: [1, 2] }, { nums: 'a', other: 'a' })],
  ['nums.append(3)', mem({ a: [1, 2, 3] }, { nums: 'a', other: 'a' })],
  ['[1, 2, 3]', mem({ a: [1, 2, 3] }, { nums: 'a', other: 'a' })],
  ['nums = nums + [4]', mem({ a: [1, 2, 3], b: [1, 2, 3, 4] }, { nums: 'b', other: 'a' })],
  ['other = [3, 1, 2]', mem({ b: [1, 2, 3, 4], c: [3, 1, 2] }, { nums: 'b', other: 'c' })],
  ['other.sort()', mem({ b: [1, 2, 3, 4], c: [1, 2, 3] }, { nums: 'b', other: 'c' })],
  ['other = other.sort()', mem({ b: [1, 2, 3, 4] }, { nums: 'b', other: NONE.id }, [NONE])],
  ['other = nums', mem({ b: [1, 2, 3, 4] }, { nums: 'b', other: 'b' })],
  ['nums += [5]', mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b' })],
  ['n = 10', mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b', n: TEN.id }, [TEN])],
  ['m = n', mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b', n: TEN.id, m: TEN.id }, [TEN])],
  ['n += 1', mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b', n: ELEVEN.id, m: TEN.id }, [TEN, ELEVEN])],
  ['inner = [2]', mem({ b: [1, 2, 3, 4, 5], i: [2] }, { nums: 'b', other: 'b', n: ELEVEN.id, m: TEN.id, inner: 'i' }, [TEN, ELEVEN])],
  [
    'pair = (1, inner)',
    mem({ b: [1, 2, 3, 4, 5], i: [2] }, { nums: 'b', other: 'b', n: ELEVEN.id, m: TEN.id, inner: 'i', pair: 't' }, [TEN, ELEVEN, TUPLE()]),
  ],
  [
    'inner.append(3)',
    mem({ b: [1, 2, 3, 4, 5], i: [2, 3] }, { nums: 'b', other: 'b', n: ELEVEN.id, m: TEN.id, inner: 'i', pair: 't' }, [TEN, ELEVEN, TUPLE()]),
  ],
]
const SAID: [string, string, string] = ['list', '[1, 2, 3]', '[1, 2, 3]']

describe('s2-ideas', () => {
  it('opens on Mira’s changed list, before its first question', () => {
    const s = script(s2Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('swears she didn’t touch it')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Make a list: type `nums = [1, 2]`.' })
  })

  it('walks change, the prediction, the move, sort, None, += on a list and a number, and a tuple', () => {
    const at = (n: number, said = true) => progress(s2Ideas, run(PLAY.slice(0, n), ...(said ? [SAID] : [])))
    expect(at(1, false)).toBe(1)
    expect(at(2, false)).toBe(2)
    expect(at(3, false)).toBe(3)
    // The robot looking at `other` is not a prediction; a typed list is.
    expect(progress(s2Ideas, run(PLAY.slice(0, 3), ['list', '[1, 2, 3]', 'other']))).toBe(3)
    expect(at(4)).toBe(4)
    expect(at(5)).toBe(5)
    expect(at(6)).toBe(5)
    expect(at(7)).toBe(6)
    expect(at(8)).toBe(7)
    expect(at(9)).toBe(7)
    expect(at(10)).toBe(8)
    expect(at(12)).toBe(8)
    expect(at(13)).toBe(9)
    expect(at(15)).toBe(9)
    expect(at(16)).toBe(s2Ideas.steps.length)
  })

  it('does not count a rebinding as the change, or += on a list as the move', () => {
    const at = (e: Evidence) => progress(s2Ideas, e)
    const two = PLAY.slice(0, 2)
    // `nums = nums + [3]`: a new list, and `other` left on the old one.
    expect(at(run([...two, ['nums = nums + [3]', mem({ a: [1, 2], b: [1, 2, 3] }, { nums: 'b', other: 'a' })]]))).toBe(2)
    // `nums += [4]` where the move was asked: both names see it, so no move.
    const changed = PLAY.slice(0, 3)
    const plus: [string, MemorySnapshot] = ['nums += [4]', mem({ a: [1, 2, 3, 4] }, { nums: 'a', other: 'a' })]
    expect(at(run([...changed, plus], SAID))).toBe(4)
    // …and the asked-for line after that detour still finishes the step.
    const after: [string, MemorySnapshot] = ['nums = nums + [4]', mem({ a: [1, 2, 3, 4], b: [1, 2, 3, 4, 4] }, { nums: 'b', other: 'a' })]
    expect(at(run([...changed, plus, after], SAID))).toBe(5)
  })

  it('asks the line that did it, where the praise names one', () => {
    const at = (e: Evidence) => progress(s2Ideas, e)
    // Two names pointed at a list typed out with a 3 in it: no change seen.
    const typedOut: [string, MemorySnapshot][] = [
      PLAY[0]!,
      ['nums = [1, 2, 3]', mem({ z: [1, 2, 3] }, { nums: 'z' })],
      ['other = nums', mem({ z: [1, 2, 3] }, { nums: 'z', other: 'z' })],
    ]
    expect(at(run(typedOut))).toBe(2)
    // `nums = nums + [5]` then `other = nums`: the same memory as `+=`, but no `+=`.
    const upToPlus = PLAY.slice(0, 9)
    const noPlus: [string, MemorySnapshot][] = [
      ...upToPlus,
      ['nums = nums + [5]', mem({ b: [1, 2, 3, 4], d: [1, 2, 3, 4, 5] }, { nums: 'd', other: 'b' })],
      ['other = nums', mem({ d: [1, 2, 3, 4, 5] }, { nums: 'd', other: 'd' })],
    ]
    expect(at(run(noPlus, SAID))).toBe(7)
    // `n = 11`, then `m = 10`: the number step's memory with no `+=`.
    const upToN = PLAY.slice(0, 10)
    const handN: [string, MemorySnapshot][] = [
      ...upToN,
      ['n = 11', mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b', n: ELEVEN.id }, [ELEVEN])],
      ['m = 10', mem({ b: [1, 2, 3, 4, 5] }, { nums: 'b', other: 'b', n: ELEVEN.id, m: TEN.id }, [TEN, ELEVEN])],
    ]
    expect(at(run(handN, SAID))).toBe(8)
    // `.sort()` on a list already in order, or the sorted list typed out.
    const typedSorted: [string, MemorySnapshot][] = [
      ...PLAY.slice(0, 5),
      ['other = [1, 2, 3]', mem({ b: [1, 2, 3, 4], c: [1, 2, 3] }, { nums: 'b', other: 'c' })],
    ]
    expect(at(run(typedSorted, SAID))).toBe(5)
    // The tuple typed out whole: nothing changed inside it.
    const whole: [string, MemorySnapshot][] = [
      ...PLAY.slice(0, 14),
      ['pair = (1, inner)', PLAY[14]![1]],
      ['pair = (1, [2, 3])', PLAY[15]![1]],
    ]
    expect(at(run(whole, SAID))).toBe(8 + 1)
  })

  it('answers a prediction that asked the robot, or moved both names', () => {
    const base = run(PLAY.slice(0, 3))
    expect(progress(s2Ideas, base)).toBe(3)
    const looked = guidance(s2Ideas, { ...base, last: line('other', th('list', '[1, 2, 3]')) })
    expect(looked.text).toContain('Predict it first')
    const both = guidance(s2Ideas, { ...base, last: line('[1, 2, 3, 4]', th('list', '[1, 2, 3, 4]')) })
    expect(both.text).toContain('only `nums` moves')
  })

  it('answers a list typed out afresh where the shared one was to change', () => {
    const e = run(PLAY.slice(0, 2))
    expect(guidance(s2Ideas, { ...e, last: line('nums = [1, 2, 3]', null) }).text).toContain('Point it back with `nums = other`')
  })

  it('says a bare list was let go, at the first step', () => {
    expect(guidance(s2Ideas, typed(line('[1, 2]', th('list', '[1, 2]')))).text).toContain('thought of and let go')
  })

  it('says None is never shown, when `.sort()` is asked bare at the trap', () => {
    const e: Evidence = { ...run(PLAY.slice(0, 7), SAID), last: line('other.sort()', null) }
    expect(progress(s2Ideas, e)).toBe(6)
    expect(guidance(s2Ideas, e).text).toContain('shows nothing for `None`')
  })

})
