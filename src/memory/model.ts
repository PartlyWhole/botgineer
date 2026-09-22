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
 * ## Everything is an object, and every slot is a pointer
 *
 * `['x', 'y']` is not a box containing two letters; it is a list holding
 * two pointers, each leading to a `str` object whose value happens to be a
 * single character. The panel shows it that way — `[obj3, obj4]` — because
 * that is the model Python actually has, and a diagram that inlines
 * literals into their container teaches a different, wrong one.
 *
 * So every object gets a **handle** (`obj1`, `obj2`, …), primitives
 * included, and a collection's elements are pointers to handles.
 *
 * ## The one judgement call: how values are keyed
 *
 * `reference` objects (list, dict, set, instance, …) are keyed by the
 * engine's uid, which is the truth: sharing is real and observable.
 *
 * `value` objects (int, float, str, bool, None) get no uid from the engine,
 * deliberately — it never invites an `is` comparison on an interned value.
 * They are keyed here by **type and value**, so two `10`s are one object
 * with one handle. That is what CPython does for interned values and it is
 * what makes "these two names point at the same thing" visible.
 *
 * The cost, stated plainly: two equal values that CPython did *not* intern
 * are shown as one object when they are really two. The model cannot tell,
 * because the engine does not say. Do not build an `is`-on-scalars lesson
 * on top of this without changing the keying first.
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

/**
 * Objects worth a line of their own: named, or held by nothing.
 *
 * What this leaves out is an object that is *only* reachable through a
 * collection — the `1`, `2` and `3` inside a list nobody has named yet.
 * They are real objects and the graph draws every one of them, but in a
 * one-line strip four chips for `[1, 2, 3]` bury the thing the player
 * actually made.
 *
 * Collapsing is not inlining (invariant 4). The collection's chip still
 * reads `3 items`, never `[1, 2, 3]`: the elements are hidden, not drawn
 * as though they lived inside their container. An element that earns a
 * name of its own reappears, because then it is something the player
 * refers to rather than something they filled a list with.
 */
export function topLevel(snapshot: MemorySnapshot): ObjectId[] {
  const named = new Set(snapshot.bindings.map((b) => b.target))
  const held = new Set<ObjectId>()
  for (const o of Object.values(snapshot.objects)) {
    for (const e of o.elements ?? []) held.add(e.target)
  }
  return orderedObjectIds(snapshot).filter((id) => named.has(id) || !held.has(id))
}

/** Every object that holds a pointer to this one. */
export function holdersOf(snapshot: MemorySnapshot, id: ObjectId): PyObject[] {
  return Object.values(snapshot.objects).filter((o) =>
    (o.elements ?? []).some((e) => e.target === id),
  )
}

/**
 * Object ids in a stable, readable order for handing out handles.
 *
 * References first, by the engine's own uid, so they are numbered in
 * creation order and a later run never renumbers an earlier object.
 * Values after them, by type then value, so the order does not depend on
 * which name happened to mention one first.
 */
export function orderedObjectIds(snapshot: MemorySnapshot): ObjectId[] {
  const rank = (o: PyObject) => (o.kind === 'reference' ? 0 : 1)
  const uid = (id: ObjectId) => Number(id.slice(2)) || 0
  return Object.keys(snapshot.objects).sort((a, b) => {
    const oa = snapshot.objects[a]!
    const ob = snapshot.objects[b]!
    if (rank(oa) !== rank(ob)) return rank(oa) - rank(ob)
    if (oa.kind === 'reference') return uid(a) - uid(b)
    return oa.type.localeCompare(ob.type) || oa.repr.localeCompare(ob.repr)
  })
}
