/**
 * Wrong pictures of memory, each the one a particular wrong model draws.
 *
 * "Draw the names and objects" is asked as a choice between pictures: the
 * truth, extracted from the run, and pictures made *from* the truth by a
 * named misconception — the learner who thinks `b = a` copies draws two
 * lists where there is one; the learner who thinks `[[]] * 3` makes three
 * lists draws three. A distractor is never invented: it is the true memory
 * with one wrong idea applied to it, so every wrong option teaches the
 * mistake it stands for.
 *
 * `canonical` is how two pictures are compared. It reads memory the way
 * the collection's diagrams do — which names point at which objects, which
 * objects are the *same* object — and ignores the engine's ids, so two
 * pictures are equal exactly when a learner could not tell them apart.
 */
import type { Binding, MemorySnapshot, ObjectId, PyObject } from '../memory/model'
import type { Transform } from './model'

/* ------------------------------ canonical ------------------------------ */

/**
 * A string that is equal for two snapshots exactly when they draw the same
 * picture: the same names, pointing at objects of the same shape, with the
 * same sharing.
 */
export function canonical(s: MemorySnapshot): string {
  const tags = new Map<ObjectId, number>()
  const parts: string[] = []
  const visit = (id: ObjectId): string => {
    const o = s.objects[id]
    if (!o) return '?'
    if (o.kind === 'value') return `${o.type}:${o.repr}`
    const seen = tags.get(id)
    if (seen !== undefined) return `#${seen}`
    const tag = tags.size + 1
    tags.set(id, tag)
    const inner = o.elements === null ? o.repr : o.elements.map((e) => `${e.label ?? ''}=${visit(e.target)}`).join(',')
    return `#${tag}${o.type}[${inner}]`
  }
  const names = [...s.bindings].sort((a, b) => a.scope.localeCompare(b.scope) || a.name.localeCompare(b.name))
  for (const b of names) parts.push(`${b.scope}.${b.name}->${visit(b.target)}`)
  return parts.join(' ')
}

/* ------------------------------ transforms ------------------------------ */

let fresh = 0
const newId = () => `x:${++fresh}`

const clone = (s: MemorySnapshot): MemorySnapshot => ({
  line: s.line,
  bindings: s.bindings.map((b) => ({ ...b })),
  objects: Object.fromEntries(
    Object.entries(s.objects).map(([k, o]) => [k, { ...o, elements: o.elements?.map((e) => ({ ...e })) ?? null }]),
  ),
})

/** A new object with the same contents: one level deep, like `xs[:]`. */
function copyOf(s: MemorySnapshot, id: ObjectId, deep = false): ObjectId {
  const o = s.objects[id]!
  if (o.kind === 'value') return id
  const copy: PyObject = {
    ...o,
    id: newId(),
    elements: o.elements?.map((e) => ({ ...e, target: deep ? copyOf(s, e.target, true) : e.target })) ?? null,
  }
  s.objects[copy.id] = copy
  return copy.id
}

const isRef = (s: MemorySnapshot, id: ObjectId) => s.objects[id]?.kind === 'reference'
const isFunction = (s: MemorySnapshot, id: ObjectId) => s.objects[id]?.type === 'function'

/** Every place that points at an object: a name, or a slot in a container. */
type Holder = { binding: Binding } | { owner: ObjectId; slot: number }

function holders(s: MemorySnapshot, id: ObjectId): Holder[] {
  const out: Holder[] = []
  for (const b of s.bindings) if (b.target === id) out.push({ binding: b })
  for (const o of Object.values(s.objects)) {
    o.elements?.forEach((e, slot) => {
      if (e.target === id) out.push({ owner: o.id, slot })
    })
  }
  return out
}

const retarget = (s: MemorySnapshot, h: Holder, to: ObjectId) => {
  if ('binding' in h) h.binding.target = to
  else s.objects[h.owner]!.elements![h.slot]!.target = to
}

