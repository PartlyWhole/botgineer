/**
 * The collection's content and its specs, audited without running Python
 * (the sweep in `tests/semantics` does that).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { blocks, errorTypes, idsIn, parseAll } from '../../scripts/collection.mjs'
import { ITEMS, MISCONCEPTIONS, STAGES, itemById, lensesOf, playable, setsOf, snippetsOf } from '../../src/collection'
import { SPECS } from '../../content/collection/specs'
import { CONCEPTS } from '../../content/concepts'
import { snippetIndex } from '../../src/collection/grade'

const order = new Map(ITEMS.map((item, i) => [item.id, i]))

describe('the parser', () => {
  it('reads every stage: 158 exercises, 8 capstone items and 48 checkpoint questions', () => {
    const exercises = STAGES.flatMap((s) => s.exercises)
    expect(exercises.filter((e) => !e.id.includes('C'))).toHaveLength(158)
    expect(exercises.filter((e) => e.id.includes('C'))).toHaveLength(8)
    expect(STAGES.flatMap((s) => s.checkpoint?.items ?? [])).toHaveLength(48)
  })

  it('gives every exercise an answer, an error type and an authoring record', () => {
    for (const e of STAGES.flatMap((s) => s.exercises)) {
      expect(e.key.answer.length, e.id).toBeGreaterThan(0)
      expect(e.key.authoring, e.id).not.toBeNull()
    }
    const untyped = STAGES.flatMap((s) => s.exercises).filter((e) => e.key.errorTypes.length === 0)
    // The capstone's last three items classify each defect in prose.
    expect(untyped.map((e) => e.id)).toEqual(['9.C5', '9.C7', '9.C8'])
  })

  it('is what is committed', () => {
    // `node scripts/collection.mjs` regenerates; a stale file is a content
    // edit that never reached the app.
    const { stages } = parseAll()
    for (const s of stages) {
      const file = readFileSync(new URL(`../../content/collection/generated/stage-0${s.stage}.json`, import.meta.url), 'utf8')
      expect(JSON.parse(file)).toEqual(JSON.parse(JSON.stringify(s)))
    }
  })

  it('splits blocks, error types and id ranges', () => {
    expect(blocks('a\nb\n\n```python\nx = 1\n```\n| a | b |\n|---|---|\n| `x|y` | 2 |')).toEqual([
      { kind: 'p', text: 'a b' },
      { kind: 'code', lang: 'python', text: 'x = 1' },
      { kind: 'table', head: ['a', 'b'], rows: [['`x|y`', '2']] },
    ])
    expect(errorTypes('Flow error if you lost count; object-model if not')).toEqual(['flow', 'object'])
    expect(idsIn('Prereq: 1.1–1.4, 2.3')).toEqual(['1.1', '1.2', '1.3', '1.4', '2.3'])
    expect(idsIn('Prereq: 9.C1–9.C3')).toEqual(['9.C1', '9.C2', '9.C3'])
  })
})

describe('the authoring audit the conventions ask for', () => {
  it('points every prerequisite at an earlier exercise', () => {
    for (const e of STAGES.flatMap((s) => s.exercises)) {
      for (const p of e.key.authoring?.prereq ?? []) {
        expect(order.has(p), `${e.id} → ${p}`).toBe(true)
        expect(order.get(p)!, `${e.id} → ${p}`).toBeLessThan(order.get(e.id)!)
      }
    }
  })

  it('points every "go back to" at an exercise that exists', () => {
    for (const item of ITEMS) {
      const back = item.kind === 'exercise' ? item.exercise.key.goBack : item.question.goBack
      for (const id of back) expect(itemById(id), `${item.id} → ${id}`).toBeDefined()
    }
  })

  it('resolves every misconception-table row to real exercises', () => {
    expect(MISCONCEPTIONS).toHaveLength(12)
    for (const m of MISCONCEPTIONS) for (const id of m.exercises) expect(itemById(id), `${m.text} → ${id}`).toBeDefined()
  })

  /**
   * Gaps the audit found in the collection itself, kept visible rather
   * than tagged away. A new gap still fails; these are the known ones.
   */
  const KNOWN_THIN = new Set([
    // Before C8.5, `return` leaving a loop part-way is met only in 8.15,
    // a find-and-fix. 8.3 and 8.14 return after their loops finish.
    'C8.5 relies on return-exits, met in fix',
  ])

  it('has every concept a checkpoint relies on appear in at least two forms first', () => {
    const thin: string[] = []
    for (const s of STAGES) {
      for (const q of s.checkpoint?.items ?? []) {
        for (const c of SPECS[q.id]?.concepts ?? []) {
          const forms = new Set(
            STAGES.filter((t) => t.stage <= s.stage)
              .flatMap((t) => t.exercises)
              .filter((e) => SPECS[e.id]?.concepts.includes(c))
              .map((e) => e.kind),
          )
          const gap = `${q.id} relies on ${c}, met in ${[...forms].join(', ') || 'no form'}`
          if (forms.size < 2 && !KNOWN_THIN.has(gap)) thin.push(gap)
        }
      }
    }
    expect(thin).toEqual([])
  })
})

describe('the specs', () => {
  it('give every item exactly one spec, and every spec an item', () => {
    const items = ITEMS.map((i) => i.id).sort()
    expect(Object.keys(SPECS).sort()).toEqual(items)
  })

  it('tag only concepts that exist, one or two per item', () => {
    const known = new Set(CONCEPTS.map((c) => c.id))
    for (const [id, spec] of Object.entries(SPECS)) {
      expect(spec.concepts.length, id).toBeGreaterThanOrEqual(1)
      expect(spec.concepts.length, id).toBeLessThanOrEqual(3)
      for (const c of spec.concepts) expect(known.has(c), `${id}: ${c}`).toBe(true)
    }
  })

  it('give every item something to answer, on snippets that exist', () => {
    for (const id of Object.keys(SPECS)) {
      const p = playable(id)
      expect(p.spec.parts.length, id).toBeGreaterThan(0)
      const needsCode = p.spec.parts.some((x) => !['choice', 'rule', 'labels', 'write', 'number'].includes(x.kind))
      if (needsCode) expect(snippetsOf(id).length, id).toBeGreaterThan(0)
      for (const part of p.spec.parts) {
        if (!('snippet' in part) || part.snippet === undefined) continue
        const i = snippetIndex(part.snippet, p.snippets.map((s) => s.label))
        expect(p.snippets[i], `${id}: snippet ${String(part.snippet)}`).toBeDefined()
        if (typeof part.snippet === 'string') expect(p.snippets.map((s) => s.label), id).toContain(part.snippet)
      }
    }
  })

  it('name at least one lens for every item', () => {
    for (const id of Object.keys(SPECS)) expect(lensesOf(id).length, id).toBeGreaterThan(0)
  })
})

describe('the sets', () => {
  it('group each stage into two to four sets, in file order, covering every exercise once', () => {
    for (const s of STAGES) {
      const sets = setsOf(s)
      expect(sets.length).toBeGreaterThanOrEqual(2)
      expect(sets.length).toBeLessThanOrEqual(4)
      expect(sets.flat().map((e) => e.id)).toEqual(s.exercises.filter((e) => !e.id.includes('C')).map((e) => e.id))
      for (const set of sets) expect(set.length).toBeGreaterThanOrEqual(4)
    }
  })
})
