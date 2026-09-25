/**
 * Names point at objects (Level 4).
 */
import { describe, expect, it } from 'vitest'
import { castAt, guidance, namesPoint, progress, script, staging, type Evidence, type Heard } from '../../../content/lessons'
import type { MemorySnapshot } from '../../../src/memory/model'
import { EMPTY, NOTHING, bound, failed, line, snap, th, value } from './fixtures'

const x10 = bound('x', 'int', '10')
const named = snap([x10.object], [x10.binding])
const aliased = snap([x10.object], [x10.binding, { ...x10.binding, name: 'y' }])
const moved = snap(
  [value('int', '10'), value('int', '99')],
  [
    { name: 'x', scope: 'global', target: 'v:int:99' },
    { name: 'y', scope: 'global', target: 'v:int:10' },
  ],
)

/** A thought, with the line that made it. */
const said = (source: string, type: string, repr: string): Heard => ({ type, repr, source })
const FORTY_TWO = said('7 * 6', 'int', '42')
const BACK = said('x', 'int', '10')

/** Evidence after these memories and thoughts, with the last line typed. */
const at = (history: MemorySnapshot[], thoughts: Heard[], last: ReturnType<typeof line> | null = null): Evidence => ({
  snapshot: history[history.length - 1] ?? EMPTY,
  thoughts,
  history: history.length ? history : [EMPTY],
  last,
})

describe('names: the forgetting first', () => {
  it('opens on the crates the robot has forgotten, and asks it to work them out again', () => {
    const s = script(namesPoint, NOTHING)
    expect(s.items[0]!.text).toMatch(/seven crates/)
    expect(staging(namesPoint, NOTHING, 0).current?.prop.kind).toBe('crates')
    // A demonstration of forgetting: a question mark, not an answer.
    expect(s.items.some((i) => i.thought === '?')).toBe(true)
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', tag: 'robot' })
    expect(guidance(namesPoint, NOTHING).text).toContain('7 * 6')
  })

  it('is passed by the robot working it out, and not by a typed 42', () => {
    expect(progress(namesPoint, at([EMPTY], [FORTY_TWO]))).toBe(1)
    const typed42 = at([EMPTY], [said('42', 'int', '42')], line('42', th('int', '42')))
    expect(progress(namesPoint, typed42)).toBe(0)
    expect(guidance(namesPoint, typed42).text).toMatch(/you remembering/)
    expect(progress(namesPoint, at([EMPTY], [said('6 * 7', 'int', '42')]))).toBe(1)
  })

  it('is not passed by dressing a remembered 42 up as a sum', () => {
    for (const src of ['42 * 1', '21 * 2', '7 * 6 * 1']) {
      const e = at([EMPTY], [said(src, 'int', '42')], line(src, th('int', '42')))
      expect(progress(namesPoint, e)).toBe(0)
      expect(guidance(namesPoint, e).text).toMatch(/not from seven crates of six/)
    }
  })

  it('empties the cloud after the recompute, since the robot let it go', () => {
    const s = script(namesPoint, at([EMPTY], [FORTY_TWO]))
    for (const i of s.items.filter((i) => i.kind === 'beat')) expect(i.thought).toBe('')
  })

  it('praises the recompute for the reason: it kept nothing', () => {
    const s = script(namesPoint, at([EMPTY], [FORTY_TWO]))
    expect(s.items[0]).toMatchObject({ kind: 'praise' })
    expect(s.items[0]!.text).toMatch(/because it kept nothing/)
    // The crates go with the praise: the naming beats stand on memory.
    expect(staging(namesPoint, at([EMPTY], [FORTY_TWO]), 1).current).toBeNull()
  })
})

