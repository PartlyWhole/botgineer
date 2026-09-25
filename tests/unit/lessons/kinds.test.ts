/**
 * Yes, how many, how much — the warm-up's first lesson as it was before
 * docs/PEDAGOGY.md. Unregistered now (`meet`, `types` and `choose` replace
 * it), and kept until workstream C1 deletes it with its tests.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, staging, threeKinds, type Line } from '../../../content/lessons'
import { NOTHING, line, th, typed } from './fixtures'

/** The lines that answer the first lesson, right first time. */
const KINDS_RIGHT: Line[] = [
  line('True', th('bool', 'True')),
  line('False', th('bool', 'False')),
  line('3', th('int', '3')),
  line('-1', th('int', '-1')),
  line('0.5', th('float', '0.5')),
  line('1.4', th('float', '1.4')),
  line('12', th('int', '12')),
  line('True', th('bool', 'True')),
  line('1.5', th('float', '1.5')),
  line('True + True', th('int', '2')),
  line('2 + 0.5', th('float', '2.5')),
]

describe('yes, how many, how much', () => {
  it('starts with a switch, and asks for True', () => {
    expect(progress(threeKinds, NOTHING)).toBe(0)
    expect(guidance(threeKinds, NOTHING).text).toMatch(/switch/)
    expect(guidance(threeKinds, NOTHING).text).toMatch(/`True`/)
  })

  it('walks bool, then int, then float, then shows they nest', () => {
    for (let i = 1; i <= KINDS_RIGHT.length; i++) {
      expect(progress(threeKinds, typed(...KINDS_RIGHT.slice(0, i)))).toBe(i)
    }
    const done = typed(...KINDS_RIGHT)
    expect(guidance(threeKinds, done).text).toMatch(/fits inside the next/)
    expect(guidance(threeKinds, done).text).toMatch(/[Nn]one of it had a name/)
  })

  it('names each kind only after the player has made one', () => {
    const says = threeKinds.steps.map((s) => s.say)
    const first = (word: string) => says.findIndex((s) => s.includes(`\`${word}\`s`))
    // Called a bool in the step after the switch, an int after the
    // apples, a float after the glass.
    expect(first('bool')).toBe(1)
    expect(first('int')).toBe(3)
    expect(first('float')).toBe(5)
  })

  it('does not count an answer given before its question was asked', () => {
    // `3` typed first is not the apple count: the apples had not been
    // asked about. So it moves nothing, and cannot skip a step's line.
    const early = typed(line('3', th('int', '3')), line('True', th('bool', 'True')), line('False', th('bool', 'False')))
    expect(progress(threeKinds, early)).toBe(2)
  })

  it('never lets one line do two steps', () => {
    // The breakfast step takes any bool; the True that turned the lamp on
    // must not also answer it.
    const upToEggs = KINDS_RIGHT.slice(0, 7)
    expect(progress(threeKinds, typed(...upToEggs))).toBe(7)
  })

  it('accepts any height a person could be, and only as a float', () => {
    const before = KINDS_RIGHT.slice(0, 5)
    expect(progress(threeKinds, typed(...before, line('1.72', th('float', '1.72'))))).toBe(6)
    expect(progress(threeKinds, typed(...before, line('1', th('int', '1'))))).toBe(5)
    expect(progress(threeKinds, typed(...before, line('14.0', th('float', '14.0'))))).toBe(5)
  })

  it('wants the robot to do the sums, not the player', () => {
    const before = KINDS_RIGHT.slice(0, 9)
    expect(progress(threeKinds, typed(...before, line('2', th('int', '2'))))).toBe(9)
    expect(progress(threeKinds, typed(...before, line('True + True', th('int', '2'))))).toBe(10)
    const at10 = [...before, line('True + True', th('int', '2'))]
    expect(progress(threeKinds, typed(...at10, line('2.5', th('float', '2.5'))))).toBe(10)
  })

  describe('replies to a miss', () => {
    const reply = (...lines: Line[]) => guidance(threeKinds, typed(...lines)).text

    it('on the switch', () => {
      expect(reply(line('true', null, 'NameError — the robot stopped there.'))).toMatch(/capital letter/)
      expect(reply(line('yes', null, 'NameError — the robot stopped there.'))).toMatch(/doesn't know the word `yes`/)
      expect(reply(line('"True"', th('str', "'True'")))).toMatch(/word, for people/)
      expect(reply(line('False', th('bool', 'False')))).toMatch(/stays dark/)
    })

    it('on counting', () => {
      const at = KINDS_RIGHT.slice(0, 2)
      expect(reply(...at, line('3.0', th('float', '3.0')))).toMatch(/counted — no dot/)
      expect(reply(...at, line('4', th('int', '4')))).toMatch(/Count the apples again/)
      expect(reply(...at, line('"three"', th('str', "'three'")))).toMatch(/digits/)
    })

    it('on the lift', () => {
      const at = KINDS_RIGHT.slice(0, 3)
      expect(reply(...at, line('1', th('int', '1')))).toMatch(/minus sign/)
      expect(reply(...at, line('1.5', th('float', '1.5')))).toMatch(/Stuck between floors/)
      expect(reply(...at, line('0', th('int', '0')))).toMatch(/ground/)
      expect(reply(...at, line('9', th('int', '9')))).toMatch(/no floor 9/)
    })

    it('on measuring', () => {
      const glass = KINDS_RIGHT.slice(0, 4)
      expect(reply(...glass, line('0', th('int', '0')))).toMatch(/Empty/)
      expect(reply(...glass, line('0,5', th('tuple', '(0, 5)')))).toMatch(/full stop, not a comma/)
      const height = KINDS_RIGHT.slice(0, 5)
      expect(reply(...height, line('140', th('int', '140')))).toMatch(/centimetres.*`1.4`/)
      expect(reply(...height, line('1', th('int', '1')))).toMatch(/exactly 1 metre/)
    })

    it('on the match, where a dot is not a clock', () => {
      const at = KINDS_RIGHT.slice(0, 8)
      expect(reply(...at, line('90', th('int', '90')))).toMatch(/minutes/)
      expect(reply(...at, line('1.3', th('float', '1.3')))).toMatch(/not a clock/)
    })

    it('never answers a right answer as if it were a miss on the next step', () => {
      // `True` finished the lamp; the fish step must ask its question,
      // not tell the player that True is the wrong answer to it.
      expect(reply(line('True', th('bool', 'True')))).toBe(threeKinds.steps[1]!.say)
    })

    it('goes back to the question when the reply has nothing to say', () => {
      expect(reply(line('x = 5', null))).toBe(threeKinds.steps[0]!.say)
    })
  })

  describe('the stage', () => {
    it('shows the lamp first, with nothing drawn into it', () => {
      const s = staging(threeKinds, NOTHING)
      expect(s.current?.prop).toEqual({ kind: 'lamp' })
      expect(s.current?.answer).toBeNull()
      expect(s.current?.ask).toBe('Turn the lamp on.')
      expect(s.leaving).toBeNull()
    })

    it('draws a miss into the picture that asked', () => {
      const s = staging(threeKinds, typed(line('False', th('bool', 'False'))))
      expect(s.current?.prop.kind).toBe('lamp')
      expect(s.current?.answer).toEqual(th('bool', 'False'))
      expect(s.current?.verdict).toBe('miss')
    })

    it('sends a right answer off in its own picture, and brings on the next', () => {
      const s = staging(threeKinds, typed(line('True', th('bool', 'True'))))
      expect(s.leaving?.prop.kind).toBe('lamp')
      expect(s.leaving?.answer).toEqual(th('bool', 'True'))
      expect(s.leaving?.verdict).toBe('right')
      expect(s.current?.prop.kind).toBe('fish')
      expect(s.current?.answer).toBeNull()
    })

    it('keeps the same picture when the next step shares it', () => {
      const s = staging(threeKinds, typed(...KINDS_RIGHT.slice(0, 10)))
      expect(s.leaving).toBeNull()
      expect(s.current?.prop.kind).toBe('kinds')
      expect(s.current?.answer).toEqual(th('int', '2'))
    })

    it('ends on the kinds, with everything that was said', () => {
      const s = staging(threeKinds, typed(...KINDS_RIGHT))
      expect(s.current?.prop.kind).toBe('kinds')
      expect(s.current?.heard.map((t) => t.repr)).toEqual(KINDS_RIGHT.map((l) => l.thought!.repr))
    })

    it('draws nothing from a line that failed, but still counts it as a miss', () => {
      const s = staging(threeKinds, typed(line('yes', null, 'NameError — the robot stopped there.')))
      expect(s.current?.answer).toBeNull()
      expect(s.current?.verdict).toBe('miss')
    })
  })
})