/** Objects that look alike, by contents, ignoring identity. */
function looksLike(s: MemorySnapshot, a: ObjectId, b: ObjectId): boolean {
  const one = { bindings: [{ name: 'x', scope: 'g', target: a }], objects: s.objects, line: null }
  const two = { bindings: [{ name: 'x', scope: 'g', target: b }], objects: s.objects, line: null }
  return canonical(one) === canonical(two)
}

/** Drops objects nothing points at any more, so a transform that moves an
 *  arrow does not leave the old object floating in the picture. */
function prune(s: MemorySnapshot): MemorySnapshot {
  const keep = new Set<ObjectId>()
  const walk = (id: ObjectId) => {
    if (keep.has(id)) return
    keep.add(id)
    for (const e of s.objects[id]?.elements ?? []) walk(e.target)
  }
  for (const b of s.bindings) walk(b.target)
  s.objects = Object.fromEntries(Object.entries(s.objects).filter(([k]) => keep.has(k)))
  return s
}

type Step = (s: MemorySnapshot) => MemorySnapshot | null

/** "`b = a` makes a copy": every reference held by two names becomes one
 *  per name. */
const aliasToCopy: Step = (t) => {
  const s = clone(t)
  let changed = false
  for (const id of Object.keys(t.objects)) {
    if (!isRef(s, id) || isFunction(s, id)) continue
    const named = holders(s, id).filter((h) => 'binding' in h)
    for (const h of named.slice(1)) {
      retarget(s, h, copyOf(s, id))
      changed = true
    }
  }
  return changed ? prune(s) : null
}

/** "Equal-looking lists are the same list": separate lookalikes held by
 *  names are merged into one. */
const copyToAlias: Step = (t) => {
  const s = clone(t)
  let changed = false
  const named = s.bindings.filter((b) => isRef(s, b.target) && !isFunction(s, b.target))
  for (let i = 0; i < named.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = named[j]!.target
      const b = named[i]!.target
      if (a !== b && looksLike(s, a, b)) {
        named[i]!.target = a
        changed = true
        break
      }
    }
  }
  return changed ? prune(s) : null
}

/** "A new outer container means new inner objects", "`*` makes independent
 *  lists": an object held by several slots gets one copy per slot. */
const sharedInnerToSeparate: Step = (t) => {
  const s = clone(t)
  let changed = false
  for (const id of Object.keys(t.objects)) {
    if (!isRef(s, id)) continue
    const slots = holders(s, id).filter((h) => 'owner' in h && !isFunction(s, h.owner))
    const named = holders(s, id).some((h) => 'binding' in h)
    // Keep the first holder on the original; everyone else gets their own.
    for (const h of slots.slice(named ? 0 : 1)) {
      retarget(s, h, copyOf(s, id, true))
      changed = true
    }
  }
  return changed ? prune(s) : null
}

/** The reverse: lookalike inner objects in different slots drawn as one. */
const separateInnerToShared: Step = (t) => {
  const s = clone(t)
  let changed = false
  const slots: { owner: ObjectId; slot: number; target: ObjectId }[] = []
  for (const o of Object.values(s.objects)) {
    o.elements?.forEach((e, slot) => {
      if (isRef(s, e.target)) slots.push({ owner: o.id, slot, target: e.target })
    })
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = slots[j]!
      const b = slots[i]!
      if (a.target !== b.target && looksLike(s, a.target, b.target)) {
        s.objects[b.owner]!.elements![b.slot]!.target = a.target
        b.target = a.target
        changed = true
        break
      }
    }
  }
  return changed ? prune(s) : null
}

/** "Defaults are created per call": the function's default object is not
 *  the one the caller was handed back. */
const defaultToFresh: Step = (t) => {
  const s = clone(t)
  let changed = false
  for (const o of Object.values(t.objects)) {
    if (o.type !== 'function' || !o.elements) continue
    for (const e of o.elements) {
      if (!isRef(s, e.target)) continue
      for (const h of holders(s, e.target)) {
        if ('owner' in h && h.owner === o.id) continue
        retarget(s, h, copyOf(s, e.target))
        changed = true
      }
    }
  }
  return changed ? prune(s) : null
}

