/**
 * The beat model (docs/PEDAGOGY.md §7): what `script` lays out, and what
 * the stage and the cast show at each item of it.
 *
 * Played against a small lesson made for the purpose, so the tests read
 * as the contract rather than as one lesson's words; and against a lesson
 * with no beats, which must behave exactly as it did before beats.
 */
import { describe, expect, it } from 'vitest'
import { CROW_NAME } from '../../../content/cast'
import { castAt, guidance, operations, script, staging, type Lesson } from '../../../content/lessons'
import { heard, was } from '../../../content/lessons/core'
import { NOTHING, failed, line, th, typed } from './fixtures'

const LAMP = { kind: 'lamp' } as const
const GLASS = { kind: 'glass', level: 0.5 } as const
const FISH = { kind: 'fish' } as const

const DEMO: Lesson = {
  id: 'demo',
  teaches: [],
  ordered: true,
  finale: { kind: 'kinds' },
  steps: [
    {
      beats: [
        { say: 'I am {CROW_NAME}.', act: [{ actor: 'robot', do: 'sleep' }] },
        { say: 'A glass.', show: GLASS, act: [{ actor: 'robot', do: 'wake' }] },
        { say: 'Still the glass.', thought: '7', focus: 'console', speaker: 'courier', act: [{ actor: 'courier', do: 'enter' }] },
      ],
      say: 'Turn the lamp on.',
      ask: 'Lamp?',
      show: LAMP,
      tag: 'you',
      done: (e) => heard(e, was('bool', 'True')),
      nudge: (l) => (l.thought?.repr === 'False' ? 'Still dark.' : undefined),
      praise: (a) => `Lit, by \`${a?.repr}\`.`,
    },
    {
      beats: [{ say: 'Mira waves.', act: [{ actor: 'courier', do: 'wave' }] }],
      say: 'Is a fish a bird?',
      show: FISH,
      tag: 'robot',
      speaker: 'courier',
      done: (e) => heard(e, was('bool', 'False')),
      praise: 'Yes or no, so a `bool`.',
    },
    {
      say: 'How many?',
      show: FISH,
      done: (e) => heard(e, was('int', '3')),
    },
  ],
  outro: [{ say: 'Done.' }, { say: 'All sorted.', show: GLASS, act: [{ actor: 'courier', do: 'hide' }] }],
  takeaway: 'Every value has a kind.',
}

const RIGHT = [line('True', th('bool', 'True')), line('False', th('bool', 'False')), line('3', th('int', '3'))]

describe('script', () => {
  it('lays out the beats, then the ask, and rests on the ask', () => {
    const s = script(DEMO, NOTHING)
    expect(s.at).toBe(0)
    expect(s.finished).toBe(false)
    expect(s.items.map((i) => i.kind)).toEqual(['beat', 'beat', 'beat', 'ask'])
    expect(s.items.map((i) => i.asking)).toEqual([false, false, false, true])
    expect(s.rest).toBe(3)
    expect(s.items[3]).toMatchObject({ text: 'Turn the lamp on.', show: LAMP, tag: 'you' })
  })

  it('carries everything a beat says and does', () => {
    const [b0, b1, b2] = script(DEMO, NOTHING).items
    // The crow's name is one constant, filled in wherever a line asks.
    expect(b0!.text).toBe(`I am ${CROW_NAME}.`)
    expect(b0!.speaker).toBeUndefined()
    expect(b1).toMatchObject({ show: GLASS, beat: 1 })
    expect(b2).toMatchObject({ thought: '7', focus: 'console', speaker: 'courier', beat: 2 })
  })

  it('swaps the ask for a reply to a miss, in the same place', () => {
    const s = script(DEMO, typed(line('False', th('bool', 'False'))))
    expect(s.items).toHaveLength(4)
    expect(s.items[3]).toMatchObject({ kind: 'reply', asking: true, text: 'Still dark.' })
    // A nudge with nothing to say leaves the question standing.
    expect(script(DEMO, typed(line('x = 1', null))).items[3]!.kind).toBe('ask')
  })

  it('opens the next step on the praise for the last, naming the answer', () => {
    const s = script(DEMO, typed(RIGHT[0]!))
    expect(s.at).toBe(1)
    expect(s.items.map((i) => i.kind)).toEqual(['praise', 'beat', 'ask'])
    expect(s.items[0]).toMatchObject({ text: 'Lit, by `True`.', asking: false })
    expect(s.items[0]!.speaker).toBeUndefined()
    expect(s.items[2]).toMatchObject({ speaker: 'courier', tag: 'robot' })
  })

  it('names the thought that did the step, not the newest one', () => {
    // Ordered: `True` did step 0; the later `7` did nothing and must not
    // be praised as its answer.
    const s = script(DEMO, typed(RIGHT[0]!, line('7', th('int', '7'))))
    expect(s.items[0]!.text).toBe('Lit, by `True`.')
  })

  it('keeps the praise through a miss on the next step, so nothing shifts under the index', () => {
    const s = script(DEMO, typed(RIGHT[0]!, failed('fish', 'NameError')))
    expect(s.items.map((i) => i.kind)).toEqual(['praise', 'beat', 'ask'])
  })

  it('has no praise item for a step with none', () => {
    const s = script(DEMO, typed(...RIGHT.slice(0, 2), line('3', th('int', '3'))))
    // Step 2 has no praise, so the finished lesson opens on the outro.
    expect(s.finished).toBe(true)
    expect(s.items.map((i) => i.kind)).toEqual(['outro', 'outro'])
    expect(s.rest).toBe(1)
    expect(s.items.every((i) => !i.asking)).toBe(true)
  })

  it('ends on the praise of the last step and the outro', () => {
    const withPraise: Lesson = { ...DEMO, steps: DEMO.steps.slice(0, 2) }
    const s = script(withPraise, typed(...RIGHT.slice(0, 2)))
    expect(s.items.map((i) => [i.kind, i.text])).toEqual([
      ['praise', 'Yes or no, so a `bool`.'],
      ['outro', 'Done.'],
      ['outro', 'All sorted.'],
    ])
  })

  it('gives a string outro its speaker', () => {
    const s = script({ ...DEMO, outro: 'Bye.', outroSpeaker: 'courier' }, typed(...RIGHT))
    expect(s.items).toEqual([expect.objectContaining({ kind: 'outro', text: 'Bye.', speaker: 'courier' })])
  })

  it('is one item for a lesson with no beats, and guidance is that item', () => {
    // A lesson written the old way: one ask per step, a string outro.
    const plain: Lesson = {
      id: 'plain',
      teaches: [],
      steps: [{ say: 'Think of 42.', done: (e) => heard(e, was('int', '42')) }],
      outro: 'Done.',
    }
    for (const e of [NOTHING, typed(line('41', th('int', '41'))), typed(line('42', th('int', '42')))]) {
      const s = script(plain, e)
      expect(s.items).toHaveLength(1)
      expect({ text: s.items[0]!.text, speaker: s.items[0]!.speaker }).toEqual(guidance(plain, e))
    }
  })

  it('makes guidance the item the player rests on', () => {
    expect(guidance(DEMO, NOTHING).text).toBe('Turn the lamp on.')
    expect(guidance(DEMO, typed(line('False', th('bool', 'False')))).text).toBe('Still dark.')
    expect(guidance(DEMO, typed(...RIGHT)).text).toBe('All sorted.')
  })
})

