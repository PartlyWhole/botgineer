/**
 * Choose the type (`choose`): twelve questions, no hints, and the reason
 * in every praise.
 */
import { describe, expect, it } from 'vitest'
import { choose, guidance, progress, script, staging, type Line } from '../../../content/lessons'
import { NOTHING, failed, line, th, typed } from './fixtures'

/** Lines that answer the level right, in order. */
const CHOOSE_RIGHT: Line[] = [
  line('False', th('bool', 'False')),
  line('6', th('int', '6')),
  line('0.25', th('float', '0.25')),
  line('"Mira"', th('str', "'Mira'")),
  line('-1', th('int', '-1')),
  line('"M"', th('str', "'M'")),
  line('1.6', th('float', '1.6')),
  line('True', th('bool', 'True')),
  line('"0412 555 019"', th('str', "'0412 555 019'")),
  line('1.5', th('float', '1.5')),
  line('True', th('bool', 'True')),
  line('"Yes, it\'s locked"', th('str', '"Yes, it\'s locked"')),
]

const upTo = (n: number) => CHOOSE_RIGHT.slice(0, n)
const reply = (n: number, miss: Line) => {
  const s = script(choose, typed(...upTo(n), miss))
  const item = s.items[s.rest]!
  expect(item.kind).toBe('reply')
  return item
}

