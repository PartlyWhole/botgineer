/**
 * The pure half of the lesson pictures: reading an answer the way a
 * picture draws it. The pictures' look is checked in the browser; what
 * they *say* — which parts are drawn, and the sentence a screen reader
 * hears — is checked here too, rendered to markup, because a picture
 * that disagrees with the crow is a bug a test can read.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CHIP_CHARS,
  CHIP_ROWS,
  SLOT_EXAMPLES,
  boolOf,
  chipLines,
  chipText,
  codeLine,
  kindOf,
  numberOf,
  rightNumber,
  sameProp,
  shelfRoom,
  shelved,
  slotOf,
  textOf,
  unworked,
  type Prop,
  type PropView,
} from '../../src/scene/props'
import { PropLayer, describe as sentence } from '../../src/ui/Props'

const th = (type: string, repr: string) => ({ type, repr })

const view = (prop: Prop, answer: { type: string; repr: string } | null = null, verdict: PropView['verdict'] = null, heard: { type: string; repr: string }[] = []): PropView => ({
  prop,
  answer,
  verdict,
  heard,
})

/** The picture as markup: what it draws, not how it looks. */
const drawn = (v: PropView) => renderToStaticMarkup(createElement(PropLayer, { view: v, role: 'current' }))

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

describe('the right number, not worked out', () => {
  // A refused answer used to be drawn as a right one: a typed 42 filled
  // the crates with "42 bolts", and `7 * 2` put the parcels on the scale
  // at 14 kg, while the crow's reply said no.
  it('knows the number each numeric picture asks for', () => {
    expect(rightNumber({ kind: 'crates', crates: 7, each: 6 })).toBe(42)
    expect(rightNumber({ kind: 'bolts', have: 20, use: 7 })).toBe(13)
    expect(rightNumber({ kind: 'share', litres: 9, robots: 2 })).toBe(4.5)
    expect(rightNumber({ kind: 'scale', parcels: 7, each: 2 })).toBe(14)
    expect(rightNumber({ kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'] })).toBe(14)
    expect(rightNumber({ kind: 'letter', char: 'M' })).toBe(77)
    // The lamps and the codes narrate; they draw no answer to refuse.
    expect(rightNumber({ kind: 'lamps', on: 2 })).toBeNull()
    expect(rightNumber({ kind: 'codes', chars: 'ABC' })).toBeNull()
    expect(rightNumber({ kind: 'lamp' })).toBeNull()
  })

  it('is the right value on a miss, and nothing else', () => {
    const crates: Prop = { kind: 'crates', crates: 7, each: 6 }
    expect(unworked(view(crates, th('int', '42'), 'miss'))).toBe(true)
    expect(unworked(view(crates, th('int', '42'), 'right'))).toBe(false)
    expect(unworked(view(crates, th('int', '42'), null))).toBe(false)
    // A wrong number is drawn as itself: that miss is honest already.
    expect(unworked(view(crates, th('int', '13'), 'miss'))).toBe(false)
    // By value, so a typed 4 for 8 / 2 is the right amount, still refused.
    expect(unworked(view({ kind: 'share', litres: 8, robots: 2 }, th('int', '4'), 'miss'))).toBe(true)
    expect(unworked(view(crates, th('str', "'42'"), 'miss'))).toBe(false)
  })

  const refused: [Prop, string, (html: string) => void][] = [
    [
      { kind: 'crates', crates: 7, each: 6 },
      '42',
      (h) => {
        expect(h).not.toContain('bolt lit')
        expect(h).not.toContain('42 bolts')
        expect(h).toContain('7 * 6 = ?')
      },
    ],
    [
      { kind: 'bolts', have: 20, use: 7 },
      '13',
      (h) => {
        expect(h).not.toContain('ringed')
        expect(h).toContain('20 - 7 = ?')
      },
    ],
    [
      { kind: 'share', litres: 9, robots: 2 },
      '4.5',
      (h) => {
        expect(h).not.toContain('L left')
        expect(h).toContain('unworked-q')
      },
    ],
    [
      { kind: 'scale', parcels: 7, each: 2 },
      '14',
      (h) => {
        expect(h).not.toContain('weighed')
        expect(h).not.toContain('14 kg')
        expect(h).toContain('? kg')
      },
    ],
    [
      { kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'] },
      '14',
      (h) => {
        expect(h).not.toContain('expr shown')
        expect(h).toContain('= ?')
      },
    ],
    [
      { kind: 'letter', char: 'M' },
      '77',
      (h) => {
        expect(h).not.toContain('turned')
        expect(h).toContain('→  ?')
      },
    ],
  ]

  it.each(refused)('draws %j refused as waiting, in amber', (prop, repr, check) => {
    const type = repr.includes('.') ? 'float' : 'int'
    const html = drawn(view(prop, th(type, repr), 'miss'))
    expect(html).toContain('data-worked="no"')
    expect(html).toContain('unworked')
    check(html)
    expect(sentence(view(prop, th(type, repr), 'miss'))).toContain('not been worked out yet')
    // The same number, right, is drawn as the answer.
    const right = drawn(view(prop, th(type, repr), 'right'))
    expect(right).not.toContain('data-worked')
    expect(right).not.toContain('unworked')
  })
})

describe('the balance', () => {
  it('asks about what it weighs, not always 2 + 2', () => {
    const plain = drawn(view({ kind: 'balance', left: 5, right: 5, op: '==' }))
    expect(plain).toContain('5 == 5 ?')
    expect(plain).not.toContain('2 + 2')
    expect(plain).not.toContain('weight other')
  })

  it('writes a side as its label, and splits a sum into its parts', () => {
    const v = view({ kind: 'balance', left: 4, right: 4, op: '==', leftLabel: '2 + 2' })
    const html = drawn(v)
    expect(html).toContain('2 + 2 == 4 ?')
    // Two of the four blocks in the second colour: 2, then 2 more.
    expect(html.match(/weight other/g)).toHaveLength(2)
    expect(sentence(v)).toContain('2 + 2 == 4?')
    expect(drawn(view({ kind: 'balance', left: 6, right: 7, op: '<', rightLabel: 'seven' }))).toContain('6 &lt; seven ?')
  })
})

describe('the shelf, drawn', () => {
  it('breaks a long chip over two rows instead of cutting it short', () => {
    expect(chipLines('"True"')).toEqual(['"True"'])
    expect(chipLines('"0412 555 019"')).toEqual(['"0412', '555 019"'])
    expect(chipLines('"Yeah it is"')).toEqual(['"Yeah it', 'is"'])
    expect(chipLines('"0412555019"')).toEqual(['"0412555', '019"'])
    for (const l of chipLines('"a sentence far too long for two rows"')) expect([...l].length).toBeLessThanOrEqual(CHIP_CHARS)
    expect(chipLines('"a sentence far too long for two rows"')).toHaveLength(2)
  })

  it('counts a two-row chip as two rows of room', () => {
    const heard = [th('str', "'0412 555 019'"), th('str', "'hi'"), th('str', "'Yeah it is'")]
    // Room for three rows: the newest (two rows) and "hi" (one).
    expect(shelved(['str'], heard, {}, { str: 3 }).str.heard).toEqual(['"hi"', '"Yeah it is"'])
    // Room for two: only the newest, whole.
    expect(shelved(['str'], heard, {}, { str: 2 }).str.heard).toEqual(['"Yeah it is"'])
  })

  it('gives each slot the rows its examples and tag leave', () => {
    const room = shelfRoom(['bool', 'int', 'float', 'char', 'str'])
    expect(room).toEqual({ bool: CHIP_ROWS - 2, int: CHIP_ROWS - 3, float: CHIP_ROWS - 2, char: CHIP_ROWS - 1 - 2, str: CHIP_ROWS - 2 })
    expect(shelfRoom([]).float).toBe(CHIP_ROWS)
  })

  it('says what it draws: the sentence lists every chip on the shelf', () => {
    // Five floats heard before float is named: the drawing has room for
    // all five, and the sentence once listed only the last two.
    const heard = ['0.1', '0.2', '0.3', '0.4', '0.6'].map((r) => th('float', r))
    const v = view({ kind: 'shelf', filled: ['bool', 'int'] }, null, null, heard)
    const html = drawn(v)
    const said = sentence(v)
    for (const r of ['0.1', '0.2', '0.3', '0.4', '0.6']) {
      expect(html).toContain(`>${r}<`)
      expect(said).toContain(r)
    }
  })

  it('draws a phone number and a short sentence whole', () => {
    // The choose lesson's close: no stock examples, and its three str
    // answers, two of them long, on the shelf together.
    const heard = [th('str', "'Mira'"), th('str', "'0412 555 019'"), th('str', "'Yeah it is'")]
    const none = { bool: [], int: [], float: [], char: [], str: [] }
    const html = drawn(view({ kind: 'shelf', filled: ['bool', 'int', 'float', 'char', 'str'], examples: none }, null, null, heard))
    for (const part of ['"Mira"', '"0412', '555 019"', '"Yeah it', 'is"']) expect(html).toContain(`>${part.replaceAll('"', '&quot;')}<`)
    expect(html).not.toContain('…')
  })
})

describe('the tiles', () => {
  const scaleOf = (html: string) => Number(/scale\(([\d.]+)\)/.exec(html)?.[1])

  it('grows a short row to fill the picture, as far as 2.2 times', () => {
    // A lone "Mira" at its own size is four 16-unit tiles: unreadable on
    // a phone, for a question about its first letter.
    expect(scaleOf(drawn(view({ kind: 'tiles', parts: ['"Mira"'] })))).toBeCloseTo(2.2)
    const sum = scaleOf(drawn(view({ kind: 'tiles', parts: ['7', '+', '7'] })))
    expect(sum).toBeGreaterThan(1)
    expect(sum).toBeLessThanOrEqual(2.2)
  })

  it('still shrinks a long row to fit', () => {
    expect(scaleOf(drawn(view({ kind: 'tiles', parts: ['"a long word"', '+', '"another one"', '+', '"and more"'] })))).toBeLessThan(1)
  })
})
