/**
 * The REPL session: expressions in, objects in the robot's memory out.
 *
 * ## Why a bank exists
 *
 * CPython collects an object the instant nothing refers to it. `10` on its
 * own is made and thrown away before anyone could look at it. To *show* an
 * unnamed object persisting, something has to hold it — so the robot does,
 * in a list the tutorial calls its memory. The crow says this out loud
 * rather than letting the player believe objects linger by themselves,
 * because "why did my object disappear" is the next lesson, not a bug.
 *
 * ## Why the whole session re-runs
 *
 * Each entry re-runs every line from the start. There is no incremental
 * interpreter state to keep in sync, the trace always describes the whole
 * session, and a line that fails can be discarded without leaving debris.
 * A tutorial is a few dozen lines; the cost is irrelevant.
 *
 * ## What the engine's encoding gives us for free
 *
 * Scalars (`int`, `str`, `float`, `bool`, `None`) arrive as inline tagged
 * values with no identity; containers arrive as `ref`s into a heap with a
 * uid. So the display can honestly show identity exactly where sharing is
 * real, and stay silent about it where CPython's interning would otherwise
 * teach something false.
 */
import type { HeapNode, StepRecord, TraceValue } from '../runtime/types'
import { decodeValue, formatDecoded } from '../runtime/decode'

export const BANK = '__memory'

/** One object sitting in the robot's memory. */
export type MemoryObject = {
  /** Position in the bank — stable across re-runs, used as a React key. */
  slot: number
  /** Python's own name for the type: `int`, `str`, `list`, … */
  typeName: string
  /** How Python would print it. */
  text: string
  /** Heap identity, for objects that have one. Scalars have none, and the
   *  display must not invent one for them. */
  uid: string | null
  /** Short preview of a container's contents. */
  items: string[] | null
}

/** Assembles the whole session into one program.
 *
 *  Each entry is wrapped in its own parentheses. Without them `x = 5` is a
 *  perfectly legal keyword argument to `append` and fails later as a
 *  confusing TypeError; inside parentheses it is a SyntaxError, which is
 *  what it actually is — a statement where the lesson wants a value. */
export function buildProgram(entries: string[]): string {
  const lines = [
    '# The robot holds on to everything you make, so you can see it.',
    `${BANK} = []`,
    ...entries.map((e) => `${BANK}.append((${e}))`),
  ]
  return lines.join('\n') + '\n'
}

const SCALAR_TYPE: Record<string, string> = {
  none: 'NoneType',
  bool: 'bool',
  int: 'int',
  float: 'float',
  str: 'str',
  bytes: 'bytes',
  complex: 'complex',
  range: 'range',
  slice: 'slice',
}

/** Describes one value the way the memory tiles need it. */
export function describeObject(value: TraceValue, heap: HeapNode[], slot: number): MemoryObject {
  const text = formatDecoded(decodeValue(value, heap))

  if (value.kind === 'ref') {
    const uid = (value as { uid: string }).uid
    const node = heap.find((n) => n.uid === uid)
    const items =
      node?.items?.map((v) => formatDecoded(decodeValue(v, heap))) ??
      node?.entries?.map(
        (e) =>
          `${formatDecoded(decodeValue(e.key, heap))}: ${formatDecoded(decodeValue(e.value, heap))}`,
      ) ??
      null
    return { slot, typeName: node?.type_name ?? 'object', text, uid, items }
  }

  return { slot, typeName: SCALAR_TYPE[value.kind] ?? value.kind, text, uid: null, items: null }
}

/** Reads the bank out of the last snapshot that has it. */
export function readMemory(steps: StepRecord[]): MemoryObject[] {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (!step) continue
    const binding = step.globals
      .find((g) => g.module === '__main__')
      ?.bindings.find((b) => b.name === BANK)
    if (!binding || binding.value.kind !== 'ref') continue

    const uid = (binding.value as { uid: string }).uid
    const node = step.heap.find((n) => n.uid === uid)
    if (!node?.items) continue
    return node.items.map((v, slot) => describeObject(v, step.heap, slot))
  }
  return []
}

/** Two slots hold the very same object. Only ever true for values the
 *  engine gave a heap identity, which is exactly where sharing is real. */
export function sharesIdentity(a: MemoryObject, b: MemoryObject): boolean {
  return a.uid !== null && a.uid === b.uid
}
