/**
 * v2, Meet the robot (`v2-meet`): the crow types two demonstrations into
 * the console before the player is asked for a number.
 */
import { describe, expect, it } from 'vitest'
import { progress, script, v2meet } from '../../../content/lessons'
import { NOTHING, line, th, typed } from './fixtures'

describe('v2-meet', () => {
  it('demonstrates twice, each typed line answered by the thought it makes, before asking', () => {
    const s = script(v2meet, NOTHING)
    const demos = s.items.filter((i) => i.types !== undefined)
    expect(demos.map((d) => [d.types, d.thought])).toEqual([
      ['7', '7'],
      ['42', '42'],
    ])
    // Every demonstration is narration, told before the question.
    expect(demos.every((d) => d.kind === 'beat' && !d.asking)).toBe(true)
    expect(s.items.findIndex((i) => i.types !== undefined)).toBeLessThan(s.rest)
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', tag: 'you' })
    expect(s.items[s.rest]!.types).toBeUndefined()
  })

  it('does not count a demonstration: only the player\'s own number does the step', () => {
    expect(progress(v2meet, NOTHING)).toBe(0)
    expect(progress(v2meet, typed(line('5', th('int', '5'))))).toBe(1)
    expect(progress(v2meet, typed(line('"5"', th('str', "'5'"))))).toBe(0)
  })
})
