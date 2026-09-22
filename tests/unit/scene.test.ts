/**
 * The scene is a view of memory, so these tests are about one question:
 * given what is bound, what does the picture show?
 */
import { describe, expect, it } from 'vitest'
import { bubbleX, halfHeightPct, railAnchor } from '../../src/panels/ScenePanel'
import { placement, readScene, type Actor, type SceneSpec } from '../../src/scene/spec'
import { ACTIVITIES } from '../../content/activities'
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

describe('the guide bubble', () => {
  it('stays inside the stage however near an edge the speaker is', () => {
    // A crow at x: 14 pushed half the sentence out of the panel.
    expect(bubbleX(14)).toBe(31)
    expect(bubbleX(96)).toBe(69)
    expect(bubbleX(50)).toBe(50)
  })

  it('never lets the clamped body run off either edge', () => {
    // The body is at most 58% of the stage wide, so its half-width is
    // 29%. The clamp has to keep the centre at least that far in, or a
    // sentence leaves the panel at the 320px minimum width where the
    // percentage, not the 280px cap, is what binds.
    const half = 58 / 2
    for (const x of [0, 14, 31, 50, 69, 96, 100]) {
      expect(bubbleX(x)).toBeGreaterThanOrEqual(half)
      expect(bubbleX(x)).toBeLessThanOrEqual(100 - half)
    }
  })

  it('clears the speaker rather than sitting on its face', () => {
    // The lift is half the speaker's own rendered height, in percent of
    // the stage's *width* — the unit a percentage margin resolves in.
    // A 20%-wide crow is 20 * 160/140 tall, so the lift is ~11.4.
    expect(halfHeightPct({ id: 'c', kind: 'crow', x: 30, y: 48, w: 20 })).toBeCloseTo(11.43, 2)
    expect(halfHeightPct({ id: 'r', kind: 'robot', x: 68, y: 48, w: 22 })).toBeCloseTo(13.36, 2)
    expect(halfHeightPct({ id: 'm', kind: 'courier', x: 76, y: 46, w: 20 })).toBeCloseTo(12.86, 2)
  })

  it('over-estimates the lift for a prop rather than under-estimating it', () => {
    // A bubble that clears too much is merely high; one that clears too
    // little covers the thing that is talking.
    expect(halfHeightPct({ id: 's', kind: 'sign', x: 40, y: 84, w: 34 })).toBe(17)
    expect(halfHeightPct({ id: 'p', kind: 'plinth', x: 50, y: 92 })).toBe(8)
  })
})

describe('standing on the floor', () => {
  const floor = { at: 78 }
  const robot: Actor = { id: 'robot', kind: 'robot', x: 66, y: 0, w: 24, stand: true }
  const lamp: Actor = { id: 'lamp', kind: 'lamp', x: 78, y: 20, w: 9 }

  it('anchors a standing actor by its feet, not its centre', () => {
    // `bottom` is the complement of the floor, so the contact does not
    // depend on how tall the actor turns out to be drawn.
    expect(placement(robot, floor)).toEqual({ left: '66%', width: '24%', bottom: '22%' })
    expect(placement(robot, floor).top).toBeUndefined()
  })

  it('leaves a mounted actor on its centre', () => {
    expect(placement(lamp, floor)).toEqual({ left: '78%', width: '9%', top: '20%' })
    expect(placement(lamp, floor).bottom).toBeUndefined()
  })

  it('falls back to the centre when a scene has no floor', () => {
    // A scene with nothing to stand on must still render.
    expect(placement(robot, undefined)).toEqual({ left: '66%', width: '24%', top: '0%' })
  })

  it('clears a standing speaker by a whole height, not half of one', () => {
    // Half a height is right for a centred actor and puts the bubble
    // through a standing one's face.
    const centred = railAnchor({ ...robot, stand: false, y: 46 }, floor)
    const standing = railAnchor(robot, floor)
    expect(centred.marginBottom).toBe(`${halfHeightPct(robot)}%`)
    expect(standing.marginBottom).toBe(`${halfHeightPct(robot) * 2}%`)
    expect(standing.bottom).toBe('22%')
  })

  it('ignores a floor for an actor that is not standing on it', () => {
    expect(railAnchor(lamp, floor).bottom).toBe('80%')
  })
})

describe('every scene', () => {
  it('stands its cast on a floor', () => {
    // A character with no floor to stand on floats, which is the bug
    // this replaced — so the invariant belongs here, not in a review.
    const cast = new Set(['robot', 'crow', 'courier'])
    for (const activity of ACTIVITIES) {
      const scene = activity.scene
      const people = scene.actors.filter((a) => cast.has(a.kind))
      if (people.length === 0) continue
      expect(scene.floor, `${scene.id} has cast but no floor`).toBeDefined()
      for (const person of people) {
        expect(person.stand, `${scene.id}/${person.id} does not stand`).toBe(true)
      }
    }
  })

  it('keeps every floor inside the stage', () => {
    for (const activity of ACTIVITIES) {
      const at = activity.scene.floor?.at
      if (at === undefined) continue
      expect(at).toBeGreaterThan(40)
      expect(at).toBeLessThan(95)
    }
  })
})
