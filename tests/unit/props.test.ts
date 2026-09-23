/**
 * The pure half of the lesson pictures: reading an answer the way a
 * picture draws it. The pictures themselves are checked in the browser.
 */
import { describe, expect, it } from 'vitest'
import { boolOf, kindOf, numberOf, sameProp, textOf } from '../../src/scene/props'

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
