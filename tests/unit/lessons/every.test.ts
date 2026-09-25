/**
 * What every lesson must be, registered or not: something to say at the
 * start, an outro that is not a step, progress that only moves forward,
 * and — for the beat model — lines short enough to be one idea each
 * (docs/PEDAGOGY.md R2).
 */
import { describe, expect, it } from 'vitest'
import { LESSONS, guidance, progress, script, talkingToHumans, threeKinds, type Evidence, type Lesson } from '../../../content/lessons'
import { ACTIVITIES } from '../../../content/activities'
import { EMPTY, NOTHING, over, snap, th, value } from './fixtures'
import type { Binding } from '../../../src/memory/model'

const ALL: Lesson[] = [...Object.values(LESSONS), threeKinds, talkingToHumans]

const outroLines = (l: Lesson): string[] => (typeof l.outro === 'string' ? [l.outro] : l.outro.map((b) => b.say))

describe('the registry', () => {
  it('keys each lesson by its own id', () => {
    for (const [id, lesson] of Object.entries(LESSONS)) expect(lesson.id).toBe(id)
  })

  it('has every lesson an activity names, and nothing no activity plays', () => {
    const named = new Set(ACTIVITIES.flatMap((a) => (a.lesson ? [a.lesson] : [])))
    for (const id of named) expect(LESSONS[id], id).toBeDefined()
    for (const id of Object.keys(LESSONS)) expect(named.has(id), `${id} is played by no activity`).toBe(true)
  })
})

describe.each(ALL.map((l) => [l.id, l] as const))('%s', (_id, lesson) => {
  it('starts at the beginning and has something to say there', () => {
    expect(progress(lesson, NOTHING)).toBe(0)
    expect(guidance(lesson, NOTHING).text).not.toBe('')
  })

  it('has an outro that is not one of its steps', () => {
    const lines = outroLines(lesson)
    expect(lines.length).toBeGreaterThan(0)
    for (const l of lines) {
      expect(l).not.toBe('')
      expect(lesson.steps.map((s) => s.say)).not.toContain(l)
    }
  })

  it('tells its beats and praise one short line at a time (R2)', () => {
    // A beat is one idea, which the rubric measures as ≤ 110 characters.
    // Steps' asks are older than the rubric and are held to it as each
    // lesson is rewritten, not here.
    const lines = [
      ...lesson.steps.flatMap((s) => (s.beats ?? []).map((b) => b.say)),
      ...lesson.steps.flatMap((s) => (typeof s.praise === 'string' ? [s.praise] : [])),
      ...(typeof lesson.outro === 'string' ? [] : lesson.outro.map((b) => b.say)),
    ]
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(110)
  })

  it('ends every script on the item a player rests on', () => {
    const s = script(lesson, NOTHING)
    expect(s.rest).toBe(s.items.length - 1)
    expect(s.items[s.rest]!.asking).toBe(true)
    // Everything before the ask is narration.
    for (const item of s.items.slice(0, s.rest)) expect(item.asking).toBe(false)
  })

  it('only ever moves forward as evidence accumulates', () => {
    const objects = [value('int', '10'), value('int', '99'), value('str', "'Mira'"), value('int', '7')]
    const bindings: Binding[] = [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
      { name: 'customer', scope: 'global', target: "v:str:'Mira'" },
      { name: 'parcels', scope: 'global', target: 'v:int:7' },
    ]
    const memories = [EMPTY, snap(objects.slice(0, 1), bindings.slice(1, 2)), snap(objects, bindings)]
    const said = [
      th('int', '10'),
      th('float', '4.5'),
      th('str', "'botgineer'"),
      th('bool', 'False'),
      th('int', '42'),
      th('int', '20'),
      th('int', '14'),
    ]
    const stages: Evidence[] = said.map((_, i) =>
      over(memories.slice(0, Math.min(memories.length, 1 + Math.floor(i / 3))), said.slice(0, i)),
    )
    const seen = stages.map((e) => progress(lesson, e))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })
})
