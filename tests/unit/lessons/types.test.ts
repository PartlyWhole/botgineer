/**
 * Five data types (`types`): each shown, then named onto the shelf, then
 * used once. Evidence in, step out.
 */
import { describe, expect, it } from 'vitest'
import { castAt, guidance, progress, script, staging, types, type Line } from '../../../content/lessons'
import { NOTHING, failed, line, th, typed } from './fixtures'

/** Lines that answer the level right, in order. */
const TYPES_RIGHT: Line[] = [
  line('True', th('bool', 'True')),
  line('-1', th('int', '-1')),
  line('0.5', th('float', '0.5')),
  line('"M"', th('str', "'M'")),
  line('"hello"', th('str', "'hello'")),
]

const reply = (...lines: Line[]) => {
  const s = script(types, typed(...lines))
  const item = s.items[s.rest]!
  expect(item.kind).toBe('reply')
  return item.text
}

describe('types', () => {
  it('opens on the robot\'s problem, with an empty shelf', () => {
    const s = script(types, NOTHING)
    expect(s.items[0]!.text).toMatch(/doesn't think of everything the same way/)
    expect(staging(types, NOTHING, 0).current?.prop).toMatchObject({ kind: 'shelf', filled: [] })
  })

  it('shows each type before it names it, and names it before it asks (R1)', () => {
    const s = script(types, NOTHING)
    const lamp = s.items.findIndex((i) => i.show?.kind === 'lamp')
    const named = s.items.findIndex((i) => /called `bool`/.test(i.text))
    expect(lamp).toBeGreaterThan(-1)
    expect(named).toBeGreaterThan(lamp)
    expect(s.rest).toBeGreaterThan(named)
    expect(staging(types, NOTHING, named).current?.prop).toMatchObject({ kind: 'shelf', filled: ['bool'] })
  })

  it('walks the five in order, one answer each', () => {
    for (let i = 0; i <= TYPES_RIGHT.length; i++) expect(progress(types, typed(...TYPES_RIGHT.slice(0, i)))).toBe(i)
    expect(script(types, typed(...TYPES_RIGHT)).finished).toBe(true)
  })

  it('counts an answer only for the question that asked it', () => {
    // `-1` typed at the lamp is a miss there, not the lift answered early.
    expect(progress(types, typed(line('-1', th('int', '-1')), line('True', th('bool', 'True'))))).toBe(1)
  })

  it('praises each with its reason (R9)', () => {
    const praise = (n: number) => script(types, typed(...TYPES_RIGHT.slice(0, n))).items[0]!
    expect(praise(1)).toMatchObject({ kind: 'praise', text: expect.stringMatching(/because `True`/) })
    expect(praise(2).text).toMatch(/so an `int`/)
    expect(praise(3).text).toMatch(/measured, so a `float`/)
    expect(praise(4).text).toMatch(/Python keeps as a `str`/)
    expect(praise(5).text).toMatch(/because it's words in quotes/)
  })

  it('names a char honestly: Python keeps it as a one-letter str (R8)', () => {
    const at = typed(...TYPES_RIGHT.slice(0, 3))
    const s = script(types, at)
    const line = s.items.find((i) => /no char type/.test(i.text))
    expect(line).toBeDefined()
    expect(line!.thought).toBe("'A'")
  })

  it('brings Mira on at the char, and keeps her there', () => {
    expect(castAt(types, NOTHING).hidden).toEqual(['courier'])
    const at = typed(...TYPES_RIGHT.slice(0, 3))
    const s = script(types, at)
    const enters = s.items.findIndex((i) => i.act?.some((a) => a.actor === 'courier' && a.do === 'enter'))
    expect(castAt(types, at, enters - 1).hidden).toEqual(['courier'])
    expect(castAt(types, at, enters).hidden).toEqual([])
    expect(s.items[enters + 1]!.speaker).toBe('courier')
    expect(castAt(types, typed(...TYPES_RIGHT)).hidden).toEqual([])
  })

  describe('replies to the likely misses', () => {
    it('at the lamp', () => {
      expect(reply(line('true', null, 'NameError: name \'true\' is not defined'))).toMatch(/capital letter/)
      expect(reply(line('False', th('bool', 'False')))).toMatch(/stays dark/)
      expect(reply(line('"True"', th('str', "'True'")))).toMatch(/Quotes make that a word/)
    })

    it('at the lift', () => {
      const at = TYPES_RIGHT.slice(0, 1)
      expect(reply(...at, line('1.5', th('float', '1.5')))).toMatch(/Stuck between floors/)
      expect(reply(...at, line('1', th('int', '1')))).toMatch(/one floor \*up\*/)
      // A whole-valued float parks the lift on its floor, so the reply is
      // about the dot, never a stuck lift the stage does not show.
      expect(reply(...at, line('-1.0', th('float', '-1.0')))).toMatch(/`-1.0` has a dot, so it's measured/)
      expect(reply(...at, line('-1.0', th('float', '-1.0')))).not.toMatch(/Stuck/)
    })

    it('at the glass', () => {
      const at = TYPES_RIGHT.slice(0, 2)
      expect(reply(...at, line('0', th('int', '0')))).toMatch(/There's water in it/)
      expect(reply(...at, line('0,5', th('tuple', '(0, 5)')))).toMatch(/dot, not a comma/)
      expect(reply(...at, failed('0,5', 'TypeError'))).toMatch(/dot, not a comma/)
      expect(reply(...at, line('"half"', th('str', "'half'")))).toMatch(/`0.5`/)
    })

    it('at the letter', () => {
      const at = TYPES_RIGHT.slice(0, 3)
      expect(reply(...at, failed('M', 'NameError'))).toMatch(/Quotes make it a character/)
      expect(reply(...at, line('"m"', th('str', "'m'")))).toMatch(/capital/)
      expect(reply(...at, line('"Mira"', th('str', "'Mira'")))).toMatch(/more than one letter/)
    })

    it('at hello', () => {
      const at = TYPES_RIGHT.slice(0, 4)
      expect(reply(...at, failed('hello', 'NameError'))).toMatch(/Words go inside quotes/)
      expect(reply(...at, line('""', th('str', "''")))).toMatch(/empty/)
    })
  })

  it('draws a miss into the picture that asked', () => {
    const s = staging(types, typed(TYPES_RIGHT[0]!, line('1.5', th('float', '1.5'))))
    expect(s.current).toMatchObject({ prop: { kind: 'lift' }, verdict: 'miss', answer: { repr: '1.5' } })
  })

  it('files only right answers on the shelf, never a miss', () => {
    const lines = [
      TYPES_RIGHT[0]!,
      line('1.5', th('float', '1.5')),
      TYPES_RIGHT[1]!,
      line('0', th('int', '0')),
      TYPES_RIGHT[2]!,
    ]
    const e = typed(...lines)
    const s = script(types, e)
    const shelf = s.items.findIndex((i) => i.show?.kind === 'shelf')
    const heard = staging(types, e, shelf).current!.heard.map((t) => t.repr)
    expect(heard).toEqual(['True', '-1', '0.5'])
  })

  it('plays narration on the picture already standing, and the ask puts it back', () => {
    const at = (e: ReturnType<typeof typed>, text: RegExp) => {
      const s = script(types, e)
      const i = s.items.findIndex((it) => text.test(it.text))
      expect(i).toBeGreaterThanOrEqual(0)
      return staging(types, e, i).current!
    }
    // The shelf's title settles on the beat that names a data type, on the
    // same element the first beat stood.
    const bare = at(NOTHING, /doesn't think of everything/)
    const titled = at(NOTHING, /\*\*data type\*\*/)
    expect(bare.prop).toMatchObject({ kind: 'shelf', title: false })
    expect(titled.prop).toMatchObject({ kind: 'shelf', title: true })
    expect(titled.key).toBe(bare.key)
    expect(at(NOTHING, /five basic ones/).prop).toMatchObject({ pulse: true })
    // The lamp is flipped on, then off, before the player is asked.
    expect(at(NOTHING, /yes as `True`/).prop).toEqual({ kind: 'lamp', demo: 'on' })
    expect(at(NOTHING, /no as `False`/).prop).toEqual({ kind: 'lamp', demo: 'off' })
    // The ask's lamp has no demonstration, so it is dark until answered.
    expect(staging(types, NOTHING).current!.prop).toEqual({ kind: 'lamp' })

    const lift = typed(TYPES_RIGHT[0]!)
    const demo = at(lift, /below zero/)
    expect(demo.prop).toMatchObject({ kind: 'lift', demo: -1 })
    // The ask does not arrive with the lift already in the car park.
    const ask = staging(types, lift).current!
    expect(ask.prop).toEqual({ kind: 'lift', lowest: -2, highest: 3 })
    expect(ask.key).toBe(demo.key)
    expect(ask.ask).toBe('Send the lift to the car park.')

    const glass = typed(...TYPES_RIGHT.slice(0, 2))
    expect(at(glass, /land between/).prop).toMatchObject({ unnamed: true })
    expect(at(glass, /with a dot: `0.5`/).prop).not.toHaveProperty('unnamed')
    const hello = typed(...TYPES_RIGHT.slice(0, 4))
    expect(at(hello, /starts and where it stops/).prop).toMatchObject({ kind: 'beads', glow: true })
  })

  it('lets the last answer go when a new situation starts', () => {
    for (let n = 1; n < TYPES_RIGHT.length; n++) {
      const s = script(types, typed(...TYPES_RIGHT.slice(0, n)))
      const beats = s.items.filter((i) => i.kind === 'beat')
      expect(beats[0]!.thought).toBe('')
      // Every beat either clears the cloud or shows its own demonstration.
      for (const b of beats) expect(b.thought).toBeDefined()
    }
  })

  it('closes on the full shelf, then what it will be arranged into', () => {
    const done = typed(...TYPES_RIGHT)
    const s = script(types, done)
    const outro = s.items.filter((i) => i.kind === 'outro')
    expect(outro.map((i) => i.show)).toEqual([
      expect.objectContaining({ kind: 'shelf', cheer: true }),
      expect.objectContaining({ kind: 'shelf', later: true }),
    ])
    const last = staging(types, done, s.items.length - 1).current!
    expect(last.prop).toMatchObject({ kind: 'shelf', later: true })
    expect(staging(types, done, 1).current!.prop).toMatchObject({ kind: 'shelf', cheer: true })
    expect(guidance(types, done).text).toMatch(/a list is a row of them/)
    expect(types.takeaway).toMatch(/bool, int, float, char and str/)
  })
})
