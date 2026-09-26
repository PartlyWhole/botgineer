/**
 * The scene is a view of memory, so these tests are about one question:
 * given what is bound, what does the picture show?
 */
import { describe, expect, it } from 'vitest'
import {
  bubbleX,
  halfHeightPct,
  idleTiming,
  railAnchor,
  speechDrop,
  speechLift,
  propHeightPct,
} from '../../src/panels/ScenePanel'
import { placement, readScene, widthOf, type Actor, type SceneSpec } from '../../src/scene/spec'
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

  it('lifts a short speaker to the tallest actor, so it covers nobody', () => {
    // The crow is shorter than the robot, and its bubble clamps towards
    // the centre to stay on stage — which is directly over the robot.
    const crow: Actor = { id: 'crow', kind: 'crow', x: 13, y: 0, w: 13, stand: true }
    const spec: SceneSpec = {
      id: 's',
      title: 's',
      floor,
      actors: [crow, robot],
      watches: [],
    }
    const lift = speechLift(spec)
    expect(lift).toBe(halfHeightPct(robot) * 2)
    expect(lift).toBeGreaterThan(halfHeightPct(crow) * 2)
    // Both speakers get the same band.
    expect(railAnchor(crow, floor, lift).marginBottom).toBe(`${lift}%`)
    expect(railAnchor(robot, floor, lift).marginBottom).toBe(`${lift}%`)
  })

  it('counts only actors that stand, since fixtures hang', () => {
    const spec: SceneSpec = {
      id: 's',
      title: 's',
      floor,
      actors: [lamp, { ...robot, w: 30 }],
      watches: [],
    }
    // The lamp is mounted on a wall; it is not part of the cast.
    expect(speechLift(spec)).toBe(halfHeightPct({ ...robot, w: 30 }) * 2)
    expect(speechLift({ ...spec, actors: [lamp] })).toBe(0)
  })

  it('lifts the band over a picture taller than the cast, and never lowers it for a short one', () => {
    const spec: SceneSpec = { id: 's', title: 's', floor, actors: [robot], watches: [] }
    const cast = speechLift(spec)
    // A short picture: the tallest head is still the band.
    expect(speechLift({ ...spec, props: { x: 50, w: 10 } })).toBe(cast)
    // A tall one: the band is its top, plus room for its ink.
    const tall = speechLift({ ...spec, props: { x: 50, w: 90 } })
    expect(tall).toBeGreaterThan(propHeightPct(90))
    expect(tall).toBeGreaterThan(cast)
    // Nobody standing, no band at all: a picture does not invent one.
    expect(speechLift({ ...spec, actors: [lamp], props: { x: 50, w: 90 } })).toBe(0)
  })

  it('clears every activity\'s picture with its band', () => {
    for (const a of ACTIVITIES) {
      const s = a.scene
      if (!s?.props || !s.floor) continue
      expect(speechLift(s), a.id).toBeGreaterThan(propHeightPct(s.props.w))
    }
  })

  it('never lowers a bubble below the speaker it belongs to', () => {
    // A lift smaller than the speaker's own height must not apply.
    expect(railAnchor(robot, floor, 1).marginBottom).toBe(`${halfHeightPct(robot) * 2}%`)
  })

  it("drops a short speaker's tail from the band to its own head", () => {
    const crow: Actor = { id: 'crow', kind: 'crow', x: 13, y: 0, w: 13, stand: true }
    const lift = speechLift({ id: 's', title: 's', floor, actors: [crow, robot], watches: [] })
    // The band plus the drop lands exactly on the crow's head.
    expect(speechDrop(crow, floor, lift) + halfHeightPct(crow) * 2).toBeCloseTo(lift)
    // The tallest actor's head is the band, so its tail stays short.
    expect(speechDrop(robot, floor, lift)).toBe(0)
    // Nobody standing, nothing to reach down to.
    expect(speechDrop(lamp, floor, lift)).toBe(0)
    expect(speechDrop(crow, undefined, lift)).toBe(0)
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

/**
 * Bound is not solved.
 *
 * The robot used to celebrate any run that reached the end, so
 * `power = 0` — which binds the name, clears the waiting hint and raises
 * nothing — got applause with the lamp dark.
 */
describe('a scene judging itself', () => {
  const bay: SceneSpec = {
    id: 'bay',
    title: 'bay',
    floor: { at: 80 },
    actors: [
      { id: 'robot', kind: 'robot', x: 50, y: 0, w: 27, stand: true },
      { id: 'lamp', kind: 'lamp', x: 78, y: 20, w: 9 },
      { id: 'plate', kind: 'sign', x: 50, y: 14, w: 38, label: 'unnamed' },
      { id: 'gauge', kind: 'gauge', x: 20, y: 26, w: 17 },
    ],
    watches: [
      { name: 'power', effect: { kind: 'lit', actor: 'lamp' }, hint: 'power' },
      { name: 'name', effect: { kind: 'caption', actor: 'plate' }, hint: 'name' },
      { name: 'charge', effect: { kind: 'level', actor: 'gauge', max: 100 }, hint: 'charge' },
    ],
  }

  const world = (entries: [string, PyObject][]): MemorySnapshot => ({
    bindings: entries.map(([name, o]) => ({ name, scope: 'global', target: o.id })),
    objects: Object.fromEntries(entries.map(([, o]) => [o.id, o])),
    line: 1,
  })

  const bool = (v: boolean) => value(`v:bool:${v}`, 'bool', v ? 'True' : 'False')
  const int = (n: number) => value(`v:int:${n}`, 'int', String(n))
  const str = (t: string) => value(`v:str:${t}`, 'str', `'${t}'`)

  const solvedWith = (entries: [string, PyObject][]) => readScene(bay, world(entries)).solved

  it('is solved when every watch is doing something', () => {
    expect(solvedWith([['power', bool(true)], ['name', str('Bolt')], ['charge', int(72)]])).toBe(true)
  })

  it('is not solved by a falsy value that still counts as bound', () => {
    const view = readScene(bay, world([['power', int(0)], ['name', str('Bolt')], ['charge', int(72)]]))
    // Nothing is waiting any more, and the lamp is still dark.
    expect(view.waitingFor).toEqual([])
    expect(view.actors.find((a) => a.actor.id === 'lamp')?.lit).toBe(false)
    expect(view.solved).toBe(false)
  })

  it('is not solved by a blank sign', () => {
    expect(solvedWith([['power', bool(true)], ['name', str('')], ['charge', int(72)]])).toBe(false)
  })

  it('is not solved by a gauge bound to something that is not a number', () => {
    expect(solvedWith([['power', bool(true)], ['name', str('Bolt')], ['charge', str('full')]])).toBe(
      false,
    )
  })

  it('is not solved while anything is still unbound', () => {
    expect(solvedWith([['power', bool(true)]])).toBe(false)
  })

  it('is not solved by an empty scene', () => {
    expect(readScene(bay, { bindings: [], objects: {}, line: null }).solved).toBe(false)
  })

  it('has nothing to be pleased about when it watches nothing', () => {
    // A console lesson's scene. Vacuous truth would have the robot
    // celebrating from the moment it loaded.
    const workshop: SceneSpec = { ...bay, watches: [] }
    expect(readScene(workshop, world([])).solved).toBe(false)
  })

  it('needs a pick to have moved something', () => {
    const depot: SceneSpec = {
      id: 'depot',
      title: 'depot',
      floor: { at: 80, look: 'belt' },
      actors: [
        { id: 'B1', kind: 'crate', x: 40, y: 0, w: 13, label: 'B1', group: 'parcels', stand: true },
      ],
      watches: [{ name: 'heavy', effect: { kind: 'pick', group: 'parcels' }, hint: 'heavy' }],
    }
    const listOf = (labels: string[]): [string, PyObject][] => {
      const items = labels.map((l) => str(l))
      const list: PyObject = {
        id: 'o:L1',
        type: 'list',
        kind: 'reference',
        repr: `${labels.length} items`,
        elements: items.map((o, i) => ({ label: String(i), target: o.id })),
        partial: false,
      }
      return [['heavy', list], ...items.map((o, i) => [`__i${i}`, o] as [string, PyObject])]
    }
    expect(readScene(depot, world(listOf(['B1']))).solved).toBe(true)
    // An empty list moves no parcel, and neither does a wrong label.
    expect(readScene(depot, world(listOf([]))).solved).toBe(false)
    expect(readScene(depot, world(listOf(['nope']))).solved).toBe(false)
  })
})

describe('the cast on stage', () => {
  it('never draws the crow too small to see it talk', () => {
    // At `w: 13` the guide was a smudge beside a robot twice its size.
    const crow: Actor = { id: 'crow', kind: 'crow', x: 13, y: 0, w: 13, stand: true }
    expect(widthOf(crow)).toBe(16)
    expect(placement(crow, { at: 82 }).width).toBe('16%')
    // And the speech band is computed from the same width, or the tail
    // would reach for a head that is not where the maths says it is.
    expect(halfHeightPct(crow)).toBeCloseTo((16 * 160) / 140 / 2)
    // A minimum, not a size: a bigger crow stays bigger, other kinds untouched.
    expect(widthOf({ ...crow, w: 20 })).toBe(20)
    expect(widthOf({ id: 'l', kind: 'lamp', x: 0, y: 0, w: 9 })).toBe(9)
  })

  it('gives each actor its own idle rhythm, and the same one every time', () => {
    const crow = idleTiming('crow')
    expect(idleTiming('crow')).toEqual(crow)
    // Two characters blinking in unison read as one machine.
    expect(idleTiming('robot')['--blink-dur']).not.toBe(crow['--blink-dur'])
    for (const id of ['crow', 'robot', 'courier', 'x', 'a-much-longer-id']) {
      const t = idleTiming(id)
      const dur = parseFloat(t['--blink-dur']!)
      expect(dur).toBeGreaterThanOrEqual(8)
      expect(dur).toBeLessThanOrEqual(11)
      expect(parseFloat(t['--blink-delay']!)).toBeLessThanOrEqual(0)
    }
  })
})
