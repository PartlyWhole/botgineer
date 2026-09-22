/**
 * The only module that knows both the engine's wire format and the app's
 * memory model. Everything downstream reads `MemorySnapshot` and never
 * touches a `StepRecord`.
 *
 * Nothing here is computed *about* the program — it is a translation of
 * what the interpreter reported, and no more.
 */
import { decodeValue, formatDecoded } from '../runtime/decode'
import { KEEPER } from '../repl/program'
import type { Binding as WireBinding, HeapNode, StepRecord, TraceValue } from '../runtime/types'
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
const HIDDEN = new Set(['__builtins__', '__name__', '__doc__', '__package__', KEEPER])

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

  // Values from bare expressions. The console keeps them in a list because
  // CPython would otherwise collect them the instant they were evaluated;
  // that list is our plumbing, so it is hidden and contributes no pointer.
  // What survives is the contents, held by nothing and named by nothing,
  // which is precisely how a nameless object should look.
  for (const g of step.globals) {
    if (g.module !== '__main__') continue
    for (const binding of g.bindings) {
      if (binding.name === KEEPER) internKept(binding.value, b)
    }
  }

  return { bindings, objects: b.objects, line: step.location.line }
}

/**
 * The `repr` of every value the console kept, oldest first.
 *
 * The console needs the last one to echo, and this is the module that
 * reads the wire format — no panel may go looking for it itself.
 *
 * `None` is skipped, here and in `internKept`. A line like `print("hi")`
 * is an expression whose value is `None`, and a REPL that answered every
 * such line with `None` would be noise; CPython's own prompt suppresses
 * it for the same reason. The consequence is that a deliberate bare
 * `None` makes no object either, which is a fair price — `None` is a
 * singleton, and "the object you just made" is not a useful thing to say
 * about it.
 */
export function keptValues(step: StepRecord | undefined): string[] {
  if (!step) return []
  for (const g of step.globals) {
    if (g.module !== '__main__') continue
    for (const binding of g.bindings) {
      if (binding.name !== KEEPER) continue
      if (binding.value.kind !== 'ref') return []
      const uid = (binding.value as { uid: string }).uid
      const node = step.heap.find((n) => n.uid === uid)
      if (!node || node.kind !== 'list') return []
      return (node.items ?? [])
        .filter((v) => v.kind !== 'none')
        .map((v) => formatDecoded(decodeValue(v, step.heap)))
    }
  }
  return []
}

/** Interns each item of the keeper list without interning the list, so
 *  the values appear as objects and the list leaves no trace. */
function internKept(value: TraceValue, b: Builder): void {
  if (value.kind !== 'ref') return
  const node = b.heap.find((n) => n.uid === (value as { uid: string }).uid)
  if (!node || node.kind !== 'list') return
  for (const item of node.items ?? []) {
    if (item.kind === 'none') continue
    intern(item, b)
  }
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
      elements: COLLECTION_KINDS.has(node.kind) ? [] : null,
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

  if (node.kind === 'dict') {
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
  if (elements === null) {
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

function unknownObject(id: string, why: string): PyObject {
  return { id, type: 'unknown', kind: 'reference', repr: `<${why}>`, elements: null, partial: true }
}