describe('choose', () => {
  it('opens on the shelf, then asks with no hint about the type', () => {
    const s = script(choose, NOTHING)
    expect(s.items[0]!.show).toMatchObject({ kind: 'shelf' })
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Is a fish a bird?', tag: 'you' })
    for (const step of choose.steps) {
      expect(step.say, 'no type named in the question').not.toMatch(/`(bool|int|float|str)`|True|False/)
      expect(step.show, 'one picture per question').toBeDefined()
    }
  })

  it('walks the twelve in order', () => {
    for (let i = 0; i <= CHOOSE_RIGHT.length; i++) expect(progress(choose, typed(...upTo(i)))).toBe(i)
    expect(choose.steps).toHaveLength(12)
  })

  it('refuses the right answer in the wrong type', () => {
    expect(progress(choose, typed(...upTo(1), line('6.0', th('float', '6.0'))))).toBe(1)
    expect(progress(choose, typed(...upTo(8), line('412555019', th('int', '412555019'))))).toBe(8)
    expect(progress(choose, typed(...upTo(10), line('"yes"', th('str', "'yes'"))))).toBe(10)
    expect(progress(choose, typed(...upTo(11), line('True', th('bool', 'True'))))).toBe(11)
  })

  it('gives the reason in every praise (R9)', () => {
    const reasons = [/Yes or no/, /Counted/, /Measured/, /Words for people/, /counted, below zero/, /One letter/, /measured/, /yes-or-no/, /Nobody adds up/, /Between one hour and two/, /A yes for the robot, so a `bool`/, /Mira reads words/]
    for (let i = 1; i <= 12; i++) {
      const s = script(choose, typed(...upTo(i)))
      expect(s.items[0]!.kind).toBe('praise')
      expect(s.items[0]!.text).toMatch(reasons[i - 1]!)
      expect(s.items[0]!.text).toMatch(/\bso\b/)
    }
  })

  it('lets Mira ask her own question, and bring the others', () => {
    expect(guidance(choose, typed(...upTo(5))).speaker).toBe('courier')
    const sign = script(choose, typed(...upTo(3)))
    expect(sign.items[1]).toMatchObject({ kind: 'beat', speaker: 'courier' })
    expect(sign.items[sign.rest]!.speaker).toBeUndefined()
    const phone = script(choose, typed(...upTo(8)))
    expect(phone.items[1]).toMatchObject({ speaker: 'courier', text: expect.stringMatching(/0412 555 019/) })
  })

  describe('replies to the likely misses, and draws them', () => {
    it('a note on the fish', () => {
      expect(reply(0, line('"no"', th('str', "'no'"))).text).toMatch(/note on the fish/)
      expect(staging(choose, typed(line('"no"', th('str', "'no'")))).current).toMatchObject({ prop: { kind: 'fish' }, verdict: 'miss' })
    })

    it('six eggs, measured', () => expect(reply(1, line('6.0', th('float', '6.0'))).text).toMatch(/The dot means \*measured\*/))

    it('an empty glass that is not empty', () => expect(reply(2, line('0', th('int', '0'))).text).toMatch(/There's water in it/))

    it('Mira without quotes', () => expect(reply(3, failed('Mira', 'NameError')).text).toMatch(/Words go inside quotes/))

    it('the lift going up', () => expect(reply(4, line('1', th('int', '1'))).text).toMatch(/\*up\*/))

    it('the whole name, in Mira\'s words', () => {
      expect(reply(5, line('"Mira"', th('str', "'Mira'")))).toMatchObject({ speaker: 'courier', text: expect.stringMatching(/whole name/) })
    })

    it('centimetres', () => expect(reply(6, line('140', th('int', '140'))).text).toMatch(/centimetres/))

    it('breakfast in words', () => expect(reply(7, line('"yes"', th('str', "'yes'"))).text).toMatch(/Tell the \*robot\*/))

    it('a phone number as a number', () => {
      expect(reply(8, failed('0412 555 019', 'SyntaxError')).text).toMatch(/`0` in front/)
      expect(reply(8, line('412555019', th('int', '412555019'))).text).toMatch(/fell off/)
    })

    it('a dot for a clock', () => expect(reply(9, line('1.3', th('float', '1.3'))).text).toMatch(/a dot is not a clock/))

    it('a comma for the dot', () => expect(reply(9, failed('1,5', 'TypeError')).text).toMatch(/dot, not a comma/))

    it('Mira\'s word for the robot, and the robot\'s for Mira', () => {
      expect(reply(10, line('"yes"', th('str', "'yes'"))).text).toMatch(/That's Mira's word/)
      expect(staging(choose, typed(...upTo(10), line('"yes"', th('str', "'yes'")))).current).toMatchObject({
        prop: { kind: 'lamp' },
        verdict: 'miss',
      })
      expect(reply(11, line('True', th('bool', 'True'))).text).toMatch(/robot for yes/)
    })

    it('a floor with a dot is measured, not stuck', () => {
      const text = reply(4, line('-1.0', th('float', '-1.0'))).text
      expect(text).toMatch(/`-1.0` has a dot, so it's measured/)
      expect(reply(4, line('0.5', th('float', '0.5'))).text).toMatch(/Stuck between floors/)
    })

    it('a no for Mira, when her door is locked', () => {
      for (const no of ['not locked', 'It is not locked', 'unlocked', 'no', "It isn't"]) {
        const miss = line(JSON.stringify(no), th('str', `'${no.replace(/'/g, "\\'")}'`))
        expect(progress(choose, typed(...upTo(11), miss))).toBe(11)
        expect(reply(11, miss).text).toMatch(/It \*is\* locked/)
      }
    })
  })

  it('reads a yes for Mira in the words people use', () => {
    for (const yes of ['Yes', 'Yeah it is', 'Yep', 'It is', "It's locked", 'locked']) {
      const right = line(JSON.stringify(yes), th('str', `'${yes.replace(/'/g, "\\'")}'`))
      expect(progress(choose, typed(...upTo(11), right))).toBe(12)
    }
  })

  it('names the type in the lamp\'s praise too (R9)', () => {
    const s = script(choose, typed(...upTo(11)))
    expect(s.items[0]).toMatchObject({ kind: 'praise' })
    expect(s.items[0]!.text).toMatch(/`bool`/)
  })

  it('collects only the right answers on the shelf at the close', () => {
    const lines = [line('True', th('bool', 'True')), ...upTo(3), line('6', th('int', '6')), ...CHOOSE_RIGHT.slice(3)]
    const e = typed(...lines)
    const s = script(choose, e)
    expect(s.finished).toBe(true)
    const heard = staging(choose, e, 1).current!.heard.map((t) => t.repr)
    expect(heard).toEqual(CHOOSE_RIGHT.map((l) => l.thought!.repr))
    // The closing shelf has no stock examples: it holds what was said.
    const shelf = staging(choose, e, 1).current!.prop
    expect(shelf).toMatchObject({ kind: 'shelf', cheer: true, examples: { bool: [], int: [], float: [], char: [], str: [] } })
    expect(guidance(choose, e).text).toMatch(/works things out for itself/)
    expect(choose.takeaway).toMatch(/the question you are answering decides/)
  })
})
