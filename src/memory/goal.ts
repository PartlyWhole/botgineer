/**
 * A goal memory: what the crow asks the robot's memory to look like, and
 * how far the real one is from it. Pure; read by the lesson (is the goal
 * met?) and by the stage picture of the goal (which rows are ticked), so
 * the two can never disagree.
 *
 * A goal lists names and the value each should point at, written as a
 * Python literal the way the player would type it (`3`, `2.5`, `"Bolt"`,
 * `True`). The match is by type and value — `3` is not `3.0` — and it is
 * exact: a name the goal does not list is a mismatch too, which is why
 * the player can wipe the robot's memory and start again.
 */
import type { MemorySnapshot, PyObject } from './model'

/**
 * One name in a goal: the value it points at, or — for two names on one
 * list — `same`, the other name whose very object it must point at. A
 * list's value is its literal, `[3, 9, 2]`, and each slot is matched
 * against the object it points at: memory draws a list's contents as
 * arrows to objects of their own (invariant 4), so its own `repr` is only
 * its size.
 */
export type GoalBinding = { name: string; value: string; same?: string }
export type Goal = GoalBinding[]

/** A Python literal as the console would print it back: `"Bolt"` is
 *  `'Bolt'`, and everything else is as written. */
export function reprOf(literal: string): string {
  const t = literal.trim()
  const m = /^"(.*)"$/.exec(t) ?? /^'(.*)'$/.exec(t)
  if (m) return m[1]!.includes("'") && !m[1]!.includes('"') ? `"${m[1]}"` : `'${m[1]}'`
  return t
}

/** The items of a flat list literal, `[3, "a b", 2.5]`, as literals. */
export function itemsOf(literal: string): string[] | null {
  const t = literal.trim()
  if (!t.startsWith('[') || !t.endsWith(']')) return null
  const body = t.slice(1, -1)
  const items: string[] = []
  let cur = ''
  let quote: string | null = null
  for (const ch of body) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if (ch === ',') {
      items.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim() !== '') items.push(cur.trim())
  return items
}

/** The type of a literal, as Python names it. */
export function typeOf(literal: string): string {
  const t = literal.trim()
  if (t.startsWith('[')) return 'list'
  if (/^["']/.test(t)) return 'str'
  if (t === 'True' || t === 'False') return 'bool'
  return t.includes('.') ? 'float' : 'int'
}

export type GoalRow = GoalBinding & {
  /** What the name points at now, as the console prints it, or null. */
  have: string | null
  haveType: string | null
  ok: boolean
}

/** An object as a literal would read back: a list shown slot by slot. */
export function shown(o: PyObject, s: MemorySnapshot): string {
  if (o.type !== 'list' || !o.elements) return o.repr
  return `[${o.elements.map((e) => (s.objects[e.target] ? shown(s.objects[e.target]!, s) : '?')).join(', ')}]`
}

/** This object is what this literal makes: by type and value, and a
 *  list's slots each pointing at what its items make. */
function matches(o: PyObject, literal: string, s: MemorySnapshot): boolean {
  if (o.type !== typeOf(literal)) return false
  const items = itemsOf(literal)
  if (items === null) return o.repr === reprOf(literal)
  const els = o.elements ?? []
  return els.length === items.length && els.every((e, i) => {
    const t = s.objects[e.target]
    return t !== undefined && matches(t, items[i]!, s)
  })
}

/** One goal row against memory, on its own: extra names do not matter. */
export function holds(g: GoalBinding, s: MemorySnapshot): boolean {
  const b = s.bindings.find((x) => x.name === g.name)
  const o = b ? (s.objects[b.target] ?? null) : null
  if (!b || !o) return false
  if (g.same !== undefined) {
    const other = s.bindings.find((x) => x.name === g.same)
    if (!other || other.target !== b.target) return false
  }
  return matches(o, g.value, s)
}

/** Each goal row against memory, and the names memory has that the goal
 *  does not. */
export function compare(goal: Goal, s: MemorySnapshot): { rows: GoalRow[]; extra: string[]; met: boolean } {
  const pointed = (name: string) => {
    const b = s.bindings.find((x) => x.name === name)
    return b ? (s.objects[b.target] ?? null) : null
  }
  const rows = goal.map((g) => {
    const o = pointed(g.name)
    return { ...g, have: o ? shown(o, s) : null, haveType: o?.type ?? null, ok: holds(g, s) }
  })
  const listed = new Set(goal.map((g) => g.name))
  const extra = [...new Set(s.bindings.map((b) => b.name))].filter((n) => !listed.has(n))
  return { rows, extra, met: rows.every((r) => r.ok) && extra.length === 0 }
}
