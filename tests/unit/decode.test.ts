/**
 * Decoder behaviour that the memory panel and the grader both depend on.
 *
 * These are the rules that are easy to break silently: Python prints `5.0`
 * where JavaScript prints `5`, `5 == 5.0` is true, tuples are not lists, set
 * order means nothing, and a value the decoder cannot model must never
 * compare equal to anything.
 */
import { describe, expect, it } from 'vitest'
import {
  decodeValue,
  decodedEquals,
  formatDecoded,
  isUndecidable,
  type Decoded,
} from '../../src/runtime/decode'
import type { HeapNode, TraceValue } from '../../src/runtime/types'

const int = (n: number): TraceValue => ({ kind: 'int', decimal: String(n) })
const flt = (n: number): TraceValue => ({ kind: 'float', decimal: String(n) })
const str = (s: string): TraceValue => ({ kind: 'str', value: s })
const ref = (uid: string): TraceValue => ({ kind: 'ref', uid })

describe('float fidelity', () => {
  it('prints a whole float the way Python does', () => {
    expect(formatDecoded(decodeValue(flt(5), []))).toBe('5.0')
    expect(formatDecoded(decodeValue(flt(3.2), []))).toBe('3.2')
    expect(formatDecoded(decodeValue(int(5), []))).toBe('5')
  })

  it('prints the specials the way Python does', () => {
    expect(formatDecoded(decodeValue({ kind: 'float', special: 'Infinity' }, []))).toBe('inf')
    expect(formatDecoded(decodeValue({ kind: 'float', special: '-Infinity' }, []))).toBe('-inf')
    expect(formatDecoded(decodeValue({ kind: 'float', special: 'NaN' }, []))).toBe('nan')
  })

  it('equates ints and floats, as Python does', () => {
    expect(decodedEquals(decodeValue(flt(5), []), 5)).toBe(true)
    expect(decodedEquals(decodeValue(int(5), []), decodeValue(flt(5), []))).toBe(true)
  })

  it('never equates NaN with itself', () => {
    const nan = decodeValue({ kind: 'float', special: 'NaN' }, [])
    expect(decodedEquals(nan, nan)).toBe(false)
  })
})

describe('containers', () => {
  const heap: HeapNode[] = [
    { uid: 'l1', kind: 'list', type_name: 'list', items: [str('B1'), str('D3')] },
    { uid: 't1', kind: 'tuple', type_name: 'tuple', items: [str('A7'), flt(3.2)] },
    { uid: 's1', kind: 'set', type_name: 'set', items: [int(1), int(2)] },
    { uid: 's2', kind: 'set', type_name: 'set', items: [int(2), int(1)] },
    {
      uid: 'd1',
      kind: 'dict',
      type_name: 'dict',
      entries: [{ key: str('a'), value: int(1) }],
    },
  ]

  it('decodes and prints a list', () => {
    expect(formatDecoded(decodeValue(ref('l1'), heap))).toBe("['B1', 'D3']")
  })

  it('prints a tuple with its float intact', () => {
    expect(formatDecoded(decodeValue(ref('t1'), heap))).toBe("('A7', 3.2)")
  })

  it('never equates a tuple with a list of the same items', () => {
    const tuple = decodeValue(ref('t1'), heap)
    expect(decodedEquals(tuple, ['A7', 3.2])).toBe(false)
  })

  it('compares sets without regard to order', () => {
    expect(decodedEquals(decodeValue(ref('s1'), heap), decodeValue(ref('s2'), heap))).toBe(true)
  })

  it('decodes a dict', () => {
    expect(formatDecoded(decodeValue(ref('d1'), heap))).toBe("{'a': 1}")
  })
})

describe('values that must not be graded', () => {
  it('reports a budget-elided container rather than a short answer', () => {
    const heap: HeapNode[] = [
      { uid: 'l', kind: 'list', type_name: 'list', items: [str('B1')], elided_count: 4 },
    ]
    const d = decodeValue(ref('l'), heap)
    expect(isUndecidable(d)).toBe(true)
    expect(decodedEquals(d, ['B1'])).toBe(false)
  })

  it('reports an object it cannot model', () => {
    const heap: HeapNode[] = [{ uid: 'o', kind: 'opaque', type_name: 'Socket' }]
    const d = decodeValue(ref('o'), heap)
    expect(isUndecidable(d)).toBe(true)
    expect(formatDecoded(d)).toBe('<Socket>')
  })

  it('survives a reference cycle', () => {
    const heap: HeapNode[] = [{ uid: 'c', kind: 'list', type_name: 'list', items: [ref('c')] }]
    const d = decodeValue(ref('c'), heap) as Decoded[]
    expect(Array.isArray(d)).toBe(true)
    expect(isUndecidable(d)).toBe(true)
    expect(formatDecoded(d)).toBe('[<circular reference>]')
  })

  it('reports an unresolvable reference instead of throwing', () => {
    expect(isUndecidable(decodeValue(ref('missing'), []))).toBe(true)
  })

  it('keeps a huge int exact rather than losing it to a double', () => {
    const big = '123456789012345678901234567890'
    expect(decodeValue({ kind: 'int', decimal: big }, [])).toBe(big)
  })
})
