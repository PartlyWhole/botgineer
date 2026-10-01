/**
 * v2's Deciding unit: Asking Questions (`v2-logic`), Making Choices
 * (`v2-if`) and Again and Again (`v2-loops`). What can be checked without
 * Python: every seed's questions are well formed, the cases swap in where
 * they should, and the editor lessons' replies name the mistake. The
 * browser journeys play every step against real Python.
 */
import { describe, expect, it } from 'vitest'
import { withCase, type Line, type LessonStep, type Run } from '../../../content/lessons'
import { logicLesson } from '../../../content/lessons/v2/logic'
import { ifLesson } from '../../../content/lessons/v2/ifs'
import { loopsLesson } from '../../../content/lessons/v2/loops'
import { codeMiss, decides, valueOf, wrongCase } from '../../../content/lessons/v2/code'
import type { MemorySnapshot } from '../../../src/memory/model'
import { EMPTY } from './fixtures'

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
const LESSONS = [
  ['v2-logic', logicLesson],
  ['v2-if', ifLesson],
  ['v2-loops', loopsLesson],
] as const

describe.each(LESSONS)('%s, for every seed', (_id, make) => {
  it('asks well-formed questions', () => {
    for (const seed of SEEDS) {
      const steps: LessonStep[] = make(seed).steps
      const ids = steps.flatMap((s) => (s.choices ? [s.choices.id] : []))
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length)
      for (const s of steps) {
        if (s.choices) {
          const opts = s.choices.options.map((o) => o.id)
          expect(new Set(opts).size, `${seed}: ${s.say}`).toBe(opts.length)
          expect(opts, `${seed}: ${s.say}`).toContain(s.choices.answer)
          expect(opts.length).toBeGreaterThanOrEqual(2)
        } else {
          expect(s.model, `${seed}: ${s.say}`).toBeTruthy()
        }
        // One idea per beat (R2), and an ask short enough to read.
        for (const b of s.beats ?? []) expect(b.say.length, b.say).toBeLessThanOrEqual(110)
        expect(s.say.length, s.say).toBeLessThanOrEqual(130)
      }
    }
  })
})

describe('withCase', () => {
  it('swaps a name\'s first top-level assignment, and only that', () => {
    const src = 'hp = 80\nif hp > 50:\n    hp = 1\n    action = "fight"'
    expect(withCase(src, { hp: '20' })).toBe('hp = 20\nif hp > 50:\n    hp = 1\n    action = "fight"')
  })
  it('does not mistake a comparison for an assignment', () => {
    expect(withCase('hp == 3\nhp = 4', { hp: '9' })).toBe('hp == 3\nhp = 9')
  })
  it('gives a name the program never assigns a line of its own', () => {
    expect(withCase('x = 1', { y: '2' })).toBe('y = 2\nx = 1')
  })
})

const mem = (pairs: [string, string, string][]): MemorySnapshot => ({
  bindings: pairs.map(([name], i) => ({ name, scope: 'global', target: `o${i}` })),
  objects: Object.fromEntries(pairs.map(([, type, repr], i) => [`o${i}`, { id: `o${i}`, type, kind: 'value', repr, elements: null, partial: false }])),
  line: null,
})

const run = (source: string, over: Partial<Run> = {}): Run => ({ source, ok: true, raised: null, line: null, ran: [], final: EMPTY, ...over })
const lineOf = (r: Run): Line => ({ source: r.source, ok: r.ok, error: r.raised, thought: null, memory: r.final, run: r })

describe('the editor lessons\' replies', () => {
  it('names a header without its colon', () => {
    const r = run('hp = 3\nif hp > 2\n    x = 1', { ok: false, raised: 'SyntaxError', line: 2 })
    expect(codeMiss(lineOf(r))).toMatch(/Line 2 is a header: it ends with a colon/)
  })
  it('names one = where a question was wanted, and else if', () => {
    expect(codeMiss(lineOf(run('if key = "gold":\n    d = 1', { ok: false, raised: 'SyntaxError', line: 1 })))).toMatch(/two: `==`/)
    expect(codeMiss(lineOf(run('if a:\n    b = 1\nelse if c:\n    b = 2', { ok: false, raised: 'SyntaxError', line: 3 })))).toMatch(/`elif`/)
  })
  it('names a block not pushed in, and a word without quotes', () => {
    expect(codeMiss(lineOf(run('for x in xs:\ntotal = 1', { ok: false, raised: 'IndentationError', line: 2 })))).toMatch(/push it in four spaces/)
    expect(codeMiss(lineOf(run('action = fight', { ok: false, raised: 'NameError', line: 1 })))).toMatch(/`"fight"`/)
  })
  it('names a loop that never finished', () => {
    expect(codeMiss(lineOf(run('while True:\n    x = 1', { ok: false, raised: 'steps', line: 2 })))).toMatch(/never finished/)
  })
  it('judges on every case, and says which went wrong', () => {
    const want = (g: Record<string, string>) => (Number(g.hp) > 50 ? "'fight'" : "'run'")
    const right = run('hp = 1\nif hp > 50:\n    a = "fight"\nelse:\n    a = "run"', {
      cases: [
        { given: { hp: '80' }, ok: true, raised: null, final: mem([['a', 'str', "'fight'"]]) },
        { given: { hp: '20' }, ok: true, raised: null, final: mem([['a', 'str', "'run'"]]) },
      ],
    })
    const half = { ...right, cases: [right.cases![0]!, { ...right.cases![1]!, final: mem([['a', 'str', "'fight'"]]) }] }
    const evidence = (r: Run) => ({ snapshot: EMPTY, thoughts: [], history: [EMPTY], runs: [r] })
    expect(decides(evidence(right), /\bif\b/, 'a', want)).toBe(true)
    expect(decides(evidence(half), /\bif\b/, 'a', want)).toBe(false)
    expect(wrongCase(lineOf(half), 'a', want)).toBe("With `hp = 20`, `a` came out `'fight'`. It should be `'run'`.")
    // A run of an earlier step, tried on other names, is never this step's.
    expect(decides(evidence(right), /\bif\b/, 'a', (g) => String(JSON.parse(g.gems!)))).toBe(false)
  })
  it('reads a list by its items', () => {
    const s: MemorySnapshot = {
      bindings: [{ name: 'big', scope: 'global', target: 'L' }],
      objects: {
        L: { id: 'L', type: 'list', kind: 'reference', repr: '2 items', elements: [{ label: '0', target: 'a' }, { label: '1', target: 'b' }], partial: false },
        a: { id: 'a', type: 'int', kind: 'value', repr: '7', elements: null, partial: false },
        b: { id: 'b', type: 'int', kind: 'value', repr: '9', elements: null, partial: false },
      },
      line: null,
    }
    expect(valueOf(s, 'big')).toBe('[7, 9]')
  })
})
