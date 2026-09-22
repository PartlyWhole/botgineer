import { describe, expect, it } from 'vitest'
import {
  KEEPER,
  buildProgram,
  isExpression,
  needsContinuation,
  type Entry,
} from '../../src/repl/program'

const expr = (source: string): Entry => ({ source, echo: true })
const stmt = (source: string): Entry => ({ source, echo: false })

describe('isExpression', () => {
  it('accepts the literals the first lesson is built on', () => {
    expect(isExpression('10')).toBe(true)
    expect(isExpression('"John"')).toBe(true)
    expect(isExpression('3 + 4')).toBe(true)
    expect(isExpression('[1, 2, 3]')).toBe(true)
    expect(isExpression('{"a": 1}')).toBe(true)
  })

  it('rejects assignment, including augmented', () => {
    expect(isExpression('x = 5')).toBe(false)
    expect(isExpression('x += 1')).toBe(false)
    expect(isExpression('x //= 2')).toBe(false)
    expect(isExpression('a = b = 3')).toBe(false)
  })

  it('keeps comparisons as expressions', () => {
    expect(isExpression('3 == 3')).toBe(true)
    expect(isExpression('3 != 4')).toBe(true)
    expect(isExpression('3 <= 4')).toBe(true)
  })

  it('does not mistake a keyword argument for an assignment', () => {
    expect(isExpression('print("hi", end="")')).toBe(true)
    expect(isExpression('dict(a=1)')).toBe(true)
  })

  it('does not mistake an `=` inside a string for an assignment', () => {
    expect(isExpression('"x = 1"')).toBe(true)
    expect(isExpression("'a=b'.split('=')")).toBe(true)
  })

  it('rejects statements and block openers', () => {
    expect(isExpression('import math')).toBe(false)
    expect(isExpression('if x:')).toBe(false)
    expect(isExpression('def f():')).toBe(false)
    expect(isExpression('pass')).toBe(false)
    expect(isExpression('del x')).toBe(false)
  })

  it('treats lambda as the expression it is', () => {
    expect(isExpression('lambda x: x + 1')).toBe(true)
  })

  it('rejects anything spanning lines', () => {
    expect(isExpression('def f():\n    return 1')).toBe(false)
  })

  it('ignores a trailing comment', () => {
    expect(isExpression('10  # the number ten')).toBe(true)
    expect(isExpression('x = 1  # nope')).toBe(false)
  })

  it('is blank-safe', () => {
    expect(isExpression('')).toBe(false)
    expect(isExpression('   ')).toBe(false)
  })
})

describe('needsContinuation', () => {
  it('waits for a closing bracket', () => {
    expect(needsContinuation('[1,')).toBe(true)
    expect(needsContinuation('[1, 2]')).toBe(false)
  })

  it('waits for a closing triple quote', () => {
    expect(needsContinuation('"""hello')).toBe(true)
    expect(needsContinuation('"""hello"""')).toBe(false)
  })

  it('waits after a block header, and stops only on a blank line', () => {
    expect(needsContinuation('def f():')).toBe(true)
    expect(needsContinuation('def f():\n    return 1')).toBe(true)
    // One newline ends the line, not the block. Getting this wrong closed
    // every block before its body could be typed.
    expect(needsContinuation('def f():\n    return 1\n')).toBe(true)
    expect(needsContinuation('def f():\n    return 1\n\n')).toBe(false)
  })

  it('waits after an explicit backslash', () => {
    expect(needsContinuation('1 + \\')).toBe(true)
  })

  it('does not wait on a bracket inside a string', () => {
    expect(needsContinuation('"[unclosed"')).toBe(false)
  })

  it('is blank-safe', () => {
    expect(needsContinuation('')).toBe(false)
  })
})

describe('buildProgram', () => {
  it('keeps a bare expression reachable instead of dropping it', () => {
    const built = buildProgram([], expr('10'))
    expect(built.source).toBe(`${KEEPER} = []\n${KEEPER}.append(10)\n`)
  })

  it('leaves a statement exactly as the player typed it', () => {
    const built = buildProgram([], stmt('x = 5'))
    expect(built.source).toBe(`${KEEPER} = []\nx = 5\n`)
  })

  it('replays accepted history ahead of the pending line', () => {
    const built = buildProgram([expr('10'), stmt('x = 5')], expr('x + 1'))
    expect(built.source).toBe(
      [`${KEEPER} = []`, `${KEEPER}.append(10)`, 'x = 5', `${KEEPER}.append(x + 1)`, ''].join('\n'),
    )
  })

  it('points pendingLine at the submission, not at the replay', () => {
    const built = buildProgram([expr('10'), stmt('x = 5')], expr('x + 1'))
    const lines = built.source.split('\n')
    expect(lines[built.pendingLine - 1]).toBe(`${KEEPER}.append(x + 1)`)
  })

  it('points pendingLine correctly with no history at all', () => {
    const built = buildProgram([], expr('10'))
    expect(built.source.split('\n')[built.pendingLine - 1]).toBe(`${KEEPER}.append(10)`)
  })

  it('attributes every program line to the entry that produced it', () => {
    const built = buildProgram([stmt('def f():\n    return 1')], expr('f()'))
    // 1: preamble, 2-3: the def, 4: the call.
    expect(built.lineOwner[1]).toBe(null)
    expect(built.lineOwner[2]).toBe(0)
    expect(built.lineOwner[3]).toBe(0)
    expect(built.lineOwner[4]).toBe(1)
  })

  it('builds a runnable program with nothing pending', () => {
    const built = buildProgram([expr('10')], null)
    expect(built.source).toBe(`${KEEPER} = []\n${KEEPER}.append(10)\n`)
    expect(built.pendingLine).toBe(1)
  })
})
