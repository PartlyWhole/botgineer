/**
 * The roadmap: its content, what progress unlocks, and where things go on
 * the path.
 */
import { describe, expect, it } from 'vitest'
import { ACTIVITIES } from '../../content/activities'
import { LEVEL_ORDER, ROADMAP, levelActivity } from '../../content/roadmap'
import { UNLOCK_ALL, levelStates, unitDone } from '../../src/progress/progress'
import { MASCOT_X, PITCH, SWING, mascotAt, stops, stretchHeight, swingOf, trail } from '../../src/roadmap/layout'

describe('the roadmap content', () => {
  it('puts every activity on the path exactly once', () => {
    expect([...LEVEL_ORDER].sort()).toEqual(ACTIVITIES.map((a) => a.id).sort())
    expect(new Set(LEVEL_ORDER).size).toBe(LEVEL_ORDER.length)
  })

  it('names only levels that exist', () => {
    for (const id of LEVEL_ORDER) expect(levelActivity(id).id).toBe(id)
    expect(() => levelActivity('nope')).toThrow(/does not exist/)
  })

  it('plays in the order the levels hand over to each other', () => {
    // An activity's `next` is the in-level way on; the map must agree with
    // it, or finishing a level would send you somewhere the map says is
    // still locked.
    for (let i = 0; i < LEVEL_ORDER.length - 1; i++) {
      expect(levelActivity(LEVEL_ORDER[i]!).next).toBe(LEVEL_ORDER[i + 1])
    }
  })

  it('opens the warm-up on meeting the robot, then its data types (docs/PEDAGOGY.md §3)', () => {
    // `words` folded into the types levels and left the path, and the
    // map with it.
    expect(ROADMAP[0]!.levels).toEqual(['sandbox', 'types', 'choose', 'operations', 'practice-thinking'])
    expect(LEVEL_ORDER).not.toContain('words')
    expect(levelActivity('sandbox').lesson).toBe('meet')
  })

  it('gives every unit a level, and adjacent units different colours', () => {
    for (const u of ROADMAP) expect(u.levels.length).toBeGreaterThan(0)
    for (let i = 1; i < ROADMAP.length; i++) expect(ROADMAP[i]!.theme).not.toBe(ROADMAP[i - 1]!.theme)
  })
})

describe('what progress unlocks', () => {
  const order = ['a', 'b', 'c', 'd']

  it('invites you to the first level before anything is done', () => {
    expect([...levelStates(order, new Set()).values()]).toEqual(['current', 'locked', 'locked', 'locked'])
  })

  it('makes the first unfinished level the current one', () => {
    expect([...levelStates(order, new Set(['a', 'b'])).values()]).toEqual(['done', 'done', 'current', 'locked'])
  })

  it('shows a level finished out of order as done, without unlocking past the gap', () => {
    // Reached by a deep link: `c` is done, but `b` is still the next to play.
    expect([...levelStates(order, new Set(['a', 'c'])).values()]).toEqual(['done', 'current', 'done', 'locked'])
  })

  it('has nothing current once everything is done', () => {
    expect([...levelStates(order, new Set(order)).values()]).toEqual(['done', 'done', 'done', 'done'])
  })

  it('ignores finished ids that are not on the path', () => {
    expect(levelStates(order, new Set(['zzz'])).get('a')).toBe('current')
  })

  it('opens every level once unlocked, without finishing any', () => {
    expect([...levelStates(order, new Set([UNLOCK_ALL])).values()]).toEqual(['current', 'unlocked', 'unlocked', 'unlocked'])
    expect([...levelStates(order, new Set([UNLOCK_ALL, 'a'])).values()]).toEqual(['done', 'current', 'unlocked', 'unlocked'])
    expect(unitDone(order, new Set([UNLOCK_ALL]))).toBe(false)
  })

  it('awards a unit its trophy only when every level in it is done', () => {
    expect(unitDone(['a', 'b'], new Set(['a']))).toBe(false)
    expect(unitDone(['a', 'b'], new Set(['a', 'b', 'x']))).toBe(true)
    expect(unitDone([], new Set(['a']))).toBe(false)
  })
})

describe('the path', () => {
  it('starts each stretch on the centre line and swings out to one side', () => {
    const s = stops(4, 0)
    expect(s[0]!.x).toBe(0)
    expect(s.every((p) => p.x >= 0)).toBe(true)
    expect(Math.max(...s.map((p) => p.x))).toBe(SWING)
  })

  it('swings the other way in the next unit', () => {
    expect(swingOf(0)).toBe(-swingOf(1))
    expect(stops(3, 1).every((p) => p.x <= 0)).toBe(true)
  })

  it('spaces stops evenly down the stretch', () => {
    const s = stops(3, 0)
    expect(s.map((p) => p.y)).toEqual([PITCH / 2, PITCH * 1.5, PITCH * 2.5])
    expect(stretchHeight(3)).toBe(PITCH * 3)
  })

  it('stands the mascot on the side the path is not swinging to', () => {
    expect(mascotAt(3, 0).x).toBe(-MASCOT_X)
    expect(mascotAt(3, 1).x).toBe(MASCOT_X)
    expect(mascotAt(3, 0).y).toBe(stretchHeight(3) / 2)
  })

  it('draws a trail through every stop, and nothing for no stops', () => {
    const s = stops(3, 0)
    const d = trail(s)
    for (const p of s) expect(d).toContain(`${p.x} ${p.y}`)
    expect(d.startsWith('M 0 0')).toBe(true)
    expect(trail([])).toBe('')
  })
})