describe('names point at objects', () => {
  it('wants the name, then points at memory the moment it appears', () => {
    const e = at([named], [FORTY_TWO])
    expect(progress(namesPoint, e)).toBe(2)
    const s = script(namesPoint, e)
    const look = s.items.find((i) => i.focus === 'memory')!
    expect(look.text).toMatch(/Look below: there's `x`, and an arrow to `10`/)
    // The praise, then the pointing: nothing in between.
    expect(s.items.indexOf(look)).toBe(1)
  })

  it('replies to the usual naming misses', () => {
    const reply = (l: ReturnType<typeof line>) => guidance(namesPoint, at([EMPTY], [FORTY_TWO], l)).text
    expect(reply(failed('x == 10', 'NameError'))).toMatch(/One `=` gives a name/)
    expect(reply(failed('10 = x', 'SyntaxError'))).toMatch(/name goes first/)
    expect(guidance(namesPoint, at([EMPTY], [FORTY_TWO, said('10', 'int', '10')], line('10', th('int', '10')))).text).toMatch(/let it go/)
    expect(reply(line('X = 10', null))).toMatch(/capitals/)
  })

  it('wants it read back with the name, and a typed 10 does not count', () => {
    // The bug this lesson had: `worked(e, '10')` passed on typing `10`.
    const typed10 = at([named], [FORTY_TWO, said('10', 'int', '10')], line('10', th('int', '10')))
    expect(progress(namesPoint, typed10)).toBe(2)
    expect(guidance(namesPoint, typed10).text).toMatch(/you remembering `10`/)
    // Worked out *from* x is not asking for it back either.
    const sum = at([named], [FORTY_TWO, said('x + 0', 'int', '10')], line('x + 0', th('int', '10')))
    expect(progress(namesPoint, sum)).toBe(2)
    // And the reply names that mistake, not "you remembering".
    expect(guidance(namesPoint, sum).text).toMatch(/from `x`, a sum/)
    const printed = at([named], [FORTY_TWO, said('print(x)', 'NoneType', 'None')], line('print(x)', th('NoneType', 'None')))
    expect(guidance(namesPoint, printed).text).toMatch(/`print` writes it out/)
    expect(progress(namesPoint, at([named], [FORTY_TWO, BACK]))).toBe(3)
  })

  it('names the card an object before calling the arrow what a name is', () => {
    const s = script(namesPoint, at([named], [FORTY_TWO]))
    const card = s.items.findIndex((i) => /is an object/.test(i.text))
    const name = s.items.findIndex((i) => /arrow is what a name is/.test(i.text))
    expect(card).toBeGreaterThan(0)
    expect(s.items[card]!.focus).toBe('memory')
    expect(name).toBeGreaterThan(card)
  })

  it('does not call the right `x = 10` a miss at the next ask', () => {
    const e = at([named], [FORTY_TWO], line('x = 10', null))
    expect(progress(namesPoint, e)).toBe(2)
    expect(script(namesPoint, e).items.at(-1)!.kind).toBe('ask')
  })

  it('says the robot does the looking before it asks', () => {
    const s = script(namesPoint, at([named], [FORTY_TWO]))
    expect(s.items[s.rest]!.tag).toBe('robot')
    expect(s.items.slice(0, s.rest).some((i) => /Don't type `10`/.test(i.text))).toBe(true)
  })

  it('praises the read-back for following the arrow', () => {
    const s = script(namesPoint, at([named], [FORTY_TWO, BACK]))
    expect(s.items[0]!.text).toMatch(/followed the arrow/)
  })

  it('asks for y = x, and replies to the wrong way round', () => {
    const e = at([named], [FORTY_TWO, BACK], failed('x = y', 'NameError'))
    expect(guidance(namesPoint, e).text).toMatch(/new name goes first: `y = x`/)
    expect(progress(namesPoint, at([named, aliased], [FORTY_TWO, BACK]))).toBe(4)
  })

  it('praises the alias for the reason, and does not call it a miss after', () => {
    const e = at([named, aliased], [FORTY_TWO, BACK], line('y = x', null))
    const s = script(namesPoint, e)
    expect(s.items[0]).toMatchObject({ kind: 'praise' })
    expect(s.items[0]!.text).toMatch(/because `y = x`/)
    expect(s.items[s.rest]!.kind).toBe('ask')
  })

  it('replies when x moves before y has joined it', () => {
    const e = at([named], [FORTY_TWO, BACK], line('x = 100', null))
    expect(guidance(namesPoint, e).text).toMatch(/moved `x` to a new object/)
  })

  it('judges the move, not the numbers: x moved early still finishes', () => {
    const x100 = snap([value('int', '100')], [{ name: 'x', scope: 'global', target: 'v:int:100' }])
    const both100 = snap([value('int', '100')], [
      { name: 'x', scope: 'global', target: 'v:int:100' },
      { name: 'y', scope: 'global', target: 'v:int:100' },
    ])
    const split = snap([value('int', '100'), value('int', '99')], [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:100' },
    ])
    expect(progress(namesPoint, at([named, x100, both100], [FORTY_TWO, BACK]))).toBe(4)
    expect(progress(namesPoint, at([named, x100, both100, split], [FORTY_TWO, BACK]))).toBe(5)
  })

  it('replies when x is pointed back at the object y shares', () => {
    const e = at([named, aliased, aliased], [FORTY_TWO, BACK], line('x = 10', null))
    expect(progress(namesPoint, e)).toBe(4)
    expect(guidance(namesPoint, e).text).toMatch(/still share one object/)
  })

  it('stays finished when the player goes on moving x', () => {
    const x1 = snap([value('int', '10'), value('int', '1')], [
      { name: 'x', scope: 'global', target: 'v:int:1' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
    ])
    const moreX = snap([value('int', '1')], [
      { name: 'x', scope: 'global', target: 'v:int:1' },
      { name: 'y', scope: 'global', target: 'v:int:1' },
    ])
    expect(progress(namesPoint, at([named, aliased, moved, x1, moreX], [FORTY_TWO, BACK]))).toBe(5)
  })

  it('finishes when x has moved and y has not, and says so on the memory', () => {
    const done = at([named, aliased, moved], [FORTY_TWO, BACK])
    expect(progress(namesPoint, done)).toBe(namesPoint.steps.length)
    const s = script(namesPoint, done)
    expect(s.finished).toBe(true)
    expect(s.items[0]).toMatchObject({ kind: 'outro', focus: 'memory' })
    expect(namesPoint.takeaway).toMatch(/arrow/)
  })

  it('replies when y moves instead of x', () => {
    const yMoved = snap(
      [value('int', '10'), value('int', '99')],
      [
        { name: 'x', scope: 'global', target: 'v:int:10' },
        { name: 'y', scope: 'global', target: 'v:int:99' },
      ],
    )
    expect(guidance(namesPoint, at([named, aliased, yMoved], [FORTY_TWO, BACK], line('y = 99', null))).text).toMatch(/moved `y`/)
  })

  it('does not slide backwards when the last step un-answers the first', () => {
    // `x = 99` makes "x points at 10" false again.
    expect(progress(namesPoint, at([moved], [FORTY_TWO, BACK]))).toBe(1)
    expect(progress(namesPoint, at([named, aliased, moved], [FORTY_TWO, BACK]))).toBe(5)
  })

  it('keeps the cast as it is: nobody enters or sleeps', () => {
    expect(castAt(namesPoint, NOTHING, 0)).toEqual({ hidden: [], asleep: [], acting: [] })
  })
})
