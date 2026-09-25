/**
 * Working things out.
 */
import { describe, expect, it } from 'vitest'
import { guidance, operations, progress, staging, type Line } from '../../../content/lessons'
import { NOTHING, line, th, typed } from './fixtures'

/* ------------------------- two: working things out ------------------------- */

const OPS_RIGHT: Line[] = [
  line('7 * 6', th('int', '42')),
  line('9 / 2', th('float', '4.5')),
  line('8 / 2', th('float', '4.0')),
  line('20 - 7', th('int', '13')),
  line('3 > 5', th('bool', 'False')),
  line('2 + 2 == 4', th('bool', 'True')),
  line('"bot" + "gineer"', th('str', "'botgineer'")),
  line('"ha" * 3', th('str', "'hahaha'")),
  line('2 + 3 * 4', th('int', '14')),
  line('(2 + 3) * 4', th('int', '20')),
]

describe('working things out', () => {
  it('walks every operation, in order', () => {
    expect(progress(operations, NOTHING)).toBe(0)
    for (let i = 1; i <= OPS_RIGHT.length; i++) {
      expect(progress(operations, typed(...OPS_RIGHT.slice(0, i)))).toBe(i)
    }
  })

  it('finishes on the brackets, and says the answer went nowhere', () => {
    const e = typed(...OPS_RIGHT)
    expect(guidance(operations, e).text).toMatch(/nobody else ever knew it/)
    expect(Object.keys(e.snapshot.objects)).toEqual([])
  })

  it('wants the robot to do the working, not the player', () => {
    // Typing the answer is not asking the robot.
    expect(progress(operations, typed(line('42', th('int', '42'))))).toBe(0)
    expect(guidance(operations, typed(line('42', th('int', '42')))).text).toMatch(/let the robot/)
  })

  it('wants a float from sharing, even when it shares exactly', () => {
    const at = OPS_RIGHT.slice(0, 2)
    expect(progress(operations, typed(...at, line('8 // 2', th('int', '4'))))).toBe(2)
    expect(progress(operations, typed(...at, line('8 / 2', th('float', '4.0'))))).toBe(3)
  })

  it('leaves the choice of operator to the player once', () => {
    // No operator is named for the bolts: any line that takes 7 from 20.
    const at = OPS_RIGHT.slice(0, 3)
    expect(progress(operations, typed(...at, line('20-7', th('int', '13'))))).toBe(4)
    expect(progress(operations, typed(...at, line('13', th('int', '13'))))).toBe(3)
  })

  describe('replies to a miss', () => {
    const reply = (...lines: Line[]) => guidance(operations, typed(...lines)).text

    it('on times', () => {
      expect(reply(line('7 + 6', th('int', '13')))).toMatch(/`7 \+ 6`/)
      expect(reply(line('7 x 6', null, 'SyntaxError — the robot stopped there.'))).toMatch(/star/)
    })

    it('on sharing whole litres only', () => {
      expect(reply(...OPS_RIGHT.slice(0, 1), line('9 // 2', th('int', '4')))).toMatch(/one is left in the jug/)
    })

    it('on taking away', () => {
      const at = OPS_RIGHT.slice(0, 3)
      expect(reply(...at, line('20 + 7', th('int', '27')))).toMatch(/takes them away/)
    })

    it('on asking the question the wrong way round', () => {
      const at = OPS_RIGHT.slice(0, 4)
      expect(reply(...at, line('5 > 3', th('bool', 'True')))).toMatch(/other way round/)
    })

    it('on one equals sign where two ask', () => {
      const at = OPS_RIGHT.slice(0, 5)
      expect(reply(...at, line('2 + 2 = 4', null, 'SyntaxError — the robot stopped there.'))).toMatch(/give it a name/)
    })

    it('on working left to right', () => {
      const at = OPS_RIGHT.slice(0, 8)
      expect(reply(...at, line('20', th('int', '20')))).toMatch(/left to right/)
    })
  })

  it('shows the leftover litre when shared in whole litres', () => {
    const s = staging(operations, typed(...OPS_RIGHT.slice(0, 1), line('9 // 2', th('int', '4'))))
    expect(s.current?.prop).toEqual({ kind: 'share', litres: 9, robots: 2 })
    expect(s.current?.answer).toEqual(th('int', '4'))
    expect(s.current?.verdict).toBe('miss')
  })
})
