/**
 * The model's own queries. These decide what each view is allowed to
 * leave out, so their edges are pinned here rather than in a panel.
 */
import { describe, expect, it } from 'vitest'
import { namesFor, topLevel, unreferenced, type MemorySnapshot, type PyObject } from '../../src/memory/model'

const val = (type: string, repr: string): PyObject => ({
  id: `v:${type}:${repr}`,
  type,
  kind: 'value',
  repr,
  elements: null,
  partial: false,
})

const coll = (id: string, targets: string[], type = 'list'): PyObject => ({
  id,
  type,
  kind: 'reference',
  repr: `${targets.length} items`,
  elements: targets.map((t, i) => ({ label: String(i), target: t })),
  partial: false,
})

const snap = (objects: PyObject[], bindings: MemorySnapshot['bindings'] = []): MemorySnapshot => ({
  bindings,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  line: 1,
})

describe('topLevel', () => {
  const one = val('int', '1')
  const two = val('int', '2')
  const three = val('int', '3')

  it('collapses a collection to itself', () => {
    // `[1, 2, 3]` typed bare: four objects, one line.
    const s = snap([one, two, three, coll('o:L', [one.id, two.id, three.id])])
    expect(topLevel(s)).toEqual(['o:L'])
  })

  it('keeps the collection saying how many, not what', () => {
    // The chip is still a count. Hiding elements is not inlining them.
    const s = snap([one, coll('o:L', [one.id])])
    expect(s.objects['o:L']!.repr).toBe('1 items')
    expect(s.objects['o:L']!.elements).toHaveLength(1)
  })

  it('brings an element back once it has a name of its own', () => {
    const s = snap(
      [one, two, coll('o:L', [one.id, two.id])],
      [{ name: 'first', scope: 'global', target: one.id }],
    )
    expect(topLevel(s)).toEqual(['o:L', one.id])
    expect(namesFor(s, one.id).map((b) => b.name)).toEqual(['first'])
  })

  it('leaves loose values alone', () => {
    const s = snap([one, two])
    expect(topLevel(s)).toEqual([one.id, two.id])
  })

  it('collapses a nested collection whole', () => {
    const inner = coll('o:I', [one.id])
    const outer = coll('o:O', [inner.id])
    const s = snap([one, inner, outer], [{ name: 'a', scope: 'global', target: outer.id }])
    expect(topLevel(s)).toEqual(['o:O'])
  })

  it('keeps a self-referential collection, which holds itself', () => {
    // Held, but named — and hiding it would empty the strip.
    const selfish = coll('o:S', ['o:S'])
    const s = snap([selfish], [{ name: 'a', scope: 'global', target: 'o:S' }])
    expect(topLevel(s)).toEqual(['o:S'])
  })

  it('shows a dict but not its values', () => {
    const d: PyObject = {
      id: 'o:D',
      type: 'dict',
      kind: 'reference',
      repr: '2 entries',
      elements: [
        { label: "'x'", target: one.id },
        { label: "'y'", target: two.id },
      ],
      partial: false,
    }
    const s = snap([one, two, d], [{ name: 'counts', scope: 'global', target: 'o:D' }])
    expect(topLevel(s)).toEqual(['o:D'])
  })

  it('agrees with unreferenced about what nothing points at', () => {
    const s = snap([one, coll('o:L', [one.id])])
    // The list is unreferenced and top level; the element is neither.
    expect(unreferenced(s)).toEqual(['o:L'])
    expect(topLevel(s)).toEqual(['o:L'])
  })

  it('is empty for empty memory', () => {
    expect(topLevel(snap([]))).toEqual([])
  })
})
