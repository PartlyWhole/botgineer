/**
 * Talking to humans — as it was before docs/PEDAGOGY.md folded it into
 * Level 1 and 2. Unregistered, and kept until workstream C1 deletes it.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, staging, talkingToHumans, type Line } from '../../../content/lessons'
import { NOTHING, line, th, typed } from './fixtures'

/* ------------------------- talking to humans ------------------------- */

const WORDS_RIGHT: Line[] = [
  line('"hello Mira"', th('str', "'hello Mira'")),
  line('7 + 7', th('int', '14')),
  line('"7" + "7"', th('str', "'77'")),
  line('"0412 555 019"', th('str', "'0412 555 019'")),
  line('"True"', th('str', "'True'")),
  line('True', th('bool', 'True')),
  line('"Yes, the door is locked"', th('str', "'Yes, the door is locked'")),
  line('ord("A")', th('int', '65')),
]

describe('talking to humans', () => {
  it('opens on Mira, and on words in quotes', () => {
    expect(guidance(talkingToHumans, NOTHING).text).toMatch(/Mira/)
    expect(guidance(talkingToHumans, NOTHING).text).toMatch(/quotes/)
  })

  it('walks through to every character being a number', () => {
    for (let i = 1; i <= WORDS_RIGHT.length; i++) {
      expect(progress(talkingToHumans, typed(...WORDS_RIGHT.slice(0, i)))).toBe(i)
    }
    expect(guidance(talkingToHumans, typed(...WORDS_RIGHT)).text).toMatch(/computers like bits, humans like words/)
  })

  it('lets Mira ask her own questions', () => {
    expect(guidance(talkingToHumans, typed(...WORDS_RIGHT.slice(0, 1))).speaker).toBe('courier')
    expect(guidance(talkingToHumans, typed(...WORDS_RIGHT.slice(0, 6))).speaker).toBe('courier')
  })

  it('accepts the phone number with or without its spaces, but only as text', () => {
    const at = WORDS_RIGHT.slice(0, 3)
    expect(progress(talkingToHumans, typed(...at, line('"0412555019"', th('str', "'0412555019'"))))).toBe(4)
    expect(progress(talkingToHumans, typed(...at, line('412555019', th('int', '412555019'))))).toBe(3)
  })

  it('tells the word True from the robot\'s own', () => {
    const at = WORDS_RIGHT.slice(0, 4)
    expect(progress(talkingToHumans, typed(...at, line('True', th('bool', 'True'))))).toBe(4)
    expect(progress(talkingToHumans, typed(...at, line('"True"', th('str', "'True'"))))).toBe(5)
  })

  describe('replies to a miss', () => {
    const reply = (...lines: Line[]) => guidance(talkingToHumans, typed(...lines)).text

    it('on words without quotes', () => {
      expect(reply(line('hello', null, 'NameError — the robot stopped there.'))).toMatch(/Without quotes/)
      expect(reply(line('hello Mira', null, 'SyntaxError — the robot stopped there.'))).toMatch(/one pair of quotes/)
      expect(reply(line('""', th('str', "''")))).toMatch(/empty/)
    })

    it('on a phone number typed as a number', () => {
      const at = WORDS_RIGHT.slice(0, 3)
      expect(reply(...at, line('0412555019', null, 'SyntaxError — the robot stopped there.'))).toMatch(/starts with 0/)
      expect(reply(...at, line('412555019', th('int', '412555019')))).toMatch(/0 at the front vanished/)
    })

    it('on the robot\'s True where Mira wanted words', () => {
      const at = WORDS_RIGHT.slice(0, 6)
      expect(reply(...at, line('True', th('bool', 'True')))).toMatch(/robot for yes/)
    })

    it('on a letter without its quotes', () => {
      const at = WORDS_RIGHT.slice(0, 7)
      expect(reply(...at, line('ord(A)', null, 'NameError — the robot stopped there.'))).toMatch(/needs quotes/)
      expect(reply(...at, line('ord("a")', th('int', '97')))).toMatch(/different character/)
    })
  })

  it('keeps the lamp on stage across the two True steps, showing the note', () => {
    const s = staging(talkingToHumans, typed(...WORDS_RIGHT.slice(0, 5)))
    expect(s.leaving).toBeNull()
    expect(s.current?.prop.kind).toBe('lamp')
    expect(s.current?.answer).toEqual(th('str', "'True'"))
  })

  it('ends with the letter turned over', () => {
    const s = staging(talkingToHumans, typed(...WORDS_RIGHT))
    expect(s.current?.prop).toEqual({ kind: 'letter', char: 'A' })
    expect(s.current?.answer).toEqual(th('int', '65'))
  })
})
