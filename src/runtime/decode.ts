/**
 * Decodes PyTrace's tagged value encoding into comparable JavaScript.
 *
 * Deliberately partial (DESIGN.md §7). The supported subset is what a
 * scenario contract can express; everything else decodes to a sentinel that
 * can never compare equal to an expected value, so an exotic return value is
 * a clean grading failure rather than a crash or a false pass.
 */
import type { HeapNode, TraceValue } from './types'

/** A Python tuple — distinct from a list, because returning the wrong one is
 *  a real mistake worth diagnosing. */
export type DecodedTuple = { __tuple: Decoded[] }
/** A Python dict, as ordered entries: keys are not necessarily strings. */
export type DecodedDict = { __dict: [Decoded, Decoded][] }
/** A Python set. Compared without regard to order (guide §27: only
 *  scalar-only sets have canonical ordering, so order is never meaningful). */
export type DecodedSet = { __set: Decoded[] }
/** A value the decoder does not model, or one the engine could not render. */
export type DecodedOpaque = { __opaque: string }
/** A value dropped by a trace budget. Reported differently from "wrong". */
export type DecodedElided = { __elided: string }
/** A reference cycle. Python allows them; the contract language does not. */
export type DecodedCycle = { __cycle: true }

export type Decoded =
  | null
  | boolean
  | number
  | string
  | Decoded[]
  | DecodedTuple
  | DecodedDict
  | DecodedSet
  | DecodedOpaque
  | DecodedElided
  | DecodedCycle

export const isElided = (d: Decoded): d is DecodedElided =>
  typeof d === 'object' && d !== null && '__elided' in d

export const isOpaque = (d: Decoded): d is DecodedOpaque =>
  typeof d === 'object' && d !== null && '__opaque' in d

/** True when the value could not be faithfully decoded, so grading it would
 *  be dishonest. The UI says "too big to check", not "wrong". */
export function isUndecidable(d: Decoded): boolean {
  if (isElided(d) || isOpaque(d)) return true
  if (typeof d === 'object' && d !== null && '__cycle' in d) return true
  if (Array.isArray(d)) return d.some(isUndecidable)
  if (typeof d === 'object' && d !== null) {
    if ('__tuple' in d) return d.__tuple.some(isUndecidable)
    if ('__set' in d) return d.__set.some(isUndecidable)
    if ('__dict' in d) return d.__dict.some(([k, v]) => isUndecidable(k) || isUndecidable(v))
  }
  return false
}

export function decodeValue(value: TraceValue, heap: HeapNode[]): Decoded {
  const byUid = new Map(heap.map((n) => [n.uid, n]))
  return decode(value, byUid, new Set())
}

function decode(
  value: TraceValue,
  byUid: Map<string, HeapNode>,
  inProgress: Set<string>,
): Decoded {
  switch (value.kind) {
    case 'none':
      return null
    case 'bool':
      return (value as { value: boolean }).value
    case 'int': {
      // Python ints are arbitrary precision; the wire carries a decimal
      // string. Anything beyond a safe integer stays a string rather than
      // silently losing precision to a double.
      const decimal = (value as { decimal: string }).decimal
      const n = Number(decimal)
      return Number.isSafeInteger(n) ? n : decimal
    }
    case 'float': {
      const v = value as { decimal?: string; special?: string }
      if (v.special === 'Infinity') return Infinity
      if (v.special === '-Infinity') return -Infinity
      if (v.special === 'NaN') return NaN
      return v.decimal === undefined ? { __opaque: 'float' } : Number(v.decimal)
    }
    case 'str':
      return (value as { value: string }).value
    case 'elided':
      return { __elided: String((value as { reason?: string }).reason ?? 'unknown') }
    case 'ref': {
      const uid = (value as { uid: string }).uid
      if (inProgress.has(uid)) return { __cycle: true }
      const node = byUid.get(uid)
      if (!node) return { __opaque: 'unresolved-ref' }
      inProgress.add(uid)
      try {
        return decodeNode(node, byUid, inProgress)
      } finally {
        inProgress.delete(uid)
      }
    }
    default:
      return { __opaque: String(value.kind) }
  }
}