describe('staging, beat by beat', () => {
  const at = (e = NOTHING) => (i: number) => staging(DEMO, e, i)

  it('falls back to the step picture until a beat sets one', () => {
    const s = at()(0)
    expect(s.current).toMatchObject({ key: 'demo:0', prop: LAMP, answer: null, verdict: null })
    // The question is not asked yet, so it is not under the picture yet.
    expect(s.current!.ask).toBeUndefined()
  })

  it('keeps a beat picture as one element across the beats that share it', () => {
    expect(at()(1).current).toMatchObject({ key: 'demo:0:b1', prop: GLASS })
    expect(at()(2).current).toMatchObject({ key: 'demo:0:b1', prop: GLASS })
  })

  it('brings the step picture back for the ask, as the element it was', () => {
    expect(at()(3).current).toMatchObject({ key: 'demo:0', prop: LAMP, ask: 'Lamp?' })
    expect(staging(DEMO, NOTHING)).toEqual(at()(3))
  })

  it('draws a miss into the ask, and only into the ask', () => {
    const miss = typed(line('False', th('bool', 'False')))
    expect(at(miss)(3).current).toMatchObject({ verdict: 'miss', answer: th('bool', 'False') })
    expect(at(miss)(0).current).toMatchObject({ verdict: null, answer: null })
  })

  it('holds the answered picture, lit, while the praise is read', () => {
    const e = typed(RIGHT[0]!)
    const praise = at(e)(0)
    expect(praise.current).toMatchObject({ key: 'demo:0', prop: LAMP, verdict: 'right', answer: th('bool', 'True') })
    expect(praise.leaving).toBeNull()
    // After it, the next picture simply arrives: the payoff was the praise.
    const next = at(e)(1)
    expect(next.current).toMatchObject({ key: 'demo:1', prop: FISH })
    expect(next.leaving).toBeNull()
  })

  it('shows the outro beat pictures, and the finale before them', () => {
    const e = typed(...RIGHT)
    expect(at(e)(0).current).toMatchObject({ key: 'demo:3', prop: { kind: 'kinds' } })
    expect(at(e)(1).current).toMatchObject({ key: 'demo:3:b1', prop: GLASS })
  })

  it('clamps an index outside the script', () => {
    expect(at()(99)).toEqual(at()(3))
    expect(at()(-4)).toEqual(at()(0))
  })
})

describe('the cast, beat by beat', () => {
  it('keeps an actor who enters off stage until the beat that brings them on', () => {
    expect(castAt(DEMO, NOTHING, 0).hidden).toEqual(['courier'])
    expect(castAt(DEMO, NOTHING, 1).hidden).toEqual(['courier'])
    expect(castAt(DEMO, NOTHING, 2).hidden).toEqual([])
    // Once a later step is reached, the beats before it have all been told.
    expect(castAt(DEMO, typed(RIGHT[0]!), 0).hidden).toEqual([])
  })

  it('sends them off again on hide', () => {
    const e = typed(...RIGHT)
    expect(castAt(DEMO, e, 0).hidden).toEqual([])
    expect(castAt(DEMO, e, 1).hidden).toEqual(['courier'])
  })

  it('keeps a sleep until a wake', () => {
    expect(castAt(DEMO, NOTHING, 0).asleep).toEqual(['robot'])
    expect(castAt(DEMO, NOTHING, 1).asleep).toEqual([])
  })

  it('plays a one-shot only while its beat shows', () => {
    const e = typed(RIGHT[0]!)
    expect(castAt(DEMO, e, 0).acting).toEqual([])
    expect(castAt(DEMO, e, 1).acting).toEqual([{ actor: 'courier', do: 'wave' }])
    expect(castAt(DEMO, e, 2).acting).toEqual([])
  })

  it('leaves a lesson with no actions alone', () => {
    expect(castAt(operations, NOTHING)).toEqual({ hidden: [], asleep: [], acting: [] })
  })
})
