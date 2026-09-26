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
import { castAt, cloud, guidance, script, staging, type Lesson } from '../../../content/lessons'
import { beforeLast, everBy, heard, points, targetOf, was, type Evidence, type Line, type LineMemory } from '../../../content/lessons/core'
import type { MemorySnapshot } from '../../../src/memory/model'
import { EMPTY, NOTHING, bound, failed, line, snap, th, typed } from './fixtures'

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

/**
 * A lesson written the way every lesson was before beats: steps with a
 * question each, no beats, no praise, a string outro. Local on purpose —
 * this once borrowed a real lesson for it, and went red the day that
 * lesson was given beats, which says nothing about the engine.
 */
const PLAIN: Lesson = {
  id: 'plain',
  teaches: [],
  steps: [
    { say: 'Work out `7 * 6`.', done: (e) => heard(e, (t) => t.repr === '42' && t.source === '7 * 6') },
    { say: 'Now `2 + 2`.', done: (e) => heard(e, was('int', '4')) },
  ],
  outro: 'Well done.',
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
    for (const e of [NOTHING, typed(line('42', th('int', '42'))), typed(line('7 * 6', th('int', '42')))]) {
      const s = script(PLAIN, e)
      expect(s.items).toHaveLength(1)
      expect({ text: s.items[0]!.text, speaker: s.items[0]!.speaker }).toEqual(guidance(PLAIN, e))
    }
    // Finished, it is the outro alone.
    const done = typed(line('7 * 6', th('int', '42')), line('2 + 2', th('int', '4')))
    expect(script(PLAIN, done).items).toEqual([expect.objectContaining({ kind: 'outro', text: 'Well done.' })])
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

  // The narration rule (docs/AUTHORING.md): a beat whose picture differs
  // from the standing one only in narration fields changes that picture in
  // place. The beat's own fields are adopted — the lamp's switch flips, the
  // balance's lamp lights — and the element is kept, so the change plays
  // as a transition rather than a new picture arriving.
  const NARRATED: Lesson = {
    id: 'n',
    teaches: [],
    ordered: true,
    steps: [
      {
        beats: [
          { say: 'A lamp.' },
          { say: 'On.', show: { kind: 'lamp', demo: 'on' } },
          { say: 'Off.', show: { kind: 'lamp', demo: 'off' } },
        ],
        say: 'Turn it on.',
        ask: 'Lamp?',
        show: LAMP,
        done: (e) => heard(e, was('bool', 'True')),
      },
      {
        beats: [
          { say: 'A balance.', show: { kind: 'balance', left: 3, right: 5, op: '>' } },
          { say: 'It tips.', show: { kind: 'balance', left: 3, right: 5, op: '>', lamp: true } },
        ],
        say: 'Is 7 * 6 the same as 42?',
        show: LAMP,
        done: (e) => heard(e, was('bool', 'False')),
      },
    ],
    outro: 'Done.',
  }

  it('adopts a narration change on the step picture, and keeps its element', () => {
    const n = (i: number) => staging(NARRATED, NOTHING, i).current!
    expect(n(0)).toMatchObject({ key: 'n:0', prop: LAMP })
    expect(n(1)).toMatchObject({ key: 'n:0', prop: { kind: 'lamp', demo: 'on' } })
    expect(n(2)).toMatchObject({ key: 'n:0', prop: { kind: 'lamp', demo: 'off' } })
    // The ask puts the narration back: a demonstration never answers the
    // question that follows it.
    expect(n(3)).toMatchObject({ key: 'n:0', prop: LAMP, ask: 'Lamp?' })
  })

  it('adopts a narration change on a beat picture too, keyed by the beat that set it', () => {
    const e = typed(line('True', th('bool', 'True')))
    // Step 0 has no praise, so step 1's items are its two beats and the ask.
    const n = (i: number) => staging(NARRATED, e, i).current!
    expect(n(0)).toMatchObject({ key: 'n:1:b0', prop: { kind: 'balance', op: '>' } })
    expect(n(0).prop).not.toHaveProperty('lamp')
    expect(n(1)).toMatchObject({ key: 'n:1:b0', prop: { kind: 'balance', lamp: true } })
    // A different picture on the ask: the step's own, as its own element.
    expect(n(2)).toMatchObject({ key: 'n:1', prop: LAMP })
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
    expect(castAt(PLAIN, NOTHING)).toEqual({ hidden: [], asleep: [], acting: [] })
  })
})

