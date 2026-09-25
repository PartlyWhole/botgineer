/**
 * Meet the robot (`meet`): introductions, then one number, thought of.
 */
import { describe, expect, it } from 'vitest'
import { castAt, guidance, meet, progress, script, type Line } from '../../../content/lessons'
import { NOTHING, failed, line, th, typed } from './fixtures'

describe('meet', () => {
  it('introduces everyone before it asks anything', () => {
    const s = script(meet, NOTHING)
    expect(s.items.filter((i) => i.kind === 'beat').length).toBeGreaterThanOrEqual(5)
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Make the robot think of a number.', tag: 'you' })
    // The console is pointed at (it pulses) before the question, and the
    // robot shows what will happen first.
    const pointing = s.items.findIndex((i) => i.focus === 'console')
    expect(pointing).toBeGreaterThan(0)
    expect(s.items.some((i) => i.thought === '7')).toBe(true)
  })

  it('takes any number, and nothing that is not one', () => {
    expect(progress(meet, typed(line('7', th('int', '7'))))).toBe(1)
    expect(progress(meet, typed(line('1.5', th('float', '1.5'))))).toBe(1)
    expect(progress(meet, typed(line('"7"', th('str', "'7'"))))).toBe(0)
    expect(progress(meet, typed(line('True', th('bool', 'True'))))).toBe(0)
  })

  it('praises the number, and says where it came from', () => {
    const s = script(meet, typed(line('12', th('int', '12'))))
    expect(s.finished).toBe(true)
    expect(s.items[0]).toMatchObject({ kind: 'praise' })
    expect(s.items[0]!.text).toMatch(/`12`, because that's what you wrote/)
    expect(script(meet, typed(line('3 + 4', th('int', '7')))).items[0]!.text).toMatch(/`7`: it worked that out/)
    expect(s.items.slice(1).every((i) => i.kind === 'outro')).toBe(true)
    expect(meet.takeaway).toMatch(/^The robot does nothing until you give it an instruction\./)
  })

  it('lets the thought go on its last line', () => {
    const s = script(meet, typed(line('12', th('int', '12'))))
    expect(s.items[s.rest]!.thought).toBe('')
  })

  it('answers the misses a newcomer makes', () => {
    const reply = (l: Line) => script(meet, typed(l)).items.at(-1)!
    expect(reply(failed('seven', 'NameError'))).toMatchObject({ kind: 'reply', text: expect.stringMatching(/doesn't know the word `seven`/) })
    expect(reply(line('1,5', th('tuple', '(1, 5)'))).text).toMatch(/dot, not a comma: `1.5`/)
    // The console stops on it today, rather than making the pair.
    expect(reply(failed('1,5', 'TypeError')).text).toMatch(/dot, not a comma: `1.5`/)
    expect(reply(line('"7"', th('str', "'7'"))).text).toMatch(/quotes make that a word/i)
    expect(guidance(meet, typed(line('True', th('bool', 'True')))).text).toMatch(/yes-or-no, not a number/)
  })

  it('puts the robot to sleep and wakes it', () => {
    const asleep = script(meet, NOTHING).items.findIndex((i) => i.act?.some((a) => a.do === 'sleep'))
    expect(castAt(meet, NOTHING, asleep).asleep).toEqual(['robot'])
    expect(castAt(meet, NOTHING).asleep).toEqual([])
  })
})
