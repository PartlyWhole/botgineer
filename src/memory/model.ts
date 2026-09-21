/**
 * The canonical memory model — the thing every panel reads.
 *
 * Two collections, and that is the whole structure:
 *
 *   **names**    bind to objects
 *   **objects**  have an id, a type, and a value; collections hold
 *                *pointers* to other objects rather than copies
 *
 * This is deliberately smaller than PyTrace's wire format. The wire format
 * is what the interpreter reports; this is what the app teaches. Exactly
 * one module (`extract.ts`) knows how to turn one into the other, so a
 * change to the engine touches one file and every panel keeps working.
 *
 * ## The one judgement call: identity for primitives
 *
 * The engine gives heap objects a uid and gives scalars none — deliberately,
 * because CPython interns small ints and short strings, and inventing a
 * per-occurrence identity for them would teach a lie about `is`.
 *
 * But a model with no entry for `10` cannot show "these two names point at
 * the same value", which is the first thing a memory diagram is for. So
 * every value gets an entry here, in two clearly different flavours:
 *
 * - `value` objects (int, float, str, bool, None) are keyed by type and
 *   value. Two `10`s are one entry, because for an immutable that is what
 *   Python's semantics let you observe. They carry **no identity badge**,
 *   and the UI must never invite an `is` comparison on them.
 * - `reference` objects (list, dict, set, instance, …) are keyed by the
 *   engine's uid. They carry an identity badge, because for these, sharing
 *   is real and observable.
 */

export type ObjectId = string

export type ObjectKind = 'value' | 'reference'

/** One element inside a collection: a pointer to another object.
 *  `label` is the dict key or the index; null for an unlabelled member. */
export type Element = {
  label: string | null
  target: ObjectId
}

export type PyObject = {
  id: ObjectId
  /** Python's own name for the type: `int`, `list`, `dict`, … */
  type: string
  kind: ObjectKind
  /** How Python would print it. */
  repr: string
  /** Pointers to other objects. `null` for anything that is not a
   *  collection — which is different from an empty collection. */
  elements: Element[] | null
  /** The engine could not fully render this (a budget, or an object it
   *  refuses to inspect). Shown as such, never quietly as a complete one. */
  partial: boolean
}

export type Binding = {
  name: string
  /** `global`, or the function whose frame this local belongs to. */
  scope: string
  target: ObjectId
}

export type MemorySnapshot = {
  bindings: Binding[]
  objects: Record<ObjectId, PyObject>
  /** Source line this snapshot was taken at, when known. */
  line: number | null
}

export const EMPTY: MemorySnapshot = { bindings: [], objects: {}, line: null }

export const isCollection = (o: PyObject): boolean => o.elements !== null

/** Objects nothing points at. Reachability is computed rather than assumed
 *  so the UI can say "held by nothing" honestly. */
export function unreferenced(snapshot: MemorySnapshot): ObjectId[] {
  const pointedAt = new Set<ObjectId>()
  for (const b of snapshot.bindings) pointedAt.add(b.target)
  for (const o of Object.values(snapshot.objects)) {
    for (const e of o.elements ?? []) pointedAt.add(e.target)
  }
  return Object.keys(snapshot.objects).filter((id) => !pointedAt.has(id))
}

/** Every binding that points at this object. */
export function namesFor(snapshot: MemorySnapshot, id: ObjectId): Binding[] {
  return snapshot.bindings.filter((b) => b.target === id)
}

/** Every object that holds a pointer to this one. */
export function holdersOf(snapshot: MemorySnapshot, id: ObjectId): PyObject[] {
  return Object.values(snapshot.objects).filter((o) =>
    (o.elements ?? []).some((e) => e.target === id),
  )
}

/** Stable display label for a reference object's identity. Within-session
 *  only: the engine's uids mean nothing across runs, so this is a nickname,
 *  not an address. Value objects get none, by design. */
export function identityBadges(snapshot: MemorySnapshot): Record<ObjectId, string> {
  const badges: Record<ObjectId, string> = {}
  let n = 0
  for (const id of Object.keys(snapshot.objects).sort()) {
    const o = snapshot.objects[id]
    if (o?.kind === 'reference') badges[id] = `#${++n}`
  }
  return badges
}
