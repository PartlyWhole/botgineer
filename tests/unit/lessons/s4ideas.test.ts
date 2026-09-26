/**
 * Stage 4's ideas, as a lesson: memory in, step out. The three
 * predictions are the steps to guard — each must take a typed literal,
 * never a line that got the robot to read memory for you.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s4Ideas, script } from '../../../content/lessons'
import type { Evidence, LineMemory } from '../../../content/lessons'
import type { MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, madeBy, snap, th, typed, value } from './fixtures'

/** A list holding arrows to these objects. */
const list = (uid: string, ...targets: string[]): PyObject => ({
  id: uid,
  type: 'list',
  kind: 'reference',
  repr: `${targets.length} items`,
  elements: targets.map((target, i) => ({ label: String(i), target })),
  partial: false,
})

const s = (text: string) => value('str', `'${text}'`)
const i = (n: number) => value('int', String(n))
const STRS = ['Ann', 'Bo', 'Ed', 'Flo'].map(s)
const NUMS = [i(0), i(1)]

/** Memory from these lists and names; every str and int is always there. */
const mem = (lists: PyObject[], names: Record<string, string>): MemorySnapshot =>
  snap(
    [...STRS, ...NUMS, ...lists],
    Object.entries(names).map(([name, target]) => ({ name, scope: 'global', target })),
  )

const t1 = list('t1', STRS[0]!.id)
const t2 = list('t2', STRS[1]!.id)
const plan = list('p', 't1', 't2')
const PLAN = mem([plan, t1, t2], { plan: 'p' })
const aliased = mem([plan, t1, t2], { plan: 'p', new: 'p' })
const newer = list('n', 't1', 't2')
const SHALLOW = mem([plan, t1, t2, newer], { plan: 'p', new: 'n' })
const ed = list('t3', STRS[2]!.id)
const ADDED = mem([plan, t1, t2, list('n', 't1', 't2', 't3'), ed], { plan: 'p', new: 'n' })
const t1f = list('t1', STRS[0]!.id, STRS[3]!.id)
const n3 = list('n', 't1', 't2', 't3')
const SEATED = mem([plan, t1f, t2, n3, ed], { plan: 'p', new: 'n' })
const deep = [list('d', 'd1', 'd2'), list('d1', STRS[0]!.id, STRS[3]!.id), list('d2', STRS[1]!.id)]
const DEEP = mem([plan, t1f, t2, n3, ed, ...deep], { plan: 'p', new: 'n', safe: 'd' })
/** A "deep" copy that only copied the outer list. */
const NOT_DEEP = mem([plan, t1f, t2, n3, ed, list('d', 't1', 't2')], { plan: 'p', new: 'n', safe: 'd' })
const row = list('r', NUMS[0]!.id, NUMS[0]!.id, NUMS[0]!.id)
const GRID = mem([plan, t1f, t2, n3, ed, ...deep, list('g', 'r', 'r', 'r'), row], { plan: 'p', new: 'n', safe: 'd', grid: 'g' })
const rows = [0, 1, 2].map((k) => list(`r${k}`, NUMS[0]!.id, NUMS[0]!.id, NUMS[0]!.id))
const REAL_ROWS = mem([plan, t1f, t2, n3, ed, ...deep, list('g', 'r0', 'r1', 'r2'), ...rows], {
  plan: 'p', new: 'n', safe: 'd', grid: 'g',
})
const row1 = list('r', NUMS[1]!.id, NUMS[0]!.id, NUMS[0]!.id)
const WRITTEN = mem([plan, t1f, t2, n3, ed, ...deep, list('g', 'r', 'r', 'r'), row1], { plan: 'p', new: 'n', safe: 'd', grid: 'g' })

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

const seated = by('new[0].append("Flo")', SEATED)
const deepened = by('safe = copy.deepcopy(plan)', DEEP)

const at = (e: Evidence) => progress(s4Ideas, e)

