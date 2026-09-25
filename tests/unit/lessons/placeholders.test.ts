/**
 * The placeholder lessons the new levels play until their content is
 * written (`meet`, `types`, `choose`, `wake`). Each is small, but it must
 * be playable and finishable, because the map, practice and the browser
 * journeys stand on it. The content workstreams replace these tests with
 * their lessons.
 */
import { describe, expect, it } from 'vitest'
import { castAt, choose, guidance, meet, progress, script, types, wake } from '../../../content/lessons'
import { NOTHING, bound, failed, line, over, snap, th, typed } from './fixtures'

describe('meet (placeholder)', () => {
  it('tells its beats before it asks, and asks for a number', () => {
    const s = script(meet, NOTHING)
    expect(s.items.filter((i) => i.kind === 'beat').length).toBeGreaterThan(1)
    expect(s.items[s.rest]!.kind).toBe('ask')
    expect(progress(meet, typed(line('7', th('int', '7'))))).toBe(1)
    expect(progress(meet, typed(line('1.5', th('float', '1.5'))))).toBe(1)
    expect(progress(meet, typed(line('"7"', th('str', "'7'"))))).toBe(0)
  })

  it('praises the number it was given, then closes', () => {
    const s = script(meet, typed(line('12', th('int', '12'))))
    expect(s.finished).toBe(true)
    expect(s.items[0]).toMatchObject({ kind: 'praise', text: 'It\'s thinking of `12`!' })
    expect(s.items.slice(1).every((i) => i.kind === 'outro')).toBe(true)
    expect(meet.takeaway).toBeTruthy()
  })

  it('replies to a number word', () => {
    expect(guidance(meet, typed(failed('seven', 'NameError'))).text).toMatch(/doesn't know the word `seven`/)
  })

  it('puts the robot to sleep and wakes it', () => {
    const asleep = script(meet, NOTHING).items.findIndex((i) => i.act?.some((a) => a.do === 'sleep'))
    expect(castAt(meet, NOTHING, asleep).asleep).toEqual(['robot'])
    expect(castAt(meet, NOTHING).asleep).toEqual([])
  })
})

describe('types (placeholder)', () => {
  it('finishes on its one step and brings Mira on in the outro', () => {
    expect(progress(types, typed(line('True', th('bool', 'True'))))).toBe(1)
    expect(castAt(types, NOTHING).hidden).toEqual(['courier'])
    expect(castAt(types, typed(line('True', th('bool', 'True')))).hidden).toEqual([])
  })
})

describe('choose (placeholder)', () => {
  it('finishes on its one question, and praises the reason', () => {
    const s = script(choose, typed(line('False', th('bool', 'False'))))
    expect(s.finished).toBe(true)
    expect(s.items[0]!.text).toMatch(/because|so a `bool`/)
  })
})

describe('wake (placeholder)', () => {
  const power = (repr: string, type = 'bool') => bound('power', type, repr)
  const name = bound('name', 'str', "'Bolt'")
  const charge = bound('charge', 'int', '72')
  const world = (...xs: ReturnType<typeof bound>[]) => over([snap(xs.map((x) => x.object), xs.map((x) => x.binding))])

  it('wakes on what the bay watches, all three', () => {
    expect(progress(wake, world(power('True'), name, charge))).toBe(1)
    expect(progress(wake, world(power('True'), name))).toBe(0)
  })

  it('does not wake on a power the lamp would not light for', () => {
    expect(progress(wake, world(power('0', 'int'), name, charge))).toBe(0)
    expect(progress(wake, world(power('False'), name, charge))).toBe(0)
  })

  it('does not take a word for a charge', () => {
    expect(progress(wake, world(power('True'), name, bound('charge', 'str', "'full'")))).toBe(0)
  })
})
