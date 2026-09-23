/**
 * Reading's pure parts: trace order, canonical memory and the wrong
 * pictures, the checkpoint gate, and the variants. The graders against
 * real Python are in `tests/semantics/grade.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { Visit } from '../../src/memory/extract'
import type { MemorySnapshot } from '../../src/memory/model'
import { collectionOrder, compareOrder, withoutReturns } from '../../src/collection/traceOrder'
import { applyTransform, canonical, diagramOptions } from '../../src/collection/distractors'
import { passed, passMark, practiceItems, resumeAt, reviewItems, reviewOwed } from '../../src/collection/levels'
import { FAMILIES, variant, variantId } from '../../src/collection/variants'
import { KEY, record, type Mastery } from '../../src/mastery/mastery'
import { changedLines, normalise } from '../../src/collection/grade'
import { taskLine, verdictLine } from '../../src/collection/voice'
import { STAGES, itemById, lensesOf, playable, setsOf } from '../../src/collection'

const visits = (lines: [line: number, depth?: number][]): Visit[] =>
  lines.map(([line, depth = 1], step) => ({ line, depth, fn: depth > 1 ? 'f' : '<module>', step }))

describe('execution order, in the collection’s numbering', () => {
  // 9.4, as the trace reports it: `half` is called from line 9 and the
  // trace goes straight back to the `for` on line 6.
  const trace94 = visits([[1], [4], [5], [6], [7], [9], [2, 2], [6], [7], [8], [6], [10]])

  it('accepts the key’s numbering, which revisits the calling line after the call', () => {
    const key = [1, 4, 5, 6, 7, 9, 2, 9, 6, 7, 8, 6, 10]
    expect(compareOrder(key, trace94)).toBeNull()
  })

  it('accepts the trace’s own numbering, which does not', () => {
    expect(compareOrder([1, 4, 5, 6, 7, 9, 2, 6, 7, 8, 6, 10], trace94)).toBeNull()
  })

  it('still catches a real mistake, and says where', () => {
    // `continue` sends the loop back to the `for`, not on to line 9.
    expect(compareOrder([1, 4, 5, 6, 7, 9, 2, 6, 7, 8, 9, 6, 10], trace94)).toEqual({ at: 10, expected: 6, got: 9 })
  })

  it('does not drop a genuine repeat that follows no call', () => {
    const d = new Map([[2, 1]])
    expect(withoutReturns([2, 2, 2], d)).toEqual([2, 2, 2])
  })

  it('counts a for header once per pass and once to find nothing left', () => {
    // 5.2: total = 0 / for n in [4, 6] / total = total + n / print(total)
    const t = visits([[1], [2], [3], [2], [3], [2], [4]])
    expect(collectionOrder(t)).toEqual([1, 2, 3, 2, 3, 2, 4])
    expect(collectionOrder(t, { first: 3 })).toEqual([1, 2, 3])
  })

  it('windows by top-level lines, keeping the calls made inside the window', () => {
    // 9.C2's shape: lines 26–27 call into line 2 and lines 5–7.
    const t = visits([[1], [4], [26], [2, 2], [27], [5, 2], [6, 2], [7, 2], [28], [5, 2]])
    expect(collectionOrder(t, { lines: [26, 27] })).toEqual([26, 2, 27, 5, 6, 7])
  })
})

/* ------------------------------ memory ------------------------------ */

const list = (id: string, items: string[]) => ({
  id,
  type: 'list',
  kind: 'reference' as const,
  repr: `${items.length} items`,
  elements: items.map((t, i) => ({ label: String(i), target: t })),
  partial: false,
})
const int = (n: number) => ({ id: `v:int:${n}`, type: 'int', kind: 'value' as const, repr: String(n), elements: null, partial: false })
const snap = (bindings: [string, string][], objects: ReturnType<typeof list | typeof int>[]): MemorySnapshot => ({
  bindings: bindings.map(([name, target]) => ({ name, scope: 'global', target })),
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  line: null,
})

describe('canonical memory', () => {
  it('ignores ids, and sees sharing', () => {
    const a = snap([['p', 'o:1'], ['q', 'o:1']], [list('o:1', ['v:int:1']), int(1)])
    const b = snap([['p', 'o:9'], ['q', 'o:9']], [list('o:9', ['v:int:1']), int(1)])
    const c = snap([['p', 'o:1'], ['q', 'o:2']], [list('o:1', ['v:int:1']), list('o:2', ['v:int:1']), int(1)])
    expect(canonical(a)).toBe(canonical(b))
    expect(canonical(a)).not.toBe(canonical(c))
  })
})

