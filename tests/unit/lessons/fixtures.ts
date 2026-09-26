/**
 * Shared evidence for the lesson tests.
 *
 * A lesson's progress is derived from evidence, so these tests are just
 * evidence in, step number out. No UI, no runtime, no bookkeeping.
 *
 * The warm-up lessons never bind anything, so their evidence is entirely
 * *thoughts* — what the robot worked out and let go. Memory staying empty
 * there is the lesson, not an omission.
 *
 * Not a test file itself (no `.test.ts`), so vitest only runs it through
 * the files that import it.
 */
import type { Evidence, Line } from '../../../content/lessons'
import type { Thought } from '../../../src/memory/extract'
import type { Binding, MemorySnapshot, PyObject } from '../../../src/memory/model'

export const value = (type: string, repr: string): PyObject => ({
  id: `v:${type}:${repr}`,
  type,
  kind: 'value',
  repr,
  elements: null,
  partial: false,
})

export const snap = (objects: PyObject[], bindings: Binding[] = []): MemorySnapshot => ({
  bindings,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  line: 1,
})

export const EMPTY = snap([])
export const th = (type: string, repr: string): Thought => ({ type, repr })

/** Evidence from a session that thought these things and bound nothing. */
export const thinking = (...thoughts: Thought[]): Evidence => ({
  snapshot: EMPTY,
  thoughts,
  history: [EMPTY],
})

/** Evidence from a session that passed through these memories. */
export const over = (history: MemorySnapshot[], thoughts: Thought[] = []): Evidence => ({
  snapshot: history[history.length - 1]!,
  thoughts,
  history,
})

export const NOTHING: Evidence = thinking()

export const bound = (name: string, type: string, repr: string) => ({
  object: value(type, repr),
  binding: { name, scope: 'global', target: `v:${type}:${repr}` },
})

/** A line the player typed, as the workbench reports it. */
export const line = (source: string, thought: Thought | null, error: string | null = null): Line => ({
  source,
  ok: error === null,
  error,
  thought,
})

/** A line that stopped the robot with this error, as the console words it. */
export const failed = (source: string, error: string): Line => line(source, null, `${error} — the robot stopped there.`)

/** Evidence after typing these lines in order: the accepted expressions
 *  become thoughts (with their source), and the last line is `last`. */
export const typed = (...lines: Line[]): Evidence => ({
  snapshot: EMPTY,
  thoughts: lines.filter((l) => l.ok && l.thought).map((l) => ({ ...l.thought!, source: l.source })),
  history: [EMPTY],
  last: lines[lines.length - 1] ?? null,
})

/**
 * The evidence with `l` as the line that left its newest memory, the way
 * the workbench reports an accepted line: `Line.memory` is the very entry
 * it appended to `history`. That is what lets the lesson take the line
 * back out (`beforeLast`) and see that a binding moved it on, so the next
 * step's reply is never asked about the line that did the step before.
 */
export const madeBy = (e: Evidence, l: Line): Evidence => {
  // Each accepted line leaves its own memory object, as the workbench's
  // do; a fixture that reuses one object for two lines would have the
  // line's memory found at the earlier of them.
  const memory = { ...e.history[e.history.length - 1]! }
  const history = [...e.history.slice(0, -1), memory]
  return { ...e, snapshot: memory, history, last: { ...l, memory } }
}
