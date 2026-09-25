/**
 * The pure half of the lesson pictures: reading an answer the way a
 * picture draws it. The pictures themselves are checked in the browser.
 */
import { describe, expect, it } from 'vitest'
import { SLOT_EXAMPLES, boolOf, chipText, codeLine, kindOf, numberOf, sameProp, shelved, slotOf, textOf } from '../../src/scene/props'

const th = (type: string, repr: string) => ({ type, repr })

describe('reading an answer', () => {
  it('reads numbers from ints and floats, and never from a bool', () => {
    expect(numberOf(th('int', '-1'))).toBe(-1)
    expect(numberOf(th('float', '0.5'))).toBe(0.5)
    // True + True is 2 to Python, but True in a basket is not an apple.
    expect(numberOf(th('bool', 'True'))).toBeNull()
    expect(numberOf(th('str', "'3'"))).toBeNull()
    expect(numberOf(null)).toBeNull()
  })

  it('reads a bool only from a bool, not from the word', () => {
    expect(boolOf(th('bool', 'True'))).toBe(true)
    expect(boolOf(th('bool', 'False'))).toBe(false)
    expect(boolOf(th('str', "'True'"))).toBeNull()
  })

  it("undoes Python's quoting of a str", () => {
    expect(textOf(th('str', "'hello'"))).toBe('hello')
    expect(textOf(th('str', '"it\'s"'))).toBe("it's")
    expect(textOf(th('str', "'it\\'s \"so\"'"))).toBe('it\'s "so"')
    expect(textOf(th('str', "'a\\nb'"))).toBe('a\nb')
    expect(textOf(th('str', "'caf\\xe9'"))).toBe('café')
    expect(textOf(th('str', "''"))).toBe('')
    expect(textOf(th('int', '7'))).toBeNull()
  })

  it('knows the four kinds, and nothing else', () => {
    expect(kindOf(th('float', '1.5'))).toBe('float')
    expect(kindOf(th('tuple', '(0, 5)'))).toBeNull()
  })

  it('treats two props as the same picture only when they are', () => {
    expect(sameProp({ kind: 'lamp' }, { kind: 'lamp' })).toBe(true)
    expect(sameProp({ kind: 'basket', apples: 3 }, { kind: 'basket', apples: 4 })).toBe(false)
  })
})

describe('narration is not a different picture', () => {
  // A beat that switches the lamp on, or names one more slot, keeps the
  // picture on stage, so the change plays on it rather than replaying
  // its arrival.
  it('ignores the fields a narration beat sets', () => {
    expect(sameProp({ kind: 'lamp', demo: 'on' }, { kind: 'lamp', demo: 'off' })).toBe(true)
    expect(sameProp({ kind: 'lamp', demo: 'on' }, { kind: 'lamp' })).toBe(true)
    expect(sameProp({ kind: 'basket', apples: 3, demo: 'count' }, { kind: 'basket', apples: 3, demo: 'half' })).toBe(true)
    expect(sameProp({ kind: 'lift', lowest: -2, highest: 3, demo: -1 }, { kind: 'lift', lowest: -2, highest: 3 })).toBe(true)
    expect(sameProp({ kind: 'shelf', filled: [] }, { kind: 'shelf', filled: ['bool', 'int'], title: true, pulse: true })).toBe(true)
    expect(sameProp({ kind: 'numberline', from: 0, to: 1 }, { kind: 'numberline', from: 0, to: 1, mark: 0.5, unnamed: true })).toBe(true)
    expect(sameProp({ kind: 'char', char: 'A' }, { kind: 'char', char: 'A', clasps: true })).toBe(true)
    expect(sameProp({ kind: 'beads', text: 'hello' }, { kind: 'beads', text: 'hello', glow: true })).toBe(true)
    expect(sameProp({ kind: 'balance', left: 4, right: 4, op: '==', lamp: true }, { kind: 'balance', left: 4, right: 4, op: '==' })).toBe(true)
  })

  it('still tells different pictures apart', () => {
    expect(sameProp({ kind: 'lamp', demo: 'on' }, { kind: 'fish' })).toBe(false)
    expect(sameProp({ kind: 'basket', apples: 3, demo: 'count' }, { kind: 'basket', apples: 4, demo: 'count' })).toBe(false)
    expect(sameProp({ kind: 'numberline', from: 0, to: 1, mark: 0.5 }, { kind: 'numberline', from: 0, to: 2, mark: 0.5 })).toBe(false)
    expect(sameProp({ kind: 'char', char: 'A' }, { kind: 'char', char: 'B' })).toBe(false)
    // One glass filling and two glasses compared are different drawings.
    expect(sameProp({ kind: 'glass', level: 0.5, demo: 'fill' }, { kind: 'glass', level: 0.5 })).toBe(false)
    expect(sameProp({ kind: 'tiles', parts: ['"ha"', '*', '3'], demo: 'stamp' }, { kind: 'tiles', parts: ['"ha"', '*', '3'] })).toBe(false)
  })
})

