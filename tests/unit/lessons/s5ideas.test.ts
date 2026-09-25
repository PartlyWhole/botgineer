/**
 * Stage 5's ideas, as a lesson: memory in, step out. The prediction steps
 * are the ones to guard — each must take a typed literal and nothing that
 * got the robot to do the working — and each "run it" step must be judged
 * on what the loop left behind, not on a value typed in.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s5Ideas, script, type Evidence } from '../../../content/lessons'
import type { MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, snap, th, typed, value } from './fixtures'

const int = (n: number) => value('int', String(n))
const list = (uid: string, items: number[]): PyObject => ({
  id: uid,
  type: 'list',
  kind: 'reference',
  repr: `${items.length} items`,
  elements: items.map((n) => ({ label: null, target: `v:int:${n}` })),
  partial: false,
})

/** Memory with these names: a number, or a list (under its own uid). */
const mem = (names: Record<string, number | number[]>): MemorySnapshot => {
  const objects: PyObject[] = []
  const bindings = Object.entries(names).map(([name, v]) => {
    if (typeof v === 'number') {
      objects.push(int(v))
      return { name, scope: 'global', target: `v:int:${v}` }
    }
    const l = list(`u:${name}`, v)
    objects.push(l, ...v.map(int))
    return { name, scope: 'global', target: l.id }
  })
  return snap(objects, bindings)
}

const ev = (history: MemorySnapshot[], ...said: [string, string, string][]): Evidence => ({
  snapshot: history[history.length - 1]!,
  history,
  thoughts: said.map(([type, repr, source]) => ({ ...th(type, repr), source })),
})

const P = [5, 7, 4]

describe('s5-ideas', () => {
  it('opens on Mira’s wrong total, before its first question', () => {
    const s = script(s5Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('the total comes out wrong')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Type `parcels = [5, 7, 4]`.' })
  })

  it('walks the accumulator, the pass count, the loop name, range, break and removal', () => {
    const at = (e: Evidence) => progress(s5Ideas, e)
    const h: MemorySnapshot[] = [mem({ parcels: P })]
    const said: [string, string, string][] = []
    expect(at(ev(h))).toBe(1)
    h.push(mem({ parcels: P, total: 0 }))
    expect(at(ev(h))).toBe(2)
    // Running the loop is not a prediction; typing the number is.
    expect(at(ev([...h, mem({ parcels: P, total: 16, p: 4 })], ['int', '16', 'total']))).toBe(2)
    said.push(['int', '16', '16'])
    expect(at(ev(h, ...said))).toBe(3)
    // Typing `total = 16` is not the loop: the loop leaves `p` behind.
    expect(at(ev([...h, mem({ parcels: P, total: 16 })], ...said))).toBe(3)
    h.push(mem({ parcels: P, total: 16, p: 4 }))
    expect(at(ev(h, ...said))).toBe(4)
    said.push(['int', '3', '3'])
    expect(at(ev(h, ...said))).toBe(5)
    // Doubling the slots is not what the body does.
    expect(at(ev([...h, mem({ parcels: [10, 14, 8], total: 16, p: 8 })], ...said))).toBe(5)
    h.push(mem({ parcels: P, total: 16, p: 8 }))
    expect(at(ev(h, ...said))).toBe(6)
    // Typing the list out is not range.
    expect(at(ev(h, ...said, ['list', '[0, 3, 6]', '[0, 3, 6]']))).toBe(6)
    said.push(['list', '[0, 3, 6]', 'list(range(0, 9, 3))'])
    expect(at(ev(h, ...said))).toBe(7)
    h.push(mem({ parcels: P, total: 16, p: 5 }))
    expect(at(ev(h, ...said))).toBe(8)
    said.push(['list', '[7]', '[7]'])
    expect(at(ev(h, ...said))).toBe(9)
    // Typing `parcels = [7]` is not the loop: the loop leaves `p` at `4`.
    expect(at(ev([...h, mem({ parcels: [7], total: 16, p: 5 })], ...said))).toBe(9)
    h.push(mem({ parcels: [7], total: 16, p: 4 }))
    expect(at(ev(h, ...said))).toBe(s5Ideas.steps.length)
  })

  it('does not take a worked-out sum, or a named value, as a prediction', () => {
    const h = [mem({ parcels: P }), mem({ parcels: P, total: 0 })]
    expect(progress(s5Ideas, ev(h, ['int', '16', '5 + 7 + 4']))).toBe(2)
    expect(progress(s5Ideas, ev(h, ['int', '16', 'sum(parcels)']))).toBe(2)
  })

  it('answers the likely misses', () => {
    const h = [mem({ parcels: P }), mem({ parcels: P, total: 0 })]
    const base = ev(h)
    const reply = (l: ReturnType<typeof line>) => guidance(s5Ideas, { ...base, last: l }).text
    expect(reply(line('4', th('int', '4')))).toContain('only the last parcel')
    expect(reply(line('for p in parcels:\n    total = total + p', null))).toContain('Predict it first')
    const unindented = failed('for p in parcels:\ntotal = total + p', 'IndentationError')
    const d = ev([...h], ['int', '16', '16'])
    expect(guidance(s5Ideas, { ...d, last: unindented }).text).toContain('spaces in front')
  })

  it('names the empty-list guess when the list is changed while walked', () => {
    const h = [
      mem({ parcels: P }),
      mem({ parcels: P, total: 0 }),
      mem({ parcels: P, total: 16, p: 4 }),
      mem({ parcels: P, total: 16, p: 8 }),
      mem({ parcels: P, total: 16, p: 5 }),
    ]
    const e = ev(h, ['int', '16', '16'], ['int', '3', '3'], ['list', '[0, 3, 6]', 'list(range(0, 9, 3))'])
    expect(progress(s5Ideas, e)).toBe(8)
    // The break loop that finished the step before is not a miss here.
    expect(script(s5Ideas, { ...e, last: line('for p in parcels:\n    break', null) }).items.at(-1)!.kind).toBe('ask')
    // As the workbench reports it, the guess is the newest thought.
    const guess = { ...e, thoughts: [...e.thoughts, { ...th('list', '[]'), source: '[]' }], last: line('[]', th('list', '[]')) }
    expect(guidance(s5Ideas, guess).text).toContain('slides the rest left')
  })

  it('asks the question, not a reply, when it arrives after the line before', () => {
    const e = ev([mem({ parcels: P }), mem({ parcels: P, total: 0 })])
    expect(script(s5Ideas, { ...e, last: line('total = 0', null) }).items.at(-1)!.kind).toBe('ask')
  })

  it('never lets a bare expression through the first step', () => {
    expect(progress(s5Ideas, typed(line('[5, 7, 4]', th('list', '[5, 7, 4]'))))).toBe(0)
  })
})
