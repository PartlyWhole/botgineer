/**
 * Wake the robot (Level 7): the editor's level, judged on a run.
 */
import { describe, expect, it } from 'vitest'
import { castAt, progress, script, wake } from '../../../content/lessons'
import { awake, BAY } from '../../../content/lessons/wake'
import { ACTIVITIES } from '../../../content/activities'
import { readScene } from '../../../src/scene/spec'
import { NOTHING, bound, over, snap } from './fixtures'

const world = (...xs: ReturnType<typeof bound>[]) => snap(xs.map((x) => x.object), xs.map((x) => x.binding))

describe('wake', () => {
  it('tells four beats before the task: asleep, the editor, Run, the fixtures', () => {
    const s = script(wake, NOTHING)
    const beats = s.items.filter((i) => i.kind === 'beat')
    expect(beats).toHaveLength(4)
    expect(beats[0]!.act).toEqual([{ actor: 'robot', do: 'sleep' }])
    expect(beats[1]!.focus).toBe('console')
    expect(beats[1]!.text).toMatch(/whole list of instructions/)
    expect(beats[2]!.focus).toBe('run')
    for (const n of ['power', 'name', 'charge']) expect(beats[3]!.text).toContain(`\`${n}\``)
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', tag: 'you' })
  })

  it('keeps the robot asleep through the task, and wakes it on the outro', () => {
    expect(castAt(wake, NOTHING).asleep).toEqual(['robot'])
    const done = over([world(bound('power', 'bool', 'True'), bound('name', 'str', "'Bolt'"), bound('charge', 'int', '72'))])
    expect(castAt(wake, done, 0).asleep).toEqual([])
    expect(wake.takeaway).toMatch(/program/)
  })

  it('is the scene the activity stands on', () => {
    expect(ACTIVITIES.find((a) => a.id === 'wake')!.scene).toBe(BAY)
  })

  it("agrees with the bay's watches on every world, because it is them", () => {
    const powers = [bound('power', 'bool', 'True'), bound('power', 'bool', 'False'), bound('power', 'int', '0'), bound('power', 'int', '1'), bound('power', 'str', "''"), null]
    const names = [bound('name', 'str', "'Bolt'"), bound('name', 'str', "''"), bound('name', 'str', "'  '"), bound('name', 'int', '7'), null]
    const charges = [bound('charge', 'int', '72'), bound('charge', 'float', '0.5'), bound('charge', 'str', "'full'"), bound('charge', 'int', '0'), null]
    let woke = 0
    for (const p of powers)
      for (const n of names)
        for (const c of charges) {
          const s = world(...[p, n, c].filter((x): x is ReturnType<typeof bound> => x !== null))
          const solved = readScene(BAY, s).solved
          expect(awake(s)).toBe(solved)
          expect(progress(wake, over([s]))).toBe(solved ? 1 : 0)
          if (solved) woke++
        }
    expect(woke).toBeGreaterThan(0)
  })

  it('does not wake on a power the lamp would not light for', () => {
    const name = bound('name', 'str', "'Bolt'")
    const charge = bound('charge', 'int', '72')
    expect(progress(wake, over([world(bound('power', 'int', '0'), name, charge)]))).toBe(0)
    expect(progress(wake, over([world(bound('power', 'bool', 'False'), name, charge)]))).toBe(0)
  })
})
