/**
 * Playing one item: run its snippets, grade what was committed.
 *
 * Shared by the page and by the Node sweep, which is the point. Both hand
 * this an `Evaluate` — run this source in the real engine, give back the
 * evidence — and everything after that is the same code, so the sweep
 * grades the key's own answers exactly the way a player is graded.
 */
import type { Moment, RunEvidence } from '../memory/extract'
import type { MemorySnapshot } from '../memory/model'
import { bodiesProgram, checkerProgram, readBodies } from './checker'
import { applyTransform, diagramOptions, forPicture } from './distractors'
import { gradePart, pythonChecks, snippetIndex, type Truth } from './grade'
import type { Answer, DiagramChoice, Graded, Part, Snippet, Spec } from './model'

export type Evaluate = (source: string, options?: { max_steps?: number }) => Promise<RunEvidence>

/** An item as the player meets it: an exercise or a checkpoint question,
 *  its spec, and the snippets it is about. */
export type Playable = {
  id: string
  spec: Spec
  snippets: Snippet[]
}

/** Whether a part is a prediction, committed before anything runs, or an
 *  action taken after — a repair, a program, a self-mark. */
export const isPrediction = (p: Part): boolean => p.kind !== 'fix' && p.kind !== 'write'

/** A stable number from an id, to shuffle each item's pictures the same
 *  way every time. */
export function seedOf(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0
  return h
}

/**
 * Runs every snippet, then whatever the parts need besides: Python's own
 * block boundaries for `block`, and the pictures for `diagram`.
 */
export async function prepare(item: Playable, evaluate: Evaluate): Promise<Truth> {
  const opts = item.spec.options
  const runs: RunEvidence[] = []
  for (const s of item.snippets) runs.push(await evaluate(s.code, opts))

  const truth: Truth = {
    runs,
    labels: item.snippets.map((s) => s.label),
    sources: item.snippets.map((s) => s.code),
  }

  if (item.spec.parts.some((p) => p.kind === 'block')) {
    truth.bodies = []
    for (const s of item.snippets) truth.bodies.push(readBodies((await evaluate(bodiesProgram(s.code))).verdict))
  }

  const diagrams = new Map<number, DiagramChoice>()
  item.spec.parts.forEach((p, index) => {
    if (p.kind !== 'diagram') return
    const ev = runs[snippetIndex(p.snippet, truth.labels)]!
    const raw = ev.at(p.at)
    if (!raw) return
    const snap = forPicture(raw)
    const near = neighbours(ev, p.at)
    const pic = (m: MemorySnapshot | null | undefined) => (m ? forPicture(m) : null)
    const candidates = p.distractors.map((d) =>
      typeof d === 'object'
        ? { snapshot: pic(ev.at(d.at)), transform: 'moment' as const }
        : d === 'earlier' || d === 'later'
          ? { snapshot: pic(near[d]), transform: d }
          : { snapshot: applyTransform(d, snap), transform: d },
    )
    diagrams.set(index, diagramOptions(snap, candidates, seedOf(`${item.id}:${index}`)))
  })
  if (diagrams.size) truth.diagrams = diagrams
  return truth
}

/** Memory one line either side of a moment, for the `earlier` and `later`
 *  distractors. */
function neighbours(ev: RunEvidence, at: Moment): { earlier?: MemorySnapshot | null; later?: MemorySnapshot | null } {
  if (at === 'end') {
    const n = ev.visits.length
    return { earlier: n > 0 ? ev.at({ before: ev.visits[n - 1]!.line, occurrence: countOf(ev, n - 1) }) : null, later: null }
  }
  const line = 'before' in at ? at.before : at.after
  const occurrence = at.occurrence ?? 1
  const i = indexOfVisit(ev, line, occurrence)
  if (i < 0) return {}
  if ('before' in at) {
    return {
      earlier: i > 0 ? ev.at({ before: ev.visits[i - 1]!.line, occurrence: countOf(ev, i - 1) }) : null,
      later: ev.afterVisit(i),
    }
  }
  return { earlier: ev.at({ before: line, occurrence }), later: i + 1 < ev.visits.length ? ev.afterVisit(i + 1) : null }
}

const indexOfVisit = (ev: RunEvidence, line: number, occurrence: number) => {
  let seen = 0
  for (let i = 0; i < ev.visits.length; i++) {
    if (ev.visits[i]!.line === line && ++seen === occurrence) return i
  }
  return -1
}
const countOf = (ev: RunEvidence, i: number) => ev.visits.slice(0, i + 1).filter((v) => v.line === ev.visits[i]!.line).length

/** Runs a repair or a written program, and then again with the checker. */
export async function runProgram(
  part: Part & { kind: 'fix' | 'write' },
  source: string,
  evaluate: Evaluate,
  options?: { max_steps?: number },
): Promise<{ source: string; run: RunEvidence; verdict: unknown }> {
  const run = await evaluate(checkerProgram(source, pythonChecks(part.checks)), options)
  return { source, run, verdict: run.verdict }
}

/** Grades every prediction part at once — the commit. */
export function gradePredictions(item: Playable, answers: (Answer | null)[], truth: Truth): (Graded | null)[] {
  return item.spec.parts.map((p, index) => {
    if (!isPrediction(p) || p.kind === 'rule') return null
    const a = answers[index]
    if (!a) return { right: false }
    return gradePart(p, a, truth, { index })
  })
}

/** The source a `fix` part starts from. */
export const originalOf = (item: Playable, part: Part & { kind: 'fix' }): string =>
  item.snippets[snippetIndex(part.snippet, item.snippets.map((s) => s.label))]?.code ?? ''

/**
 * The key's answer to a part, written the way a learner would give it.
 * The sweep grades these; the page offers them as "show me" after two
 * misses on a repair.
 */
export function modelAnswer(part: Part, truth: Truth, index: number): Answer | null {
  switch (part.kind) {
    case 'output':
      return { kind: 'output', text: part.model.text, raises: part.model.raises ?? null }
    case 'choice': {
      const m = part.model ?? (typeof part.answer === 'function' ? part.answer(truth.runs) : part.answer)
      return { kind: 'choice', picked: Array.isArray(m) ? m : [m] }
    }
    case 'number':
      return { kind: 'number', value: part.model }
    case 'line':
      return { kind: 'line', line: part.model }
    case 'order':
      return { kind: 'order', lines: part.model }
    case 'table':
      return { kind: 'table', cells: part.model }
    case 'block':
      return { kind: 'block', body: part.model.body, counts: part.model.counts ?? {} }
    case 'diagram': {
      const d = truth.diagrams?.get(index)
      return d ? { kind: 'diagram', picked: d.answer } : null
    }
    case 'labels':
      return { kind: 'labels', roles: part.spans.map((s) => s.role) }
    case 'rule':
      return { kind: 'rule', text: '', mark: 'right' }
    case 'fix':
      return { kind: 'fix', source: part.model }
    case 'write':
      return { kind: 'write', source: part.model }
  }
}
