/**
 * A lesson's progress is derived from memory, so these tests are just
 * snapshots in, step number out. No UI, no runtime, no bookkeeping.
 */
import { describe, expect, it } from 'vitest'
import { guidance, objectsFirst, progress } from '../../content/lessons'
import type { MemorySnapshot, PyObject } from '../../src/memory/model'

const value = (type: string, repr: string): PyObject => ({
  id: `v:${type}:${repr}`,
  type,
  kind: 'value',
  repr,
  elements: null,
  partial: false,
})

const list = (id: string, targets: string[]): PyObject => ({
  id,
  type: 'list',
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

describe('objects before names', () => {
  it('starts at the first step', () => {
    expect(progress(objectsFirst, snap([]))).toBe(0)
    expect(guidance(objectsFirst, snap([]))).toMatch(/Say `10`/)
  })

  it('advances when the int exists', () => {
    expect(progress(objectsFirst, snap([value('int', '10')]))).toBe(1)
  })

  it('does not accept a different number', () => {
    expect(progress(objectsFirst, snap([value('int', '11')]))).toBe(0)
  })

  it('wants the string quoted the way Python reprs it', () => {
    const s = snap([value('int', '10'), value('str', "'John'")])
    expect(progress(objectsFirst, s)).toBe(2)
  })

  it('accepts a computed value, not just a typed one', () => {
    const s = snap([value('int', '10'), value('str', "'John'"), value('int', '7')])
    expect(progress(objectsFirst, s)).toBe(3)
  })

  it('finishes on a three-item collection nothing holds', () => {
    const s = snap([
      value('int', '10'),
      value('str', "'John'"),
      value('int', '7'),
      value('int', '1'),
      value('int', '2'),
      value('int', '3'),
      list('o:L1', ['v:int:1', 'v:int:2', 'v:int:3']),
    ])
    expect(progress(objectsFirst, s)).toBe(objectsFirst.steps.length)
    expect(guidance(objectsFirst, s)).toBe(objectsFirst.outro)
  })

  it('does not count a collection that a name already holds', () => {
    const s = snap(
      [value('int', '1'), list('o:L1', ['v:int:1'])],
      [{ name: 'xs', scope: 'global', target: 'o:L1' }],
    )
    // Bound, so it is not the nameless object the step is about.
    expect(progress(objectsFirst, s)).toBe(0)
  })

  it('only ever moves forward as memory grows', () => {
    const grow: MemorySnapshot[] = [
      snap([]),
      snap([value('int', '10')]),
      snap([value('int', '10'), value('str', "'John'")]),
      snap([value('int', '10'), value('str', "'John'"), value('int', '7')]),
    ]
    const seen = grow.map((s) => progress(objectsFirst, s))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })
})
