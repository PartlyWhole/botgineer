/**
 * The scene is a view of memory, so these tests are about one question:
 * given what is bound, what does the picture show?
 */
import { describe, expect, it } from 'vitest'
import { readScene, type SceneSpec } from '../../src/scene/spec'
import type { MemorySnapshot, PyObject } from '../../src/memory/model'

const value = (id: string, type: string, repr: string): PyObject => ({
  id,
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

function memory(
  bindings: [string, string][],
  objects: PyObject[],
): MemorySnapshot {
  return {
    bindings: bindings.map(([name, target]) => ({ name, scope: 'global', target })),
    objects: Object.fromEntries(objects.map((o) => [o.id, o])),
    line: 1,
  }
}

const spec: SceneSpec = {
  id: 's',
  title: 'test',
  actors: [
    { id: 'lamp', kind: 'lamp', x: 0, y: 0 },
    { id: 'sign', kind: 'sign', x: 0, y: 0, label: 'unnamed' },
    { id: 'gauge', kind: 'gauge', x: 0, y: 0 },
    { id: 'A', kind: 'crate', x: 0, y: 0, label: 'A', group: 'p' },
    { id: 'B', kind: 'crate', x: 0, y: 0, label: 'B', group: 'p' },
  ],
  watches: [
    { name: 'power', effect: { kind: 'lit', actor: 'lamp' }, hint: 'needs power' },
    { name: 'name', effect: { kind: 'caption', actor: 'sign' }, hint: 'needs name' },
    { name: 'charge', effect: { kind: 'level', actor: 'gauge', max: 100 }, hint: 'needs charge' },
    { name: 'picked', effect: { kind: 'pick', group: 'p' }, hint: 'needs picked' },
  ],
}

const at = (spec_: SceneSpec, snap: MemorySnapshot, id: string) =>
  readScene(spec_, snap).actors.find((a) => a.actor.id === id)!

describe('a scene with nothing bound', () => {
  it('says what it is waiting for rather than sitting inert', () => {
    const view = readScene(spec, memory([], []))
    expect(view.waitingFor.map((w) => w.name)).toEqual(['power', 'name', 'charge', 'picked'])
    expect(view.actors.every((a) => !a.lit && !a.picked && a.level === null)).toBe(true)
  })

  it('keeps an actor default label until something is bound', () => {
    expect(at(spec, memory([], []), 'sign').caption).toBe('unnamed')
  })
})

describe('truthiness comes from the model, not a guess', () => {
  it.each([
    ['bool', 'True', true],
    ['bool', 'False', false],
    ['int', '1', true],
    ['int', '0', false],
    ['NoneType', 'None', false],
    ['str', "''", false],
    ['str', "'x'", true],
  ])('%s %s lights the lamp: %s', (type, repr, lit) => {
    const snap = memory([['power', 'v1']], [value('v1', type, repr)])
    expect(at(spec, snap, 'lamp').lit).toBe(lit)
  })

  it('an empty list is falsey and a full one is not', () => {
    const empty = memory([['power', 'l0']], [list('l0', [])])
    const full = memory([['power', 'l1'], ['x', 'v1']], [list('l1', ['v1']), value('v1', 'int', '1')])
    expect(at(spec, empty, 'lamp').lit).toBe(false)
    expect(at(spec, full, 'lamp').lit).toBe(true)
  })
})

describe('captions, levels and picking', () => {
  it('a sign in the world shows a string text, not its repr', () => {
    const snap = memory([['name', 'v1']], [value('v1', 'str', "'Bolt'")])
    expect(at(spec, snap, 'sign').caption).toBe('Bolt')
  })

  it('binding the wrong type to a sign is visible, not coerced away', () => {
    const snap = memory([['name', 'v1']], [value('v1', 'int', '42')])
    expect(at(spec, snap, 'sign').caption).toBe('42')
  })

  it('a number fills the gauge, and is clamped', () => {
    const of = (repr: string) =>
      at(spec, memory([['charge', 'v1']], [value('v1', 'int', repr)]), 'gauge').level
    expect(of('0')).toBe(0)
    expect(of('50')).toBe(0.5)
    expect(of('250')).toBe(1)
    expect(of('-10')).toBe(0)
  })

  it('a non-number leaves the gauge unset rather than at zero', () => {
    const snap = memory([['charge', 'v1']], [value('v1', 'str', "'lots'")])
    expect(at(spec, snap, 'gauge').level).toBeNull()
  })

  it('a list of strings picks the actors it names', () => {
    const snap = memory(
      [['picked', 'l1']],
      [list('l1', ['sA']), value('sA', 'str', "'A'")],
    )
    expect(at(spec, snap, 'A').picked).toBe(true)
    expect(at(spec, snap, 'B').picked).toBe(false)
  })

  it('an empty list unpicks everything', () => {
    const snap = memory([['picked', 'l0']], [list('l0', [])])
    expect(readScene(spec, snap).actors.some((a) => a.picked)).toBe(false)
  })
})

describe('scope', () => {
  it('only reads globals — a local of the same name is not the scene subject', () => {
    const snap: MemorySnapshot = {
      bindings: [{ name: 'power', scope: 'helper', target: 'v1' }],
      objects: { v1: value('v1', 'bool', 'True') },
      line: 1,
    }
    expect(at(spec, snap, 'lamp').lit).toBe(false)
    expect(readScene(spec, snap).waitingFor.map((w) => w.name)).toContain('power')
  })
})