describe('a line that moved the lesson through memory', () => {
  // Evidence the way the workbench builds it: memory after each accepted
  // line, then memory now; the last line carries the entry it added.
  const x10 = bound('x', 'int', '10')
  const named = snap([x10.object], [x10.binding])
  // `same`: the console's current snapshot *is* the last accepted entry
  // (the workbench shows it, failed line or not); otherwise a copy, like a
  // separate extraction.
  const played = (lines: [Line, MemorySnapshot | null][], same = false): Evidence => {
    const memory: MemorySnapshot[] = []
    const sources: LineMemory[] = []
    const thoughts: Evidence['thoughts'] = []
    let last: Line | null = null
    for (const [l, m] of lines) {
      const entry = m ? { ...m } : null
      last = l.ok && entry ? { ...l, memory: entry } : l
      if (l.ok && entry) memory.push(entry)
      if (l.ok && entry) sources.push({ source: l.source, memory: entry })
      if (l.ok && l.thought) thoughts.push({ ...l.thought, source: l.source })
    }
    const now = memory[memory.length - 1] ?? EMPTY
    const shown = same ? now : { ...now }
    return { snapshot: shown, thoughts, history: [...memory, shown], lines: sources, last }
  }

  const BIND: Lesson = {
    id: 'bind',
    teaches: [],
    steps: [
      { say: 'Name it: `x = 10`.', done: (e) => e.history.some((m) => points(m, 'x', '10')) },
      {
        say: 'Ask for it back: `x`.',
        done: (e) => heard(e, (t) => t.source === 'x'),
        // Calls everything a miss: it must only ever be asked about a line
        // that did not move the lesson.
        nudge: () => 'That was a miss.',
      },
    ],
    outro: 'Done.',
  }

  it('takes the line back out: its memory and its thought', () => {
    const e = played([[line('x = 10', null), named]])
    const was = beforeLast(e)
    expect(targetOf(was.snapshot, 'x')).toBeNull()
    expect(was.history.some((m) => targetOf(m, 'x') !== null)).toBe(false)
    const thought = played([[line('x = 10', null), named], [line('x', th('int', '10')), named]])
    expect(beforeLast(thought).thoughts).toEqual([])
    expect(targetOf(beforeLast(thought).snapshot, 'x')).not.toBeNull()
    // A line that failed left nothing behind.
    const miss = { ...e, last: failed('y', 'NameError') }
    expect(beforeLast(miss)).toBe(miss)
  })

  it('takes it back out when memory now is the very entry it added, and its source with it', () => {
    const e = played([[line('x = 10', null), named]], true)
    expect(e.snapshot).toBe(e.history[0])
    const was = beforeLast(e)
    expect(targetOf(was.snapshot, 'x')).toBeNull()
    expect(was.lines).toEqual([])
    expect(everBy(e, (src, m) => src === 'x = 10' && points(m, 'x', '10'))).toBe(true)
    expect(everBy(was, (src) => src === 'x = 10')).toBe(false)
  })

  it('everBy asks which line made the change, and holds of nothing with no sources', () => {
    const e = played([[line('x = 10', null), named], [line('z = 1', null), named]])
    expect(everBy(e, (src, m) => src.startsWith('x') && points(m, 'x', '10'))).toBe(true)
    expect(everBy(e, (src, m) => src.startsWith('y') && points(m, 'x', '10'))).toBe(false)
    expect(everBy({ ...e, lines: undefined }, () => true)).toBe(false)
  })

  it('does not answer the binding that did a step as a miss to the next', () => {
    const e = played([[line('x = 10', null), named]])
    const s = script(BIND, e)
    expect(s).toMatchObject({ at: 1, before: 0 })
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Ask for it back: `x`.' })
    // A line after it that did nothing is the next step's miss, as ever.
    const after = script(BIND, played([[line('x = 10', null), named], [line('z = 1', null), named]]))
    expect(after.items[after.rest]).toMatchObject({ kind: 'reply', text: 'That was a miss.' })
  })
})

describe('the cloud', () => {
  const forty2 = { type: 'int', repr: '42', source: '7 * 6' }
  const ten = { type: 'int', repr: '10', source: 'x' }
  const item = (kind: 'praise' | 'beat' | 'ask', thought?: string) => ({ kind, asking: kind === 'ask', text: '', thought })
  // The step began with 42 the newest thought, and 42 was what moved it.
  const answered = { stale: forty2, answer: forty2 }

  it('holds the answer while its praise is read, and lets it go after', () => {
    expect(cloud(item('praise'), forty2, answered)).toBe('42')
    expect(cloud(item('beat'), forty2, answered)).toBeNull()
    // `42` over "Ask for it back: x" read as an answer to it.
    expect(cloud(item('ask'), forty2, answered)).toBeNull()
  })

  it('does not bring back an older thought when a binding did the step', () => {
    // `x = 10` moved it: nothing was thought, and 42 is from before.
    expect(cloud(item('praise'), forty2, { stale: forty2, answer: undefined })).toBeNull()
  })

  it('shows what was thought since the step began, beat or ask', () => {
    expect(cloud(item('ask'), ten, answered)).toBe('10')
    expect(cloud(item('beat'), ten, answered)).toBe('10')
  })

  it('lets a beat set its own, or empty it', () => {
    expect(cloud(item('beat', '?'), forty2, answered)).toBe('?')
    expect(cloud(item('beat', ''), ten, answered)).toBe('')
    expect(cloud(item('ask'), undefined, answered)).toBeNull()
  })
})