describe('the wrong pictures', () => {
  // 1.3: p and q share a list; r has its own equal-looking one.
  const truth = snap(
    [['p', 'o:1'], ['q', 'o:1'], ['r', 'o:2']],
    [list('o:1', ['v:int:1', 'v:int:2']), list('o:2', ['v:int:1', 'v:int:2']), int(1), int(2)],
  )

  it('draws "assignment copies" as three lists', () => {
    const wrong = applyTransform('alias-to-copy', truth)!
    expect(Object.values(wrong.objects).filter((o) => o.type === 'list')).toHaveLength(3)
  })

  it('draws "equal-looking lists are one list" as one list', () => {
    const wrong = applyTransform('copy-to-alias', truth)!
    expect(Object.values(wrong.objects).filter((o) => o.type === 'list')).toHaveLength(1)
  })

  it('draws "* makes independent lists" with one inner list per slot', () => {
    // grid = [[0] * 2] * 2: two slots, one inner list.
    const grid = snap([['grid', 'o:1']], [list('o:1', ['o:2', 'o:2']), list('o:2', ['v:int:0', 'v:int:0']), int(0)])
    const wrong = applyTransform('shared-inner-to-separate', grid)!
    const outer = wrong.objects[wrong.bindings[0]!.target]!
    expect(new Set(outer.elements!.map((e) => e.target)).size).toBe(2)
  })

  it('offers only pictures that differ, and puts the truth where the seed says', () => {
    const same = { snapshot: truth, transform: 'earlier' as const }
    const other = { snapshot: applyTransform('alias-to-copy', truth), transform: 'alias-to-copy' as const }
    const d = diagramOptions(truth, [same, other, other], 7)
    expect(d.options).toHaveLength(2)
    expect(d.options[d.answer]!.transform).toBeNull()
    expect(diagramOptions(truth, [other], 7).answer).toBe(diagramOptions(truth, [other], 7).answer)
  })
})

/* ------------------------------- grading ------------------------------- */

describe('grading, the pure parts', () => {
  it('normalises trailing space and the final newline, and nothing else', () => {
    expect(normalise('9 4  \n\n')).toBe('9 4')
    expect(normalise(' 9 4')).toBe(' 9 4')
  })

  it('counts changed lines as a multiset, so a moved line is one change', () => {
    expect(changedLines('a = 1\nb = 2\n', 'b = 2\na = 1\n')).toBe(0)
    expect(changedLines('a = 1\nb = a\n', 'a = 1\nb = a[:]\n')).toBe(1)
  })
})

/* ------------------------------ the gate ------------------------------ */

const miss = (m: Mastery, id: string, at: number) => record(m, KEY.exercise(id), false, at)
const hit = (m: Mastery, id: string, at: number) => record(m, KEY.exercise(id), true, at)

describe('the checkpoint gate', () => {
  it('passes with all but one right first time', () => {
    expect(passMark(6)).toBe(5)
    expect(passed([true, true, true, true, true, false])).toBe(true)
    expect(passed([true, true, true, true, false, false])).toBe(false)
    expect(passed([true, true, true, true, true, null])).toBe(false)
  })

  it('owes a review of the missed questions’ go-back exercises, until each is done since', () => {
    let m: Mastery = {}
    m = miss(m, 'C1.3', 1000)
    expect(reviewItems(1, m)).toEqual(['1.3', '1.13'])
    expect(reviewOwed(1, m, false)).toBe(true)
    m = hit(m, '1.3', 2000)
    expect(reviewOwed(1, m, false)).toBe(true)
    m = hit(m, '1.13', 3000)
    expect(reviewOwed(1, m, false)).toBe(false)
  })

  it('owes nothing once the checkpoint is passed', () => {
    const m = miss({}, 'C1.3', 1000)
    expect(reviewOwed(1, m, true)).toBe(false)
  })

  it('resumes a set at its first unanswered item, or the start on a replay', () => {
    const ids = ['1.1', '1.2', '1.3']
    expect(resumeAt(ids, {})).toBe(0)
    expect(resumeAt(ids, hit({}, '1.1', 1))).toBe(1)
    expect(resumeAt(ids, hit(hit(hit({}, '1.1', 1), '1.2', 1), '1.3', 1))).toBe(0)
  })
})

/* ------------------------------ practice ------------------------------ */

describe('practice and variants', () => {
  it('makes the same program from the same seed, and a valid item from its id', () => {
    for (const f of FAMILIES) {
      const id = variantId(f.id, 12345)
      expect(variant(id)!.exercise.snippets[0]!.code).toBe(variant(id)!.exercise.snippets[0]!.code)
      expect(itemById(id)?.stage).toBe(f.stage)
      expect(playable(id).snippets).toHaveLength(1)
      expect(itemById(f.from), f.id).toBeDefined()
    }
  })

  it('fills a stage’s practice with variants, and puts a missed exercise first', () => {
    const fresh = practiceItems(2, {}, 0, 1)
    expect(fresh).toHaveLength(5)
    expect(fresh.every((id) => id.startsWith('v:'))).toBe(true)
    const withMiss = practiceItems(2, miss({}, '2.2', 1), 2, 1)
    expect(withMiss[0]).toBe('2.2')
  })

  it('has a family for every stage with a practice node', () => {
    for (const s of STAGES) if (s.checkpoint) expect(FAMILIES.some((f) => f.stage === s.stage), `stage ${s.stage}`).toBe(true)
  })
})

describe('the rest', () => {
  it('names a lens for every exercise', () => {
    for (const s of STAGES) for (const e of s.exercises) expect(lensesOf(e.id).length).toBeGreaterThan(0)
  })

  it('speaks plainly before Stage 6 and formally from it', () => {
    expect(taskLine('draw', 'plain')).toMatch(/names/)
    expect(taskLine('draw', 'formal')).toMatch(/bindings/)
    expect(verdictLine(false, 'object', ['1.3'])).toBe('Not quite — an object-model mistake. The key sends you back to 1.3.')
  })

  it('groups Stage 1 into three sets of five or six', () => {
    expect(setsOf(STAGES[0]!).map((s) => s.length)).toEqual([6, 5, 5])
  })
})