describe('s4-ideas', () => {
  it('opens on Mira’s copied seating plan, before its first question', () => {
    const sc = script(s4Ideas, NOTHING)
    expect(sc.items[0]!.text).toContain('seating plan')
    expect(sc.items[sc.rest]).toMatchObject({ kind: 'ask' })
    expect(sc.items[sc.rest]!.text).toContain('plan = [["Ann"], ["Bo"]]')
  })

  it('walks one level copied, the two predictions, every level, and the grid', () => {
    expect(at(ev([PLAN]))).toBe(1)
    // `new = plan` shares the list: that is not the copy asked for.
    expect(at(ev([PLAN, aliased]))).toBe(1)
    expect(at(ev([PLAN, SHALLOW]))).toBe(2)
    // The robot's `len(plan)` is not a prediction; a typed 2 is.
    expect(at(ev([PLAN, SHALLOW], ['int', '2', 'len(plan)']))).toBe(2)
    const said: [string, string, string][] = [['int', '2', '2']]
    expect(at(ev([PLAN, SHALLOW], ...said))).toBe(3)
    expect(at(ev([PLAN, SHALLOW, ADDED], ...said))).toBe(4)
    // Asking the robot for `plan[0]` after running it is not predicting.
    expect(at(ev([PLAN, SHALLOW, ADDED, SEATED], ...said, ['list', "['Ann', 'Flo']", 'plan[0]']))).toBe(4)
    said.push(['list', "['Ann', 'Flo']", '["Ann", "Flo"]'])
    expect(at(ev([PLAN, SHALLOW, ADDED], ...said))).toBe(5)
    const h = [PLAN, SHALLOW, ADDED, seated]
    expect(at(ev(h, ...said))).toBe(6)
    expect(at(ev([...h, by('safe = copy.deepcopy(plan)', NOT_DEEP)], ...said))).toBe(6)
    expect(at(ev([...h, deepened], ...said))).toBe(7)
    // Three rows built separately are not the trap.
    expect(at(ev([...h, deepened, REAL_ROWS], ...said))).toBe(7)
    expect(at(ev([...h, deepened, GRID], ...said))).toBe(8)
    expect(at(ev([...h, deepened, GRID], ...said, ['list', '[1, 0, 0]', 'grid[1]']))).toBe(8)
    said.push(['list', '[1, 0, 0]', '[1, 0, 0]'])
    expect(at(ev([...h, deepened, GRID], ...said))).toBe(9)
    expect(at(ev([...h, deepened, GRID, WRITTEN], ...said))).toBe(s4Ideas.steps.length)
  })

  it('credits the shared table and `deepcopy` only to the lines that used them', () => {
    const said: [string, string, string][] = [['int', '2', '2'], ['list', "['Ann', 'Flo']", '["Ann", "Flo"]']]
    // `plan[0].append` leaves the same memory, but changed `plan` directly.
    const direct = ev([PLAN, SHALLOW, ADDED, by('plan[0].append("Flo")', SEATED)], ...said)
    expect(at(direct)).toBe(5)
    expect(guidance(s4Ideas, { ...direct, last: line('plan[0].append("Flo")', null) }).text).toContain('through the copy')
    // A deep copy typed out by hand is a new list, not a copy.
    const hand = 'safe = [["Ann", "Flo"], ["Bo"]]'
    const typedOut = ev([PLAN, SHALLOW, ADDED, seated, by(hand, DEEP)], ...said)
    expect(at(typedOut)).toBe(6)
    expect(guidance(s4Ideas, { ...typedOut, last: line(hand, null) }).text).toContain('Typed by hand')
  })

  it('answers the likely misses', () => {
    expect(guidance(s4Ideas, typed(failed('plan = [[Ann], [Bo]]', 'NameError'))).text).toContain('quotes')
    const shared = { ...ev([PLAN, aliased]), last: line('new = plan', null) }
    expect(guidance(s4Ideas, shared).text).toContain('`[:]`')
    const three = { ...ev([PLAN, SHALLOW], ['int', '3', '3']), last: line('3', th('int', '3')) }
    expect(guidance(s4Ideas, three).text).toContain('two outer lists')
    // The line that made the copy is still the last line when the
    // prediction is asked: that is the question, not a miss.
    const fresh = madeBy(ev([PLAN, SHALLOW]), line('new = plan[:]', null))
    expect(script(s4Ideas, fresh).items.at(-1)!.kind).toBe('ask')
    // Typed again, it did no step: the robot copied instead of a prediction.
    const again = madeBy(ev([PLAN, SHALLOW, SHALLOW]), line('new = plan[:]', null))
    expect(guidance(s4Ideas, again).text).toContain('Predict it first')
    const ran = { ...ev([PLAN, SHALLOW]), last: line('len(plan)', th('int', '2')) }
    expect(guidance(s4Ideas, ran).text).toContain('Predict it first')
    const before = ev([PLAN, SHALLOW, ADDED], ['int', '2', '2'], ['list', "['Ann']", '["Ann"]'])
    const old = { ...before, last: line('["Ann"]', th('list', "['Ann']")) }
    expect(guidance(s4Ideas, old).text).toContain('same table')
    const noModule = { ...ev([PLAN, SHALLOW, ADDED, seated], ['int', '2', '2'], ['list', "['Ann', 'Flo']", '["Ann", "Flo"]']) }
    expect(guidance(s4Ideas, { ...noModule, last: failed('safe = copy.deepcopy(plan)', 'NameError') }).text).toContain('import copy')
    expect(guidance(s4Ideas, { ...noModule, last: line('import copy', null) }).text).toContain('safe = copy.deepcopy(plan)')
  })
})