describe('the shelf', () => {
  it('puts a thought in the slot of its own type, and a one-character str in char', () => {
    expect(slotOf(th('bool', 'True'))).toBe('bool')
    expect(slotOf(th('int', '-1'))).toBe('int')
    expect(slotOf(th('float', '0.25'))).toBe('float')
    expect(slotOf(th('str', "'M'"))).toBe('char')
    expect(slotOf(th('str', "'7'"))).toBe('char')
    expect(slotOf(th('str', "'Mira'"))).toBe('str')
    // Counted as Python counts: one code point is one character.
    expect(slotOf(th('str', "'é'"))).toBe('char')
    expect(slotOf(th('str', "'\\n'"))).toBe('char')
    // No characters is not one character.
    expect(slotOf(th('str', "''"))).toBe('str')
    expect(slotOf(th('tuple', '(1, 5)'))).toBeNull()
    expect(slotOf(null)).toBeNull()
  })

  it('writes a str the way the lessons do, and everything else as its repr', () => {
    expect(chipText(th('str', "'M'"))).toBe('"M"')
    expect(chipText(th('bool', 'False'))).toBe('False')
    expect(chipText(th('float', '0.5'))).toBe('0.5')
  })

  it('shows examples only in named slots', () => {
    const s = shelved(['bool', 'int'], [])
    expect(s.bool.examples.map((e) => e.text)).toEqual(SLOT_EXAMPLES.bool)
    expect(s.int.examples.map((e) => e.text)).toEqual(['3', '12', '-1'])
    expect(s.float.examples).toEqual([])
    expect(s.char.examples).toEqual([])
  })

  it('marks an example the player said instead of drawing it twice', () => {
    const s = shelved(['bool', 'int'], [th('bool', 'True'), th('int', '3'), th('int', '6')])
    expect(s.bool.examples).toEqual([
      { text: 'True', said: true },
      { text: 'False', said: false },
    ])
    expect(s.int.examples.find((e) => e.text === '3')?.said).toBe(true)
    expect(s.int.heard).toEqual(['6'])
  })

  it('sorts heard answers into their slots, newest last, as many as fit', () => {
    const heard = [th('int', '6'), th('str', "'Mira'"), th('int', '7'), th('int', '8'), th('str', "'M'"), th('int', '6')]
    const s = shelved(['bool', 'int', 'float', 'char', 'str'], heard)
    // Room for two by default; `6` said again is the newest.
    expect(s.int.heard).toEqual(['8', '6'])
    expect(s.char.heard).toEqual(['"M"'])
    // "Mira" is an example of str already.
    expect(s.str.heard).toEqual([])
    expect(s.str.examples.find((e) => e.text === '"Mira"')?.said).toBe(true)
    expect(shelved(['int'], heard, {}, { int: 3 }).int.heard).toEqual(['7', '8', '6'])
    expect(shelved(['int'], heard, {}, { int: 0 }).int.heard).toEqual([])
  })

  it('files a value before its slot is named, because it has its type already', () => {
    const s = shelved([], [th('float', '0.5')])
    expect(s.float.examples).toEqual([])
    expect(s.float.heard).toEqual(['0.5'])
  })

  it('takes a lesson’s own examples over the defaults', () => {
    const s = shelved(['int'], [], { int: ['3', '12'] })
    expect(s.int.examples.map((e) => e.text)).toEqual(['3', '12'])
  })
})

describe('the codes line', () => {
  it('spaces close codes by value, each character once', () => {
    const line = codeLine('ABCA')
    expect(line.map((c) => [c.char, c.code])).toEqual([
      ['A', 65],
      ['B', 66],
      ['C', 67],
    ])
    expect(line.map((c) => c.at)).toEqual([0.25, 0.5, 0.75])
    expect(line.every((c) => !c.even)).toBe(true)
    // A gap in the codes is a gap on the line: B's place stays empty.
    expect(codeLine('AC').map((c) => c.at)).toEqual([0.25, 0.75])
  })

  it('spaces far-apart codes evenly, in code order', () => {
    const line = codeLine('zA')
    expect(line.map((c) => c.char)).toEqual(['z', 'A'])
    expect(line.find((c) => c.char === 'A')!.at).toBeLessThan(line.find((c) => c.char === 'z')!.at)
    expect(line.every((c) => c.even)).toBe(true)
  })

  it('draws nothing for no characters', () => {
    expect(codeLine('')).toEqual([])
  })
})