/** "`y = x` links the names": a name follows another name to whatever it
 *  points at now. The second of two names on different objects of the
 *  same type is moved onto the first's. */
const followRebind: Step = (t) => {
  const s = clone(t)
  const bs = s.bindings.filter((b) => !isFunction(s, b.target))
  for (let i = bs.length - 1; i > 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      const a = s.objects[bs[j]!.target]
      const b = s.objects[bs[i]!.target]
      if (a && b && a.id !== b.id && a.type === b.type) {
        bs[j]!.target = b.id
        return prune(s)
      }
    }
  }
  return null
}

const STEPS: Partial<Record<Transform, Step>> = {
  'alias-to-copy': aliasToCopy,
  'copy-to-alias': copyToAlias,
  'shared-inner-to-separate': sharedInnerToSeparate,
  'separate-inner-to-shared': separateInnerToShared,
  'default-to-fresh': defaultToFresh,
  'follow-rebind': followRebind,
}

/**
 * Memory as a picture is asked about it: names bound to plain function
 * objects are left out. Every option would draw them identically — a
 * capstone picture was four function cards and a board too small to read
 * — and they are not what any picture question is about. A function that
 * *owns* something (a default list) stays, because that is exactly what
 * the capstone's `log=[]` is about.
 */
export function forPicture(s: MemorySnapshot): MemorySnapshot {
  const plain = (id: ObjectId) => {
    const o = s.objects[id]
    return o?.type === 'function' && (o.elements === null || o.elements.length === 0)
  }
  if (!s.bindings.some((b) => plain(b.target))) return s
  return prune({ ...clone(s), bindings: s.bindings.filter((b) => !plain(b.target)).map((b) => ({ ...b })) })
}

/** What each wrong picture stands for, for the key card. */
export const TRANSFORM_SAYS: Record<Transform, string> = {
  'alias-to-copy': 'the picture if giving a second name made a copy',
  'copy-to-alias': 'the picture if equal-looking objects were one object',
  'shared-inner-to-separate': 'the picture if each slot had its own inner object',
  'separate-inner-to-shared': 'the picture if lookalike inner objects were shared',
  'default-to-fresh': 'the picture if the default were made fresh for each call',
  'follow-rebind': 'the picture if one name followed another when it moved',
  earlier: 'memory a line too early',
  later: 'memory a line too late',
  moment: 'memory at a different moment',
}

/** Applies one named transform to the truth, or null when the wrong idea
 *  it stands for would draw nothing different here. */
export const applyTransform = (t: Transform, truth: MemorySnapshot): MemorySnapshot | null => STEPS[t]?.(truth) ?? null

/**
 * The pictures to choose from: the truth and each candidate that actually
 * differs from it and from the others.
 *
 * Shuffled by `seed`, so the right answer is not always first, and the
 * same exercise always shuffles the same way.
 */
export function diagramOptions(
  truth: MemorySnapshot,
  candidates: readonly { snapshot: MemorySnapshot | null; transform: Transform }[],
  seed = 1,
): { options: { snapshot: MemorySnapshot; transform: Transform | null }[]; answer: number } {
  const seen = new Set([canonical(truth)])
  const wrong: { snapshot: MemorySnapshot; transform: Transform }[] = []
  for (const c of candidates) {
    if (!c.snapshot) continue
    const key = canonical(c.snapshot)
    if (seen.has(key)) continue
    seen.add(key)
    wrong.push({ snapshot: c.snapshot, transform: c.transform })
  }
  const all: { snapshot: MemorySnapshot; transform: Transform | null }[] = [...wrong]
  // A small deterministic shuffle: the seed picks where the truth goes.
  const at = Math.abs(seed) % (wrong.length + 1)
  all.splice(at, 0, { snapshot: truth, transform: null })
  return { options: all, answer: at }
}

/** Every transform that works on a single picture, for the sweep. */
export const TRANSFORMS: Transform[] = Object.keys(STEPS) as Transform[]
