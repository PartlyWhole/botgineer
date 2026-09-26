/**
 * Stage 5's ideas, as a lesson: memory in, step out. The prediction steps
 * are the ones to guard — each must take a typed literal and nothing that
 * got the robot to do the working — and each "run it" step must be judged
 * on what the loop left behind, not on a value typed in.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s5Ideas, script, type Evidence, type LineMemory } from '../../../content/lessons'
import type { MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, madeBy, snap, th, typed, value } from './fixtures'

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

/** Mira's loop, with `total = 0` inside the body. */
const BUG = 'for p in parcels:\n    total = 0\n    total = total + p'

const P = [5, 7, 4]

describe('s5-ideas', () => {
  it('opens on Mira’s wrong total, before its first question', () => {
    const s = script(s5Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('the total comes out wrong')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Type `parcels = [5, 7, 4]`.' })
  })

  it('walks the accumulator, the pass count, the loop name, range, break and removal', () => {
    const at = (e: Evidence) => progress(s5Ideas, e)
    const h: Entry[] = [mem({ parcels: P })]
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
    // Mira's loop, predicted: a 4 said before the 16 is not this answer.
    expect(at(ev(h, ['int', '4', '4'], ...said))).toBe(4)
    said.push(['int', '4', '4'])
    expect(at(ev(h, ...said))).toBe(5)
    // `total = 4` typed bare leaves her loop's memory without her loop.
    expect(at(ev([...h, by('total = 4', mem({ parcels: P, total: 4, p: 4 }))], ...said))).toBe(5)
    h.push(by(BUG, mem({ parcels: P, total: 4, p: 4 })))
    expect(at(ev(h, ...said))).toBe(6)
    said.push(['int', '3', '3'])
    expect(at(ev(h, ...said))).toBe(7)
    // Doubling the slots is not what the body does.
    expect(at(ev([...h, mem({ parcels: [10, 14, 8], total: 4, p: 8 })], ...said))).toBe(7)
    h.push(mem({ parcels: P, total: 4, p: 8 }))
    expect(at(ev(h, ...said))).toBe(8)
    // Typing the list out is not range.
    expect(at(ev(h, ...said, ['list', '[0, 3, 6]', '[0, 3, 6]']))).toBe(8)
    said.push(['list', '[0, 3, 6]', 'list(range(0, 9, 3))'])
    expect(at(ev(h, ...said))).toBe(9)
    h.push(mem({ parcels: P, total: 4, p: 5 }))
    expect(at(ev(h, ...said))).toBe(10)
    said.push(['list', '[7]', '[7]'])
    expect(at(ev(h, ...said))).toBe(11)
    // Typing `parcels = [7]` is not the loop: the loop leaves `p` at `4`.
    expect(at(ev([...h, mem({ parcels: [7], total: 4, p: 5 })], ...said))).toBe(11)
    h.push(mem({ parcels: [7], total: 4, p: 4 }))
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
      by(BUG, mem({ parcels: P, total: 4, p: 4 })),
      mem({ parcels: P, total: 4, p: 8 }),
      mem({ parcels: P, total: 4, p: 5 }),
    ]
    const e = ev(h, ['int', '16', '16'], ['int', '4', '4'], ['int', '3', '3'], ['list', '[0, 3, 6]', 'list(range(0, 9, 3))'])
    expect(progress(s5Ideas, e)).toBe(10)
    // The break loop that finished the step before is not a miss here.
    expect(script(s5Ideas, madeBy(e, line('for p in parcels:\n    break', null))).items.at(-1)!.kind).toBe('ask')
    // As the workbench reports it, the guess is the newest thought.
    const guess = { ...e, thoughts: [...e.thoughts, { ...th('list', '[]'), source: '[]' }], last: line('[]', th('list', '[]')) }
    expect(guidance(s5Ideas, guess).text).toContain('slides the rest left')
  })

  it('asks the question, not a reply, when it arrives after the line before', () => {
    const e = ev([mem({ parcels: P }), mem({ parcels: P, total: 0 })])
    expect(script(s5Ideas, madeBy(e, line('total = 0', null))).items.at(-1)!.kind).toBe('ask')
    // Typed again, it did no step, and the robot is not the one to predict.
    const again = ev([mem({ parcels: P }), mem({ parcels: P, total: 0 }), mem({ parcels: P, total: 0 })])
    expect(guidance(s5Ideas, madeBy(again, line('total = 0', null))).text).toContain('Predict it first')
  })

  it('names a bare range, a tuple for a list, and Mira’s total typed by hand', () => {
    expect(guidance(s5Ideas, typed(line('parcels = 5, 7, 4', null))).text).toContain('Square brackets')
    const h = [mem({ parcels: P }), mem({ parcels: P, total: 0 }), mem({ parcels: P, total: 16, p: 4 })]
    const bug = ev(h, ['int', '16', '16'], ['int', '4', '4'])
    expect(guidance(s5Ideas, { ...bug, last: line('total = 4', null) }).text).toContain('Let the loop do it')
    const three: [string, string, string][] = [['int', '16', '16'], ['int', '4', '4'], ['int', '3', '3']]
    const bare = ['range', 'range(0, 9, 3)', 'range(0, 9, 3)'] as [string, string, string]
    const r = ev([...h, by(BUG, mem({ parcels: P, total: 4, p: 4 })), mem({ parcels: P, total: 4, p: 8 })], ...three, bare)
    expect(progress(s5Ideas, r)).toBe(8)
    expect(guidance(s5Ideas, { ...r, last: line('range(0, 9, 3)', th('range', 'range(0, 9, 3)')) }).text).toContain('wrap it in')
  })

  it('never lets a bare expression through the first step', () => {
    expect(progress(s5Ideas, typed(line('[5, 7, 4]', th('list', '[5, 7, 4]'))))).toBe(0)
  })
})
