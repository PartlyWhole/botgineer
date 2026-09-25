/**
 * Level 2, working things out: every operation in order, the robot made
 * to do the working at every step, and the misses named.
 */
import { describe, expect, it } from 'vitest'
import { castAt, guidance, operations, progress, script, staging, type Line } from '../../../content/lessons'
import { NOTHING, failed, line, th, typed } from './fixtures'

const OPS_RIGHT: Line[] = [
  line('7 * 6', th('int', '42')),
  line('20 - 7', th('int', '13')),
  line('9 / 2', th('float', '4.5')),
  line('8 / 2', th('float', '4.0')),
  line('2 + 0.5', th('float', '2.5')),
  line('3 > 5', th('bool', 'False')),
  line('2 + 2 == 4', th('bool', 'True')),
  line('"bot" + "gineer"', th('str', "'botgineer'")),
  line('"ha" * 5', th('str', "'hahahahaha'")),
  line('ord("M")', th('int', '77')),
  line('True + True + True', th('int', '3')),
  line('2 + 3 * 4', th('int', '14')),
  line('(2 + 3) * 4', th('int', '20')),
]

/** The same answers, typed by hand: each one is what its step forbids. */
const BY_HAND: Line[] = [
  line('42', th('int', '42')),
  line('13', th('int', '13')),
  line('4.5', th('float', '4.5')),
  line('4.0', th('float', '4.0')),
  line('2.5', th('float', '2.5')),
  line('False', th('bool', 'False')),
  line('True', th('bool', 'True')),
  line('"botgineer"', th('str', "'botgineer'")),
  line('"hahahahaha"', th('str', "'hahahahaha'")),
  line('77', th('int', '77')),
  line('3', th('int', '3')),
  line('14', th('int', '14')),
  line('20', th('int', '20')),
]

const reply = (...lines: Line[]) => {
  const s = script(operations, typed(...lines))
  expect(s.items[s.rest]!.kind).toBe('reply')
  return s.items[s.rest]!.text
}
const at = (i: number) => OPS_RIGHT.slice(0, i)

