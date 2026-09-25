/**
 * Stage 7's ideas, as a lesson: memory in, step out. The two predictions
 * are the ones to guard — each must take a typed number, never the
 * robot's working — and the grid steps must tell one shared row from two.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s7Ideas, script, type Evidence } from '../../../content/lessons'
import type { Binding, MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, snap, th, value } from './fixtures'

const int = (n: number) => value('int', String(n))
const list = (uid: string, items: string[] = []): PyObject => ({
  id: uid,
  type: 'list',
  kind: 'reference',
  repr: `[${items.map(() => '[]').join(', ')}]`,
  elements: items.map((target) => ({ label: null, target })),
  partial: false,
})

/** Memory from name → int pairs, plus any lists and list bindings. */
const mem = (ints: Record<string, number>, lists: PyObject[] = [], refs: Record<string, string> = {}): MemorySnapshot => {
  const objects = [...Object.values(ints).map(int), ...lists]
  const bindings: Binding[] = [
    ...Object.entries(ints).map(([name, n]) => ({ name, scope: 'global', target: int(n).id })),
    ...Object.entries(refs).map(([name, target]) => ({ name, scope: 'global', target })),
  ]
  return snap(objects, bindings)
}

const ev = (history: MemorySnapshot[], ...said: [string, string][]): Evidence => ({
  snapshot: history[history.length - 1]!,
  history,
  thoughts: said.map(([repr, source]) => ({ ...th('int', repr), source })),
})

const printed = mem({ r: 1, c: 1 })
const zero = mem({ r: 1, c: 1, n: 0 })
const six = mem({ r: 2, c: 1, n: 6 })
const searched = mem({ r: 2, c: 1, n: 6, shelf: 2, spot: 0 })
const lists = (grid: PyObject, ...more: PyObject[]) =>
  mem({ r: 1, c: 1, n: 6, shelf: 2, spot: 0 }, [grid, ...more], { grid: grid.id, row: 'row' })

describe('s7-ideas', () => {
  it('opens on Mira’s search, before its first question', () => {
    const s = script(s7Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('carried on looking through every other shelf')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask' })
    expect(s.items[s.rest]!.text).toContain('for c in range(2): print(r, c)')
  })

  it('walks the order, the count, break and the rows', () => {
    const at = (e: Evidence) => progress(s7Ideas, e)
    expect(at(ev([printed]))).toBe(1)
    expect(at(ev([printed, zero]))).toBe(2)
    // Running the block is not the prediction; typing 6 is.
    expect(at(ev([printed, zero, six]))).toBe(2)
    expect(at(ev([printed, zero], ['6', '6']))).toBe(3)
    expect(at(ev([printed, zero, six], ['6', '6']))).toBe(4)
    expect(at(ev([printed, zero, six], ['6', '6'], ['2', '2']))).toBe(5)
    expect(at(ev([printed, zero, six, searched], ['6', '6'], ['2', '2']))).toBe(6)

    const said: [string, string][] = [['6', '6'], ['2', '2']]
    const before = [printed, zero, six, searched]
    const emptyGrid = list('g1')
    const row = list('row')
    const two = lists(emptyGrid, row)
    expect(at(ev([...before, two], ...said))).toBe(7)
    const shared = lists(list('g1', ['row', 'row']), row)
    expect(at(ev([...before, two, shared], ...said))).toBe(8)
    const fresh = lists(list('g2', ['n1', 'n2']), row, list('n1'), list('n2'))
    expect(at(ev([...before, two, shared, fresh], ...said))).toBe(s7Ideas.steps.length)
  })

  it('does not take a 2 said before the count’s prediction as the break’s', () => {
    // A 2 is a likely miss at the count, and it must not answer shelf early.
    const e = ev([printed, zero, six], ['2', '2'], ['6', '6'])
    expect(progress(s7Ideas, e)).toBe(4)
  })

  it('does not take one shared row for two fresh ones', () => {
    const before = [printed, zero, six, searched]
    const said: [string, string][] = [['6', '6'], ['2', '2']]
    const row = list('row')
    const shared = lists(list('g1', ['row', 'row']), row)
    expect(progress(s7Ideas, ev([...before, lists(list('g1'), row), shared, shared], ...said))).toBe(8)
  })

  it('does not answer the line that finished the step before as a miss', () => {
    // A memory step moves on without a thought, so the next step's reply
    // is asked about that very line: it must not match it.
    const counting = 'for r in range(3):\n    for c in range(2): n = n + 1'
    const e = { ...ev([printed, zero, six], ['6', '6']), last: line(counting, null) }
    expect(progress(s7Ideas, e)).toBe(4)
    expect(guidance(s7Ideas, e).text).toBe(s7Ideas.steps[4]!.say)
    const z = { ...ev([printed, zero]), last: line('n = 0', null) }
    expect(guidance(s7Ideas, z).text).toBe(s7Ideas.steps[2]!.say)
  })

  it('answers the misses a nested loop invites', () => {
    const reply = (e: Evidence) => guidance(s7Ideas, e).text
    expect(reply({ ...ev([printed, zero], ['5', '5']), last: line('5', th('int', '5')) })).toContain('Multiply')
    expect(reply({ ...ev([printed, zero], ['3', '3']), last: line('3', th('int', '3')) })).toContain('counts one loop')
    expect(reply({ ...ev([printed, zero], ['0', 'n']), last: line('n', th('int', '0')) })).toContain('Predict it first')
    const shelf = ev([printed, zero, six], ['6', '6'], ['0', '0'])
    expect(reply({ ...shelf, last: line('0', th('int', '0')) })).toContain('left both loops')
    expect(reply({ ...NOTHING, last: failed('for r in range(2):\nfor c in range(2): print(r, c)', 'IndentationError') })).toContain(
      'four spaces',
    )
    expect(reply({ ...NOTHING, last: failed('for r in range(2): for c in range(2): print(r, c)', 'SyntaxError') })).toContain(
      'same line',
    )
  })
})
