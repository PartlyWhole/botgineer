/**
 * The only module that knows both the engine's wire format and the app's
 * memory model. Everything downstream reads `MemorySnapshot` and never
 * touches a `StepRecord`.
 *
 * Nothing here is computed *about* the program — it is a translation of
 * what the interpreter reported, and no more.
 */
import { decodeValue, formatDecoded } from '../runtime/decode'
import { DESCRIBE, THOUGHT, THOUGHT_SEP } from '../repl/program'

/** Where a hidden checker leaves its verdict, and the function it runs in
 *  (see `collection/checker`). Our plumbing, like `THOUGHT`. */
export const VERDICT = '__bg_verdict__'
export const CHECKER = '__bg_check__'
import type {
  Binding as WireBinding,
  HeapNode,
  StepRecord,
  TerminalReason,
  TerminalRecord,
  TraceValue,
} from '../runtime/types'
import type { Binding, Element, MemorySnapshot, PyObject } from './model'

/** Wire `kind` → Python type name, for values with no heap node. */
const VALUE_TYPE: Record<string, string> = {
  none: 'NoneType',
  bool: 'bool',
  int: 'int',
  float: 'float',
  str: 'str',
  bytes: 'bytes',
  complex: 'complex',
  range: 'range',
  slice: 'slice',
  ellipsis: 'ellipsis',
  not_implemented: 'NotImplementedType',
}

const COLLECTION_KINDS = new Set(['list', 'tuple', 'set', 'frozenset', 'dict'])

/** Names the app itself put in the program. They are real bindings, but
 *  they are our plumbing rather than the player's work. */
const HIDDEN = new Set(['__builtins__', '__name__', '__doc__', '__package__', THOUGHT, DESCRIBE, VERDICT, CHECKER])

type Builder = {
  objects: Record<string, PyObject>
  heap: HeapNode[]
  /** uids being expanded right now, so a self-referential list terminates. */
  open: Set<string>
}

/**
 * Turns one trace step into the two collections.
 *
 * Bindings come from the module globals plus the locals of every live
 * frame, so a paused call shows its own names rather than only the
 * module's.
 */
export function extractMemory(step: StepRecord | undefined): MemorySnapshot {
  if (!step) return { bindings: [], objects: {}, line: null }

  const b: Builder = { objects: {}, heap: step.heap, open: new Set() }
  const bindings: Binding[] = []

  const add = (wire: WireBinding, scope: string) => {
    if (HIDDEN.has(wire.name)) return
    bindings.push({ name: wire.name, scope, target: intern(wire.value, b) })
  }

  for (const g of step.globals) {
    if (g.module !== '__main__') continue
    for (const binding of g.bindings) add(binding, 'global')
  }
  for (const frame of step.stack) {
    if (frame.function === '<module>') continue
    for (const local of frame.locals) add(local, frame.function)
  }

  return { bindings, objects: b.objects, line: step.location.line }
}

/** What the robot thought: the type and repr of a bare expression's
 *  value, or null when the line reported nothing. */
export type Thought = { type: string; repr: string }

/**
 * Reads the description the console asked for.
 *
 * The value itself is long gone — only this string survives, under a
 * hidden name. Read from the wire rather than decoded, because the
 * separator is a literal tab and a decoded repr would escape it.
 */
export function thought(step: StepRecord | undefined): Thought | null {
  if (!step) return null
  for (const g of step.globals) {
    if (g.module !== '__main__') continue
    for (const binding of g.bindings) {
      if (binding.name !== THOUGHT) continue
      if (binding.value.kind !== 'str') return null
      const text = (binding.value as { value: string }).value
      const cut = text.indexOf(THOUGHT_SEP)
      if (cut < 0) return null
      return { type: text.slice(0, cut), repr: text.slice(cut + THOUGHT_SEP.length) }
    }
  }
  return null
}