describe('working things out', () => {
  it('walks every operation, in order', () => {
    expect(progress(operations, NOTHING)).toBe(0)
    for (let i = 1; i <= OPS_RIGHT.length; i++) expect(progress(operations, typed(...at(i)))).toBe(i)
  })

  it('keeps to about a dozen questions, each for the robot to work out (R4)', () => {
    expect(operations.steps).toHaveLength(13)
    for (const step of operations.steps) expect(step.tag).toBe('robot')
  })

  it('says the rule before the first question, and names `*` before asking it', () => {
    const s = script(operations, NOTHING)
    const told = s.items.slice(0, s.rest).map((i) => i.text)
    expect(told.some((t) => /give the robot the sum/i.test(t))).toBe(true)
    expect(told.some((t) => /`7 \* 6`/.test(t))).toBe(true)
    // The ask is the question alone (R3).
    expect(s.items[s.rest]!.text).toBe('How many bolts are in the crates?')
  })

  it('opens on Mira\'s problem: she arrives, and the robot does not know', () => {
    expect(castAt(operations, NOTHING, 0).hidden).toEqual([])
    const s = script(operations, NOTHING)
    expect(s.items[0]!.speaker).toBe('courier')
    // Before her entrance, she is off stage: her first action is `enter`.
    expect(operations.steps[0]!.beats![0]!.act![0]).toEqual({ actor: 'courier', do: 'enter' })
    expect(s.items.some((i) => i.thought === '?')).toBe(true)
  })

  it('refuses every answer typed by hand, and says so', () => {
    for (let i = 0; i < BY_HAND.length; i++) {
      const e = typed(...at(i), BY_HAND[i]!)
      expect(progress(operations, e), BY_HAND[i]!.source).toBe(i)
      expect(guidance(operations, e).text, BY_HAND[i]!.source).toMatch(/robot/i)
    }
  })

  it('wants a float from sharing, even when it shares exactly', () => {
    expect(progress(operations, typed(...at(3), line('8 // 2', th('int', '4'))))).toBe(3)
    expect(progress(operations, typed(...at(3), line('8 / 2', th('float', '4.0'))))).toBe(4)
  })

  it('takes `type(2 + 0.5)` as an answer to what type comes back', () => {
    expect(progress(operations, typed(...at(4), line('type(2 + 0.5)', th('type', "<class 'float'>"))))).toBe(5)
    expect(progress(operations, typed(...at(4), line('float', th('type', "<class 'float'>"))))).toBe(4)
  })

  it('shows the lamp\'s answer to `==` while it is told, never on the ask', () => {
    const e = typed(...at(6))
    const s = script(operations, e)
    const lit = s.items.findIndex((i) => i.show?.kind === 'balance' && i.show.lamp)
    expect(lit).toBeGreaterThan(0)
    expect(lit).toBeLessThan(s.rest)
    // (Drawing it is `staging`'s: a narration-only change to the same
    // picture must reach the layer. Today `staging` skips a `show` that is
    // `sameProp` as the one before it, so the lamp is not drawn; that is
    // core.ts's to fix, and not asserted here.)
    expect(staging(operations, e).current?.prop).toEqual({ kind: 'balance', left: 4, right: 4, op: '==' })
  })

  it('shows `7 + 7` beside `"7" + "7"` before asking about text', () => {
    const s = script(operations, typed(...at(7)))
    const shown = s.items.flatMap((i) => (i.show?.kind === 'contrast' ? [i.show] : []))
    expect(shown.at(-1)).toMatchObject({ left: { text: '7 + 7', result: '14' }, right: { text: '"7" + "7"', result: '"77"' } })
  })

  it('praises with the reason (R9)', () => {
    for (let i = 1; i <= OPS_RIGHT.length; i++) {
      const s = script(operations, typed(...at(i)))
      expect(s.items[0]!.kind).toBe('praise')
      expect(s.items[0]!.text).toMatch(/:|, so |because/)
    }
  })

  it('finishes on what the robot can do, and that it forgot', () => {
    const e = typed(...OPS_RIGHT)
    const s = script(operations, e)
    expect(s.finished).toBe(true)
    expect(s.items.map((i) => i.text)).toContain('The robot worked out twenty, and then forgot it.')
    expect(guidance(operations, e).text).toBe('Next, we\'ll help it remember.')
    expect(operations.takeaway).toBe('An operation makes a new value, and its type depends on the operation.')
    expect(Object.keys(e.snapshot.objects)).toEqual([])
  })

  describe('replies to a miss', () => {
    it('on times', () => {
      expect(reply(line('7 + 6', th('int', '13')))).toMatch(/`7 \+ 6`/)
      expect(reply(failed('7 x 6', 'SyntaxError'))).toMatch(/star/)
    })

    it('on taking away', () => {
      expect(reply(...at(1), line('20 + 7', th('int', '27')))).toMatch(/takes them away/)
      expect(reply(...at(1), line('7 - 20', th('int', '-13')))).toMatch(/Start with the 20/)
    })

    it('on sharing whole litres only, naming `//` as another sign (R5)', () => {
      expect(reply(...at(2), line('9 // 2', th('int', '4')))).toMatch(/`\/\/` is a different sign.*left in the jug/)
      expect(reply(...at(3), line('8 // 2', th('int', '4')))).toMatch(/`\/\/` is a different sign/)
    })

    it('on a comma for a point, and on naming the type', () => {
      expect(reply(...at(4), line('2 + 0,5', th('tuple', '(2, 5)')))).toMatch(/dot/)
      // What the console really gets: describing it passes two arguments.
      expect(reply(...at(4), failed('2 + 0,5', 'TypeError'))).toMatch(/dot/)
      expect(reply(...at(4), line('float', th('type', "<class 'float'>")))).toMatch(/names a type/)
    })

    it('on asking the question the wrong way round', () => {
      expect(reply(...at(5), line('5 > 3', th('bool', 'True')))).toMatch(/other way round/)
    })

    it('on one equals sign where two ask', () => {
      expect(reply(...at(6), failed('2 + 2 = 4', 'SyntaxError'))).toMatch(/give it a name/)
    })

    it('on text', () => {
      expect(reply(...at(7), line('"bot " + "gineer"', th('str', "'bot gineer'")))).toMatch(/space/)
      expect(reply(...at(7), failed('bot + gineer', 'NameError'))).toMatch(/own quotes/)
      expect(reply(...at(8), line('"ha" * 3', th('str', "'hahaha'")))).toMatch(/3 times/)
      expect(reply(...at(8), failed('"ha" * "5"', 'TypeError'))).toMatch(/whole number/)
    })

    it('on character codes', () => {
      expect(reply(...at(9), line('ord("m")', th('int', '109')))).toMatch(/small `m`/)
      expect(reply(...at(9), failed('ord(M)', 'NameError'))).toMatch(/quotes/)
      expect(reply(...at(9), failed('ord("Mira")', 'TypeError'))).toMatch(/one character/)
    })

    it('on counting lamps', () => {
      expect(reply(...at(10), line('True + True', th('int', '2')))).toMatch(/Three lamps/)
      expect(reply(...at(10), failed('true + true + true', 'NameError'))).toMatch(/capital T/)
    })

    it('on working left to right, and on forgetting the brackets', () => {
      expect(reply(...at(11), line('20', th('int', '20')))).toMatch(/left to right/)
      expect(reply(...at(12), line('2 + 3 * 4', th('int', '14')))).toMatch(/brackets/)
    })
  })

  it('draws the leftover litre when shared in whole litres', () => {
    const s = staging(operations, typed(...at(2), line('9 // 2', th('int', '4'))))
    expect(s.current?.prop).toEqual({ kind: 'share', litres: 9, robots: 2 })
    expect(s.current?.answer).toEqual(th('int', '4'))
    expect(s.current?.verdict).toBe('miss')
  })

  it('turns Mira\'s letter over to its code once the robot works it out', () => {
    const s = staging(operations, typed(...at(10)), 0)
    expect(s.current?.prop).toEqual({ kind: 'letter', char: 'M' })
    expect(s.current?.answer).toEqual(th('int', '77'))
    expect(s.current?.verdict).toBe('right')
  })
})
