/**
 * Facts about memory, for answers the interpreter should give rather than
 * the spec: "how many list objects exist?", "how many arrows point at it?"
 *
 * A spec derives its answer from the run with these (`Derived`), so a
 * count is never typed in twice — once in the key, once in the spec — and
 * never disagrees with what the program actually built.
 */
import type { RunEvidence } from '../memory/extract'
import type { MemorySnapshot, ObjectId } from '../memory/model'

export const targetOf = (s: MemorySnapshot, name: string): ObjectId | null =>
  s.bindings.find((b) => b.name === name)?.target ?? null

/** How many objects of this type memory holds. */
export const countOf = (s: MemorySnapshot, type: string): number =>
  Object.values(s.objects).filter((o) => o.type === type).length

/** How many names memory holds, in the program's own scope. */
export const nameCount = (s: MemorySnapshot, scope = 'global'): number =>
  s.bindings.filter((b) => b.scope === scope && s.objects[b.target]?.type !== 'function').length

/** How many arrows — names and slots — point at what this name points at. */
export function arrowsTo(s: MemorySnapshot, name: string): number {
  const id = targetOf(s, name)
  if (id === null) return 0
  let n = s.bindings.filter((b) => b.target === id).length
  for (const o of Object.values(s.objects)) n += (o.elements ?? []).filter((e) => e.target === id).length
  return n
}

/** Two names on one object. */
export const same = (s: MemorySnapshot, a: string, b: string): boolean => {
  const t = targetOf(s, a)
  return t !== null && t === targetOf(s, b)
}

/** Distinct objects of a type that memory held at any point in the run —
 *  "how many text objects were created?" Values are keyed by what they
 *  are, so this counts different values, which is what the question
 *  means for immutable ones. */
export function everOf(ev: RunEvidence, type: string): number {
  const ids = new Set<string>()
  for (let i = 0; i < ev.visits.length; i++) {
    for (const o of Object.values(ev.afterVisit(i).objects)) if (o.type === type) ids.add(o.id)
  }
  return ids.size
}

/** How Python would print what this name points at (`[1, 2]`, `'a'`),
 *  or null when the name is not bound. Collections are shown in full,
 *  following their pointers — which is what a trace table cell holds. */
export function shown(s: MemorySnapshot | null, name: string): string | null {
  if (!s) return null
  const id = targetOf(s, name)
  return id === null ? null : reprDeep(s, id, new Set())
}

function reprDeep(s: MemorySnapshot, id: ObjectId, open: Set<ObjectId>): string {
  const o = s.objects[id]
  if (!o) return '?'
  if (o.elements === null || o.type === 'function') return o.repr
  if (open.has(id)) return '[...]'
  open.add(id)
  const inner = o.elements.map((e) => (o.type === 'dict' ? `${e.label}: ${reprDeep(s, e.target, open)}` : reprDeep(s, e.target, open)))
  open.delete(id)
  if (o.type === 'tuple') return inner.length === 1 ? `(${inner[0]},)` : `(${inner.join(', ')})`
  if (o.type === 'dict') return `{${inner.join(', ')}}`
  if (o.type === 'set' || o.type === 'frozenset') return inner.length ? `{${inner.join(', ')}}` : 'set()'
  return `[${inner.join(', ')}]`
}

/** How many times a line was reached. */
export const visitsTo = (ev: RunEvidence, line: number): number => ev.visits.filter((v) => v.line === line).length
