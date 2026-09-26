/**
 * Wake the robot (Level 7): the editor's level, judged on a run.
 */
import { describe, expect, it } from 'vitest'
import { castAt, guidance, progress, script, wake } from '../../../content/lessons'
import { awake, BAY } from '../../../content/lessons/wake'
import { ACTIVITIES } from '../../../content/activities'
import { readScene } from '../../../src/scene/spec'
import { NOTHING, bound, over, snap } from './fixtures'

const world = (...xs: ReturnType<typeof bound>[]) => snap(xs.map((x) => x.object), xs.map((x) => x.binding))

describe('wake', () => {
  it('tells the four things before the task: asleep, the editor, Run, the fixtures', () => {
    const s = script(wake, NOTHING)
    const beats = s.items.filter((i) => i.kind === 'beat')
    expect(beats).toHaveLength(7)
    expect(beats[0]!.act).toEqual([{ actor: 'robot', do: 'sleep' }])
    expect(beats[0]!.text).toMatch(/three things at once/)
    expect(beats[1]!.focus).toBe('console')
    expect(beats[1]!.text).toMatch(/whole list of instructions/)
    expect(beats[2]!.text).toMatch(/does nothing/)
    expect(beats[3]!.focus).toBe('run')
    // One fixture a beat, each with the kind of value it needs.
    expect(beats[4]!.text).toMatch(/lamp.*`power`.*`True`/)
    expect(beats[5]!.text).toMatch(/sign.*`name`.*words/)
    expect(beats[6]!.text).toMatch(/battery.*`charge`.*number/)
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
          expect(progress(wake, over([s])) === wake.steps.length).toBe(solved)
          if (solved) woke++
        }
    expect(woke).toBeGreaterThan(0)
  })

  it('does not wake on a power the lamp would not light for', () => {
    const name = bound('name', 'str', "'Bolt'")
    const charge = bound('charge', 'int', '72')
    for (const power of [bound('power', 'int', '0'), bound('power', 'bool', 'False')]) {
      const e = over([world(power, name, charge)])
      expect(progress(wake, e)).toBeLessThan(wake.steps.length)
      expect(guidance(wake, e).text).toMatch(/lamp is still dark: `power` needs to be `True`/)
    }
  })

  it('names a name set to the wrong kind, which the hint strip no longer can (R10)', () => {
    const power = bound('power', 'bool', 'True')
    const name = bound('name', 'str', "'Bolt'")
    const charge = bound('charge', 'int', '72')
    // Nothing set yet: the task itself, and the strip lists what is missing.
    expect(guidance(wake, NOTHING).text).toMatch(/Give `power`, `name` and `charge` values/)
    // One still missing: still the task.
    expect(guidance(wake, over([world(bound('power', 'int', '0'), name)])).text).toMatch(/Give `power`/)
    expect(guidance(wake, over([world(power, bound('name', 'str', "''"), charge)])).text).toMatch(/sign is still blank/)
    expect(guidance(wake, over([world(power, name, bound('charge', 'str', "'full'"))])).text).toMatch(/battery can't read that/)
    // The first fixture still wrong is the one named.
    expect(guidance(wake, over([world(bound('power', 'int', '0'), name, bound('charge', 'str', "'full'"))])).text).toMatch(/lamp/)
  })
})