/** Get-or-create the object for a value, recursing into collections. */
function intern(value: TraceValue, b: Builder): string {
  if (value.kind === 'ref') {
    const uid = (value as { uid: string }).uid
    const id = `o:${uid}`
    if (b.objects[id]) return id
    if (b.open.has(uid)) return id // a cycle; the entry is already on its way

    const node = b.heap.find((n) => n.uid === uid)
    if (!node) {
      b.objects[id] = unknownObject(id, 'unresolved reference')
      return id
    }

    b.open.add(uid)
    // Reserve the slot before recursing so a self-referential collection
    // finds it instead of looping.
    b.objects[id] = {
      id,
      type: node.type_name || node.kind,
      kind: 'reference',
      repr: '',
      elements: COLLECTION_KINDS.has(node.kind) || hasDefaults(node) ? [] : null,
      partial: node.kind === 'opaque' || node.kind === 'elided',
    }
    const built = buildReference(id, node, b)
    b.objects[id] = built
    b.open.delete(uid)
    return id
  }

  // A value: keyed by what it is, not by where it appeared. Two `10`s are
  // one entry, and it carries no identity badge (see model.ts).
  const type = VALUE_TYPE[value.kind] ?? value.kind
  const repr = formatDecoded(decodeValue(value, b.heap))
  const id = `v:${type}:${repr}`
  b.objects[id] ??= {
    id,
    type,
    kind: 'value',
    repr,
    elements: null,
    partial: value.kind === 'elided',
  }
  return id
}

function buildReference(id: string, node: HeapNode, b: Builder): PyObject {
  const type = node.type_name || node.kind
  const elidedCount = typeof node.elided_count === 'number' ? node.elided_count : 0
  const partial = node.kind === 'opaque' || node.kind === 'elided' || elidedCount > 0

  let elements: Element[] | null = null

  if (node.kind === 'function' && hasDefaults(node)) {
    // A function's defaults are built once, when `def` runs, and belong to
    // the function object — which is exactly what the shared `log=[]`
    // lesson needs to be able to point at.
    elements = (node.defaults as TraceValue[]).map((v, i) => ({
      label: `default ${i + 1}`,
      target: intern(v, b),
    }))
  } else if (node.kind === 'dict') {
    elements = (node.entries ?? []).map((e) => ({
      label: formatDecoded(decodeValue(e.key, b.heap)),
      target: intern(e.value, b),
    }))
  } else if (COLLECTION_KINDS.has(node.kind)) {
    const ordered = node.kind === 'list' || node.kind === 'tuple'
    elements = (node.items ?? []).map((v, i) => ({
      label: ordered ? String(i) : null,
      target: intern(v, b),
    }))
  }

  return {
    id,
    type,
    kind: 'reference',
    repr: reprOf(node, elements),
    elements,
    partial,
  }
}

/** A short rendering for the chip. Collections show their shape rather
 *  than their whole contents — the contents are the elements, and the
 *  panel shows those by pointing at them. */
function reprOf(node: HeapNode, elements: Element[] | null): string {
  if (elements === null || node.kind === 'function') {
    if (node.kind === 'function') {
      return `${node.type_name ?? 'function'} ${node.qualname ?? ''}`.trim()
    }
    return `<${node.type_name || node.kind}>`
  }
  const n = elements.length
  const more = typeof node.elided_count === 'number' && node.elided_count > 0
  const one = n === 1 && !more
  const noun = node.kind === 'dict' ? (one ? 'entry' : 'entries') : one ? 'item' : 'items'
  return `${n}${more ? '+' : ''} ${noun}`
}

const hasDefaults = (node: HeapNode): boolean =>
  node.kind === 'function' && Array.isArray(node.defaults) && node.defaults.length > 0

function unknownObject(id: string, why: string): PyObject {
  return { id, type: 'unknown', kind: 'reference', repr: `<${why}>`, elements: null, partial: true }
}

/* ------------------------------ run evidence ------------------------------ */

/**
 * One visit to a line: the instant the interpreter reached it, before it
 * ran. `depth` is how many frames were live, so a visit inside a call is
 * deeper than the line that made the call.
 */
export type Visit = { line: number; fn: string; depth: number; step: number }

/**
 * Every line visit in the player's code, in order.
 *
 * Only `line` events count. A call also reports the `def` line as the
 * frame starts, and a frame reports its last line again as it returns;
 * neither is Python *reaching* a line, and the collection's numbering
 * never counts them. A `for` header is reached once per pass and once
 * more to find nothing left, which is what the trace reports and what the
 * collection counts (see `collection/traceOrder` for the one place they
 * disagree).
 */
