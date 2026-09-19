/**
 * The REPL session's program assembly.
 *
 * The parentheses around each entry are load-bearing and easy to "tidy"
 * away, so the reason is pinned by a test rather than only by a comment.
 */
import { describe, expect, it } from 'vitest'
import { BANK, buildProgram, describeObject } from '../../src/game/repl'
import type { HeapNode, TraceValue } from '../../src/runtime/types'

describe('buildProgram', () => {
  it('starts every session with an empty bank', () => {
    expect(buildProgram([])).toContain(`${BANK} = []`)
  })

  it('wraps each entry in its own parentheses', () => {
    // Unparenthesised, `x = 5` is a legal keyword argument to append and
    // fails later as a baffling TypeError. Parenthesised, it is the
    // SyntaxError it actually is.
    expect(buildProgram(['x = 5'])).toContain(`${BANK}.append((x = 5))`)
    expect(buildProgram(['10'])).toContain(`${BANK}.append((10))`)
  })

  it('keeps entries in the order they were typed', () => {
    const program = buildProgram(['10', '"John"'])
    expect(program.indexOf('(10)')).toBeLessThan(program.indexOf('("John")'))
  })
})

describe('describeObject', () => {
  const heap: HeapNode[] = [
    { uid: 'h1', kind: 'list', type_name: 'list', items: [{ kind: 'int', decimal: '1' }] },
  ]

  it('names the Python type of a scalar and gives it no identity', () => {
    const o = describeObject({ kind: 'int', decimal: '10' } as TraceValue, [], 0)
    expect(o.typeName).toBe('int')
    expect(o.text).toBe('10')
    // Small ints are interned; claiming an identity would teach a lie.
    expect(o.uid).toBeNull()
  })

  it('spells a float the way Python does', () => {
    const o = describeObject({ kind: 'float', decimal: '5' } as TraceValue, [], 0)
    expect(o.typeName).toBe('float')
    expect(o.text).toBe('5.0')
  })

  it('gives a container its identity and a preview', () => {
    const o = describeObject({ kind: 'ref', uid: 'h1' } as TraceValue, heap, 3)
    expect(o.typeName).toBe('list')
    expect(o.uid).toBe('h1')
    expect(o.items).toEqual(['1'])
    expect(o.slot).toBe(3)
  })
})