function decodeNode(
  node: HeapNode,
  byUid: Map<string, HeapNode>,
  inProgress: Set<string>,
): Decoded {
  // A container that lost members to a budget is not safely gradable, so the
  // elision is surfaced rather than quietly producing a short answer.
  const elided = typeof node.elided_count === 'number' && node.elided_count > 0

  switch (node.kind) {
    case 'list': {
      if (elided) return { __elided: 'container_limit' }
      return (node.items ?? []).map((v) => decode(v, byUid, inProgress))
    }
    case 'tuple': {
      if (elided) return { __elided: 'container_limit' }
      return { __tuple: (node.items ?? []).map((v) => decode(v, byUid, inProgress)) }
    }
    case 'set':
    case 'frozenset': {
      if (elided) return { __elided: 'container_limit' }
      return { __set: (node.items ?? []).map((v) => decode(v, byUid, inProgress)) }
    }
    case 'dict': {
      if (elided) return { __elided: 'container_limit' }
      return {
        __dict: (node.entries ?? []).map(
          (e) =>
            [decode(e.key, byUid, inProgress), decode(e.value, byUid, inProgress)] as [
              Decoded,
              Decoded,
            ],
        ),
      }
    }
    case 'elided':
      return { __elided: String(node.reason ?? 'unknown') }
    default:
      return { __opaque: node.type_name || node.kind }
  }
}

/** Structural equality with Python semantics where they differ from JS:
 *  sets compare without order, tuples never equal lists, dict entry order is
 *  ignored. */
export function decodedEquals(a: Decoded, b: Decoded): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b) ? false : a === b
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    return a.length === b.length && a.every((x, i) => decodedEquals(x, b[i] as Decoded))
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  if ('__tuple' in a && '__tuple' in b) {
    return (
      a.__tuple.length === b.__tuple.length &&
      a.__tuple.every((x, i) => decodedEquals(x, b.__tuple[i] as Decoded))
    )
  }
  if ('__set' in a && '__set' in b) return unorderedEquals(a.__set, b.__set)
  if ('__dict' in a && '__dict' in b) {
    if (a.__dict.length !== b.__dict.length) return false
    return a.__dict.every(([ak, av]) =>
      b.__dict.some(([bk, bv]) => decodedEquals(ak, bk) && decodedEquals(av, bv)),
    )
  }
  return false
}

function unorderedEquals(a: Decoded[], b: Decoded[]): boolean {
  if (a.length !== b.length) return false
  const taken = new Array<boolean>(b.length).fill(false)
  return a.every((x) => {
    const i = b.findIndex((y, j) => !taken[j] && decodedEquals(x, y))
    if (i === -1) return false
    taken[i] = true
    return true
  })
}

/** Renders a decoded value the way Python would print it. Used for the
 *  robot's speech and for feedback, so what the player reads matches what
 *  they would see in a terminal. */
export function formatDecoded(d: Decoded): string {
  if (d === null) return 'None'
  if (typeof d === 'boolean') return d ? 'True' : 'False'
  if (typeof d === 'number') return Object.is(d, -0) ? '-0.0' : String(d)
  if (typeof d === 'string') return JSON.stringify(d).replace(/^"|"$/g, "'")
  if (Array.isArray(d)) return `[${d.map(formatDecoded).join(', ')}]`
  if ('__tuple' in d) {
    const items = d.__tuple.map(formatDecoded)
    return items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`
  }
  if ('__set' in d) return d.__set.length ? `{${d.__set.map(formatDecoded).join(', ')}}` : 'set()'
  if ('__dict' in d) {
    return `{${d.__dict.map(([k, v]) => `${formatDecoded(k)}: ${formatDecoded(v)}`).join(', ')}}`
  }
  if ('__cycle' in d) return '<circular reference>'
  if ('__elided' in d) return '<too large to show>'
  return `<${d.__opaque}>`
}