export function lineVisits(steps: readonly StepRecord[]): Visit[] {
  const out: Visit[] = []
  steps.forEach((s, step) => {
    if (s.event !== 'line' || s.location.module !== '__main__') return
    out.push({ line: s.location.line, fn: s.location.function, depth: s.stack.length, step })
  })
  return out
}

/** A moment in a run (`collection/model` `Moment`), restated here so this
 *  module depends on nothing above it. */
export type Moment = { before: number; occurrence?: number } | { after: number; occurrence?: number } | 'end'

/**
 * Everything a grader may ask about one run, and nothing it may not.
 *
 * Graders never see a record; they see this. It is built from the records
 * here, which keeps this module the only one that reads the wire format
 * (invariant 3) — and it is built the same way in the browser and in the
 * Node sweep, so the sweep grades exactly what a player is graded on.
 */
export type RunEvidence = {
  /** Everything written to stdout. */
  output: string
  stderr: string
  /** The uncaught exception's type name, or null. A syntax error is one. */
  raised: string | null
  reason: TerminalReason | 'engine_error'
  visits: Visit[]
  /** Memory when the program had finished (or stopped). */
  final: MemorySnapshot
  /** Memory at a moment, or null when the run never got there. */
  at: (m: Moment) => MemorySnapshot | null
  /** Memory the instant visit `i`'s line had finished: the next time its
   *  own frame (or one above it) is reached. A line that makes a call is
   *  finished when the call has come back, not when it starts. */
  afterVisit: (i: number) => MemorySnapshot
  /** What visit `i`'s line printed, calls it made included. */
  printedBy: (i: number) => string
  /** A hidden checker's verdict, when the program carried one. */
  verdict: unknown
}

export function runEvidence(steps: readonly StepRecord[], terminal: TerminalRecord | null): RunEvidence {
  const visits = lineVisits(steps)
  const last = steps[steps.length - 1]
  const memo = new Map<number, MemorySnapshot>()
  const memAt = (i: number): MemorySnapshot => {
    const hit = memo.get(i)
    if (hit) return hit
    const snap = extractMemory(steps[i])
    memo.set(i, snap)
    return snap
  }

  /** The step at which visit `i`'s line is over. */
  const endOf = (i: number): number => {
    const v = visits[i]!
    for (let s = v.step + 1; s < steps.length; s++) {
      const st = steps[s]!
      if (st.stack.length < v.depth) return s
      if (st.stack.length === v.depth && st.event !== 'call') return s
    }
    return steps.length - 1
  }

  const nth = (line: number, occurrence = 1): number => {
    let seen = 0
    for (let i = 0; i < visits.length; i++) {
      if (visits[i]!.line !== line) continue
      seen += 1
      if (seen === occurrence) return i
    }
    return -1
  }

  const printed = (from: number, to: number): string => {
    let out = ''
    for (let s = from + 1; s <= to && s < steps.length; s++) out += steps[s]!.output.stdout_delta
    return out
  }

  return {
    output: steps.map((s) => s.output.stdout_delta).join(''),
    stderr: steps.map((s) => s.output.stderr_delta).join(''),
    raised: terminal?.reason === 'uncaught_exception' ? (terminal.exception?.type_name ?? 'Exception') : null,
    reason: terminal?.reason ?? 'engine_error',
    visits,
    final: last ? memAt(steps.length - 1) : { bindings: [], objects: {}, line: null },
    at: (m) => {
      if (m === 'end') return last ? memAt(steps.length - 1) : null
      if ('before' in m) {
        const i = nth(m.before, m.occurrence)
        return i < 0 ? null : memAt(visits[i]!.step)
      }
      const i = nth(m.after, m.occurrence)
      return i < 0 ? null : memAt(endOf(i))
    },
    afterVisit: (i) => memAt(endOf(i)),
    printedBy: (i) => printed(visits[i]!.step, endOf(i)),
    verdict: last ? verdictOf(last) : null,
  }
}

/** The checker's verdict: JSON in a hidden string, read from the wire. */
function verdictOf(step: StepRecord): unknown {
  for (const g of step.globals) {
    if (g.module !== '__main__') continue
    const hit = g.bindings.find((b) => b.name === VERDICT)
    if (!hit || hit.value.kind !== 'str') return null
    try {
      return JSON.parse((hit.value as { value: string }).value)
    } catch {
      return null
    }
  }
  return null
}
